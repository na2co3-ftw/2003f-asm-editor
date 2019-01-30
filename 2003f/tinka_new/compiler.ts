import {Block, Cersva, Expression, ParseResult, Statement, TinkaParser, tokenize} from "./parser";
import {Compare, CompileResult, isCompare, ParseError, Register, Token, Value, WritableValue} from "../types";
import {AsmBuilder, V} from "../builder";

const NEGATE_COMPARE: { [compare: string]: Compare } = {
	xtlo: "llo",
	xylo: "xolo",
	clo: "niv",
	niv: "clo",
	llo: "xtlo",
	xolo: "xylo",
	xtlonys: "llonys",
	xylonys: "xolonys",
	llonys: "xtlonys",
	xolonys: "xylonys"
};

const REGISTERS: Register[] = ["f0", "f1", "f2", "f3"];

export function fullCompile(str: string, file: string = ""): CompileResult {
	const tokenized = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const parsed = new TinkaParser(tokenized.tokens, tokenized.eof).parse();
	if (parsed.root == null) {
		return {
			data: null,
			errors: parsed.errors,
			warnings: parsed.warnings
		};
	}

	const compiled = compile(parsed.root, file);
	return {
		data: compiled.data,
		errors: [...parsed.errors, ...compiled.errors],
		warnings: [...parsed.warnings, ...compiled.warnings]
	};
}

interface Frame {
	variables: Map<string, number>;
	fixedSize: number;
	registerAllocs: Map<Register, RegisterAlloc>;
	memoryAllocs: Set<number>;
	size: number;
}

type Alloc = RegisterAlloc | StackAlloc;

interface RegisterAlloc {
	type: "alloc";
	register: Register;
}

interface StackAlloc {
	type: "alloc";
	position: number;
}

type Reference = StackReference | AbsoluteReference;

interface StackReference {
	type: "reference";
	position: number;
}

interface AbsoluteReference {
	type: "reference";
	value: WritableValue;
}

type TinkaValue = number | Alloc | Reference;

function isRegisterAlloc(alloc: Alloc): alloc is RegisterAlloc {
	return alloc.hasOwnProperty("register");
}

function isStackReference(reference: Reference): reference is StackReference {
	return reference.hasOwnProperty("position");
}

function compile(parsed: ParseResult, name: string): CompileResult {
	let builder = new AsmBuilder(name);
	let errors: ParseError[] = [];
	let warnings: ParseError[] = [];

	let globalVariables = new Set<string>();
	let definedLabels = new Map<string, Token>();
	let labelUses = new Map<string, Token[]>();
	let internalLabelCount = new Map<string, number>();

	for (const xok of parsed.xokList) {
		builder.xok(xok.text, xok);
		defineLabel(xok);
	}
	for (const kue of parsed.kueList) {
		builder.kue(kue.text, kue);
		useLabel(kue);
	}
	for (const variable of parsed.variables) {
		if (globalVariables.has(variable.name.text)) {
			errors.push(new ParseError(`'${variable.name.text}' is already defined`, variable.name));
		}
		globalVariables.add(variable.name.text);
	}

	if (parsed.hasMain) {
		builder.setHasMain(true);
		const initializerFrame = {
			variables: new Map(),
			fixedSize: 0,
			registerAllocs: new Map(),
			memoryAllocs: new Set(),
			size: 0
		};
		for (const statement of parsed.initializeStatements) {
			genStatement(statement, initializerFrame);
		}
		genUpdateStackSize(0, initializerFrame);
		builder.krz(V.label("fasal"), V.xx);
	} else {
		for (const statement of parsed.initializeStatements) {
			errors.push(new ParseError("Library modules cannot have global initializers", statement.token));
		}
	}

	for (const variable of parsed.variables) {
		builder.nll(`--anax-${variable.name.text}--`);
		if (typeof variable.size == "undefined") {
			builder.addValue(0, 4);
		} else {
			for (let i = 0; i < variable.size; i++) {
				builder.addValue(0, 4);
			}
		}
	}

	for (const cersva of parsed.cersvaList) {
		genCersva(cersva);
	}

	for (const [label, uses] of labelUses.entries()) {
		const def = definedLabels.get(label);
		if (!def) {
			for (const use of uses) {
				errors.push(new ParseError(`'${label}' is not defined`, use));
			}
		} else {
			definedLabels.delete(label);
		}
	}
	for (const [label, def] of definedLabels.entries()) {
		if (label == "fasal") continue;
		warnings.push(new ParseError(`'${label}' is defined but not used`, def));
	}

	return {data: builder.getAsmModule(), errors, warnings};


	function defineLabel(token: Token) {
		const definedLabel = definedLabels.get(token.text);
		if (definedLabel) {
			errors.push(new ParseError(`'${token.text}' is already defined`, token));
		} else {
			definedLabels.set(token.text, token);
		}
	}

	function useLabel(token: Token) {
		let uses = labelUses.get(token.text);
		if (uses) {
			uses.push(token);
		} else {
			labelUses.set(token.text, [token]);
		}
	}

	function getInternalLabel(name: string): string {
		const count = (internalLabelCount.get(name) || 0) + 1;
		internalLabelCount.set(name, count);
		return `--${name}-${count}--`;
	}


	function alloc(value: TinkaValue | null, frame: Frame, avoidRegister: boolean = false): Alloc {
		if (value != null && typeof value != "number") {
			if (value.type == "alloc") {
				return value;
			}
		}

		let alloc: Alloc | undefined;
		if (!avoidRegister) {
			for (const reg of REGISTERS) {
				if (!frame.registerAllocs.has(reg)) {
					alloc = {type: "alloc", register: reg};
					frame.registerAllocs.set(reg, alloc);
					break;
				}
			}
		}

		if (!alloc) {
			let position = frame.fixedSize + 1;
			while (frame.memoryAllocs.has(position)) {
				position++;
			}
			if (position > frame.size) {
				builder.nta(V.imm((position - frame.size) * 4), V.f5);
				frame.size = position;
			}
			alloc = {type: "alloc", position};
			frame.memoryAllocs.add(position);
		}

		if (value != null) {
			builder.krz(toValue(value, frame), toWritableValue(alloc, frame));
		}
		return alloc;
	}

	function release(value: TinkaValue, frame: Frame) {
		if (typeof value != "number" && value.type == "alloc") {
			if (isRegisterAlloc(value)) {
				frame.registerAllocs.delete(value.register);
			} else {
				frame.memoryAllocs.delete(value.position);
			}
		}
	}

	function toValue(value: TinkaValue, frame: Frame): Value {
		if (typeof value == "number") {
			return V.imm(value);
		} else if (value.type == "alloc") {
			return toWritableValue(value, frame);
		} else {
			return referenceToWritableValue(value, frame);
		}
	}

	function toWritableValue(value: Alloc, frame: Frame): WritableValue {
		if (isRegisterAlloc(value)) {
			return V.reg(value.register);
		} else {
			return V.indRegDisp("f5", (frame.size - value.position) * 4);
		}
	}

	function referenceToWritableValue(reference: Reference, frame: Frame): WritableValue {
		if (isStackReference(reference)) {
			return V.indRegDisp("f5", (frame.size - reference.position) * 4);
		} else {
			return reference.value;
		}
	}

	function genUpdateStackSize(size: number, frame: Frame) {
		if (size > frame.size) {
			builder.nta(V.imm((size - frame.size) * 4), V.f5);
		} else if (size < frame.size) {
			builder.ata(V.imm((frame.size - size) * 4), V.f5);
		}
		frame.size = size;
	}

	function spillRegisterAlloc(regAlloc: RegisterAlloc, frame: Frame) {
		const stackAlloc = alloc(null, frame, true) as StackAlloc;
		builder.krz(toValue(regAlloc, frame), toWritableValue(stackAlloc, frame));
		frame.registerAllocs.delete(regAlloc.register);
		const replacedAlloc = regAlloc as any;
		delete replacedAlloc.register;
		replacedAlloc.position = stackAlloc.position;
	}

	function spillReplaceRegisterAlloc(regAlloc: RegisterAlloc, replace: number | StackAlloc | Reference, frame: Frame): RegisterAlloc {
		let stackAlloc: StackAlloc;
		if (typeof replace != "number" && replace.type == "alloc") {
			stackAlloc = replace;
		} else {
			stackAlloc = alloc(null, frame, true) as StackAlloc;
		}
		builder.inj(toValue(replace, frame), toWritableValue(regAlloc, frame), toWritableValue(stackAlloc, frame));
		const reg = regAlloc.register;
		const replacedAlloc = regAlloc as any;
		delete replacedAlloc.register;
		replacedAlloc.position = stackAlloc.position;
		return {type: "alloc", register: reg};
	}

	function allocRegister(value: TinkaValue, frame: Frame): RegisterAlloc {
		if (value != null && typeof value != "number") {
			if (value.type == "alloc" && isRegisterAlloc(value)) {
				return value;
			}
		}

		for (const reg of REGISTERS) {
			if (!frame.registerAllocs.has(reg)) {
				const alloc: Alloc = {type: "alloc", register: reg};
				frame.registerAllocs.set(reg, alloc);

				if (value != null) {
					builder.krz(toValue(value, frame), toWritableValue(alloc, frame));
					release(value, frame);
				}
				return alloc;
			}
		}

		return spillReplaceRegisterAlloc(frame.registerAllocs.get(REGISTERS[REGISTERS.length - 1])!, value, frame);
	}


	function genCersva(cersva: Cersva) {
		let frame = {
			variables: new Map(),
			fixedSize: 0,
			registerAllocs: new Map(),
			memoryAllocs: new Set(),
			size: 0
		};

		builder.nll(cersva.name.text);
		defineLabel(cersva.name);

		if (cersva.name.text == "fasal" && cersva.args.length != 0) {
			warnings.push(new ParseError("'fasal' should not have arguments", cersva.args[0]));
		}
		for (let i = 0; i < cersva.args.length; i++) {
			const arg = cersva.args[i];
			if (frame.variables.has(arg.text)) {
				errors.push(new ParseError(`'${arg.text}' is already defined`, arg));
			} else {
				frame.variables.set(arg.text, i - cersva.args.length);
			}
		}

		const blockFrame = genBlockPrologue(cersva.body, frame);
		genBlock(cersva.body, blockFrame);
		if (cersva.body.statements[cersva.body.statements.length - 1] instanceof Statement.Dosnud) {
			return;
		}
		genUpdateStackSize(0, blockFrame);
		builder.krz(V.f5io, V.xx);
	}

	function genBlockPrologue(block: Block, parentFrame: Frame): Frame {
		if (parentFrame.memoryAllocs.size != 0) {
			throw new ParseError("Unreachable", null);
		}
		let frame = {
			variables: new Map(parentFrame.variables),
			fixedSize: parentFrame.fixedSize,
			registerAllocs: new Map(),
			memoryAllocs: new Set(),
			size: parentFrame.size,
		};
		for (const variable of block.variables) {
			if (frame.variables.has(variable.name.text)) {
				errors.push(new ParseError(`'${variable.name.text} is already defined`, variable.name));
			} else {
				frame.fixedSize += typeof variable.size == "undefined" ? 1 : variable.size;
				frame.variables.set(variable.name.text, frame.fixedSize);
			}
		}
		if (frame.size < frame.fixedSize) {
			frame.size = frame.fixedSize;
		}
		if (frame.size > parentFrame.size) {
			builder.nta(V.imm((frame.size - parentFrame.size) * 4), V.f5);
		}
		parentFrame.size = frame.size;
		return frame;
	}

	function genBlock(block: Block, frame: Frame) {
		for (const statement of block.statements) {
			genStatement(statement, frame);
		}
	}

	function genBlockEpilogue(frame: Frame, parentFrame: Frame) {
		genUpdateStackSize(parentFrame.size, frame);
	}

	function genStatement(statement: Statement, frame: Frame) {
		builder.setNextToken(statement.token);
		if (statement instanceof Statement.Assign) {
			const value = genExpression(statement.value, frame);
			genVariableOperation(statement.variable, frame, (reference) => {
				builder.krz(toValue(value, frame), referenceToWritableValue(reference, frame));
			}, (varValue, regAlloc) => {
				builder.krz(toValue(value, frame), varValue);
				release(regAlloc, frame);
			});
			release(value, frame);
		} else if (statement instanceof Statement.Compute) {
			release(genExpression(statement.value, frame), frame);
		} else if (statement instanceof Statement.Fi) {
			const label = getInternalLabel("fi");

			const blockFrame = genBlockPrologue(statement.body, frame);
			genFiInvCompare(statement.condition, frame);
			blockFrame.size = frame.size;
			builder.malkrz(V.label(label), V.xx);
			genBlock(statement.body, blockFrame);
			genBlockEpilogue(blockFrame, frame);
			builder.nll(label);
		} else if (statement instanceof Statement.Fal) {
			const rinyv = getInternalLabel("fal-rinyv");
			const situv = getInternalLabel("fal-situv");

			const blockFrame = genBlockPrologue(statement.body, frame);
			builder.nll(rinyv);
			genFiInvCompare(statement.condition, frame);
			blockFrame.size = frame.size;
			builder.malkrz(V.label(situv), V.xx);
			genBlock(statement.body, blockFrame);
			genBlockEpilogue(blockFrame, frame);
			builder.krz(V.label(rinyv), V.xx);
			builder.nll(situv);
		} else if (statement instanceof Statement.Dosnud) {
			if (statement.value != null) {
				const value = genExpression(statement.value, frame);
				builder.krz(toValue(value, frame), V.f0);
				release(value, frame);
			}
			if (frame.size) {
				builder.ata(V.imm(frame.size * 4), V.f5);
			}
			builder.krz(V.f5io, V.xx);
		}
	}

	function genFiInvCompare(condition: Expression, frame: Frame) {
		if (condition instanceof Expression.BinaryNode && isCompare(condition.operator)) {
			const a = genExpression(condition.left, frame);
			const b = genExpression(condition.right, frame);
			builder.fi(toValue(a, frame), toValue(b, frame), NEGATE_COMPARE[condition.operator]);
			release(a, frame);
			release(b, frame);
			return;
		}

		const value = genExpression(condition, frame);
		builder.fi(toValue(value, frame), V.imm(0), "clo");
		release(value, frame);
	}

	function genExpression(expression: Expression, frame: Frame): TinkaValue {
		if (expression instanceof Expression.Constant) {
			return expression.value;
		} else if (expression instanceof Expression.Variable) {
			return genVariableOperation<TinkaValue>(expression, frame, (reference) => {
				return reference;
			}, (value, regAlloc) => {
				builder.krz(value, toWritableValue(regAlloc, frame));
				return regAlloc;
			});
		} else if (expression instanceof Expression.UnaryNode) {
			const a = alloc(genExpression(expression.value, frame), frame);
			if (expression.operator == "nac") {
				builder.nac(toWritableValue(a, frame));
			} else { // sna
				builder.nac(toWritableValue(a, frame));
				builder.ata(V.imm(1), toWritableValue(a, frame));
			}
			return a;
		} else if (expression instanceof Expression.BinaryNode) {
			if (AsmBuilder.isBinOp(expression.operator)) {
				const a = alloc(genExpression(expression.left, frame), frame);
				const b = genExpression(expression.right, frame);
				builder.binOp(expression.operator, toValue(b, frame), toWritableValue(a, frame));
				release(b, frame);
				return a;
			} else if (AsmBuilder.isTriOp(expression.operator)) {
				const a = alloc(genExpression(expression.left, frame), frame);
				const b = genExpression(expression.right, frame);
				builder.triOp(
					expression.operator,
					toValue(b, frame),
					toWritableValue(a, frame),
					toWritableValue(a, frame)
				);
				release(b, frame);
				return a;
			} else if (isCompare(expression.operator)) {
				const ret = alloc(null, frame);
				builder.krz(V.imm(0), toWritableValue(ret, frame));
				const a = genExpression(expression.left, frame);
				const b = genExpression(expression.right, frame);
				builder.fi(toValue(a, frame), toValue(b, frame), expression.operator);
				release(a, frame);
				release(b, frame);
				builder.malkrz(V.imm(1), toWritableValue(ret, frame));
				return ret;
			}
			throw new ParseError("Unreachable", null);
		} else if (expression instanceof Expression.Call) {
			for (const regAlloc of frame.registerAllocs.values()) {
				spillRegisterAlloc(regAlloc, frame);
			}

			let argValues: TinkaValue[] = [];
			for (const arg of expression.args) {
				argValues.push(genExpression(arg, frame));
			}

			let callFramePosition = frame.size + 1;
			while (!frame.memoryAllocs.has(callFramePosition - 1) && callFramePosition - 1 > frame.fixedSize) {
				callFramePosition--;
			}
			genUpdateStackSize(callFramePosition + expression.args.length, frame);

			for (let i = 0; i < argValues.length; i++) {
				builder.krz(toValue(argValues[i], frame), V.indRegDisp("f5", (frame.size - callFramePosition - i) * 4));
				release(argValues[i], frame);
			}
			builder.inj(V.label(expression.name.text), V.xx, V.f5io);
			useLabel(expression.name);
			let ret: RegisterAlloc = {
				type: "alloc",
				register: "f0"
			};
			frame.registerAllocs.set("f0", ret);
			return ret;
		}
		throw new ParseError("Unreachable", null);
	}

	function genVariableOperation<T>(
		variable: Expression.Variable,
		frame: Frame,
		sinkReference: (reference: Reference) => T,
		sinkWritableValue: (value: WritableValue, regAlloc: RegisterAlloc) => T
	): T {
		const text = variable.name.text;

		let index: TinkaValue | null = null;
		if (variable.index) {
			index = genExpression(variable.index, frame);
		}

		const position = frame.variables.get(text);
		if (position) {
			if (index == null) {
				return sinkReference({type: "reference", position});
			} else if (typeof index == "number") {
				return sinkReference({type: "reference", position: position - index});
			} else {
				let regAlloc = alloc(index, frame);
				builder.dro(V.imm(2), toWritableValue(regAlloc, frame));
				builder.ata(V.imm((frame.size - position) * 4), toWritableValue(regAlloc, frame));
				regAlloc = allocRegister(regAlloc, frame);
				return sinkWritableValue(V.indRegReg("f5", regAlloc.register), regAlloc);
			}
		}
		if (globalVariables.has(text)) {
			if (index == null) {
				return sinkReference({type: "reference", value: V.indLabel(`--anax-${text}--`)});
			} else if (typeof index == "number") {
				return sinkReference({type: "reference", value: V.indLabelDisp(`--anax-${text}--`, index * 4)});
			} else {
				let regAlloc = alloc(index, frame);
				builder.dro(V.imm(2), toWritableValue(regAlloc, frame));
				regAlloc = allocRegister(regAlloc, frame);
				return sinkWritableValue(V.indLabelReg(`--anax-${text}--`, regAlloc.register), regAlloc);
			}
		}
		throw new ParseError(`'${text}' is not defined`, variable.name);
	}
}

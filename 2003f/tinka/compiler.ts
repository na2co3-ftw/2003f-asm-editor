import {Compare, AsmModule, ParseError, Token, Value, WritableValue} from "../types";
import {AnaxExpression, Definition, Expression, Statement, TinkaParser, tokenize} from "./parser";
import {AsmBuilder, V} from "../builder";

const NEGATE_COMPARE: {[compare: string]: Compare} = {
	xtlo: "llo",
	xylo: "xolo",
	clo: "niv",
	niv: "clo",
	llo: "xtlo",
	xtlonys: "llonys",
	xylonys: "xolonys",
	llonys: "xtlonys",
	xolonys: "xylonys"
};

type CompileResult = {data: AsmModule | null, errors: ParseError[], warnings: ParseError[]};

export function fullCompile(str: string, file: string = ""): CompileResult {
	const {tokens, eof} = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const {root, errors, warnings} = new TinkaParser(tokens, eof).parse();
	if (root == null) {
		return {data: null, errors, warnings};
	}

	const compiled = compile(root);
	return {
		data: compiled.data,
		errors: errors.concat(compiled.errors),
		warnings: warnings.concat(compiled.warnings)
	};
}

interface FunctionFrameInfo {
	stackSize: number,
	variables: Map<string, {offset: number, pointer: boolean, token: Token}>,
	usedVariables: Set<string>,
	dosnudLabel: string
}

type LabelDefinition = "internal" | "builtin" | Definition.Xok | Definition.Cersva;

type LabelUse = Statement.Fenxeo | Definition.Kue;

function compile(parsed: {definitions: Definition[], hasMain: boolean}): CompileResult {
	const {definitions, hasMain} = parsed;
	let builder = new AsmBuilder();
	let labelCount = new Map<string, number>();
	let definedLabels = new Map<string, LabelDefinition>([["'3126834864", "builtin"]]);
	let usedLabels = new Map<string, LabelUse[]>();
	let errors: ParseError[] = [];
	let warnings: ParseError[] = [];

	if (hasMain) {
		builder.krz(V.label("_fasal"), V.reg("xx"));
		builder.setHasMain(true);
	}

	for (const def of definitions) {
		if (def instanceof Definition.Kue) {
			useLabel(def);
			builder.kue(def.name.text);
		} else if (def instanceof Definition.Xok) {
			defineLabel(def);
			builder.xok(def.name.text);
		} else if (def instanceof Definition.Cersva) {
			let ff: FunctionFrameInfo = {
				stackSize: 0,
				variables: new Map(),
				usedVariables: new Set(),
				dosnudLabel: getInternalLabel("dosnud")
			};
			if (def.name.text == "_fasal" && def.args.length != 0) {
				warnings.push(new ParseError("'_fasal' should not have arguments", def.args[0].token));
			}
			for (const arg of def.args) {
				if (ff.variables.has(arg.text)) {
					warnings.push(new ParseError(`'${arg}' is already defined`, arg.token));
				}
				ff.variables.set(arg.text, {
					offset: ff.stackSize,
					pointer: false,
					token: arg.token
				});
				ff.stackSize++;
			}
			const cersvaStackSize = ff.stackSize;

			defineLabel(def);
			builder.nll(def.name.text);
			builder.nta(V.imm(4), V.f5);
			builder.krz(V.f1, V.f5io);
			ff.stackSize++;

			transpileBlock(def.body, ff);
			for (const [name, variable] of ff.variables.entries()) {
				if (!ff.usedVariables.has(name)) {
					warnings.push(new ParseError(`'${name}' is defined but not used`, variable.token));
				}
			}

			builder.nll(ff.dosnudLabel);
			if (ff.stackSize > cersvaStackSize + 1) {
				builder.ata(V.imm((ff.stackSize - cersvaStackSize - 1) * 4), V.reg("f5"));
			}
			builder.krz(V.f5io, V.f1);
			builder.ata(V.imm(4), V.f5);
			builder.krz(V.f5io, V.xx);
		}
	}

	for (const [label, uses] of usedLabels.entries()) {
		const def = definedLabels.get(label);
		if (!def || def == "internal") {
			for (const use of uses) {
				if (def == "internal") {
					warnings.push(new ParseError(`Internal label '${label}' should not be used`, use.name.token));
				} else {
					errors.push(new ParseError(`'${label}' is not defined`, use.name.token));
				}
			}
		} else {
			if (def instanceof Definition.Cersva) {
				for (const use of uses) {
					if (use instanceof Statement.Fenxeo && def.args.length != use.args.length) {
						warnings.push(new ParseError(`'${def.name}' takes ${def.args.length} argument(s) but given ${use.args.length}`, use.token));
					}
				}
			}
			definedLabels.delete(label);
		}
	}
	for (const [label, def] of definedLabels.entries()) {
		if (label != "_fasal" && def instanceof Definition) {
			warnings.push(new ParseError(`'${label}' is defined but not used`, def.name.token));
		}
	}

	return {data: builder.getAsmModule(), errors, warnings};

	function transpileBlock(statements: Statement[], ff: FunctionFrameInfo) {
		let anaxSection = true;
		for (const stmt of statements) {
			if (!(stmt instanceof Statement.Anax)) {
				anaxSection = false;
			}
			builder.setNextToken(stmt.token);
			if (stmt instanceof Statement.Fi) {
				const endLabel = getInternalLabel("fi");

				const left = convertExpr(stmt.left);
				builder.krz(left, V.f0);
				const right = convertExpr(stmt.right);
				builder.fi(V.f0, right, NEGATE_COMPARE[stmt.compare]);
				builder.malkrz(V.label(endLabel), V.xx);

				transpileBlock(stmt.body, ff);

				builder.nll(endLabel);
			} else if (stmt instanceof Statement.Fal) {
				const headLabel = getInternalLabel("fal-rinyv");
				const endLabel = getInternalLabel("fal");

				const left = convertExpr(stmt.left);
				builder.nll(headLabel);
				builder.krz(left, V.f0);
				const right = convertExpr(stmt.right);
				builder.fi(V.f0, right, NEGATE_COMPARE[stmt.compare]);
				builder.malkrz(V.label(endLabel), V.xx);

				transpileBlock(stmt.body, ff);

				builder.krz(V.label(headLabel), V.xx);
				builder.nll(endLabel);
			} else if (stmt instanceof Statement.Anax) {
				if (!anaxSection) {
					warnings.push(new ParseError("'anax' should be at the beginning of function", stmt.token));
				}
				if (ff.variables.has(stmt.name.text)) {
					warnings.push(new ParseError(`'${stmt.name}' is already defined`, stmt.name.token));
				}
				ff.stackSize += stmt.length;
				builder.nta(V.imm(stmt.length * 4), V.f5);
				ff.variables.set(stmt.name.text, {
					offset: ff.stackSize,
					pointer: stmt.pointer,
					token: stmt.name.token
				});
			} else if (stmt instanceof Statement.Fenxeo) {
				let name: Value;
				if (stmt.name.text == "'3126834864") {
					name = V.imm(3126834864);
				} else {
					name = V.label(stmt.name.text);
					useLabel(stmt);
				}

				stmt.args.forEach((arg, i) => {
					const argValue = convertExpr(arg, i + 1);
					builder.nta(V.imm(4), V.f5);
					builder.krz(argValue, V.f5io);
				});

				builder.nta(V.imm(4), V.f5);
				builder.inj(name, V.xx, V.f5io);
				builder.ata(V.imm((stmt.args.length + 1) * 4), V.f5);

				if (stmt.destination != null) {
					const dst = convertAnaxExpr(stmt.destination);
					builder.krz(V.f0, dst);
				}
			} else if (stmt instanceof Statement.Nac) {
				builder.nac(convertAnaxExpr(stmt.dst));
			} else if (stmt instanceof Statement.BinaryOperation) {
				builder.binOp(stmt.mnemonic,
					convertExpr(stmt.src),
					convertAnaxExpr(stmt.dst)
				);
			} else if (stmt instanceof Statement.TernaryOperation) {
				builder.triOp(stmt.mnemonic,
					convertExpr(stmt.src),
					convertAnaxExpr(stmt.dstl),
					convertAnaxExpr(stmt.dsth)
				);
			} else if (stmt instanceof Statement.Dosnud) {
				const value = convertExpr(stmt.value);
				builder.krz(value, V.f0);
				builder.krz(V.label(ff.dosnudLabel), V.xx);
			}
		}

		function convertExpr(expr: Expression, count: number = 0): Value {
			if (expr instanceof Expression.Constant) {
				return V.imm(expr.value);
			}
			if (expr instanceof AnaxExpression) {
				return convertAnaxExpr(expr, count);
			}
			throw new ParseError("unreachable");
		}

		function convertAnaxExpr(expr: AnaxExpression, argCount: number = 0): WritableValue {
			const variable = ff.variables.get(expr.name);
			if (!variable) {
				errors.push(new ParseError(`'${expr.name}' is not defined`, expr.token));
				return V.f0;
			}
			const offset = ff.stackSize - variable.offset + argCount;

			ff.usedVariables.add(expr.name);
			if (expr.pos == null) {
				if (variable.pointer) {
					warnings.push(new ParseError(`'${expr.name}' is array`, expr.token));
				}
				return V.indRegDisp("f5", offset * 4);
			} else {
				if (!variable.pointer) {
					warnings.push(new ParseError(`'${expr.name}' is not array`, expr.token));
				}
				const pos = convertExpr(expr.pos, argCount);
				if (pos instanceof Value.Imm) {
					return V.indRegDisp("f5", (offset + pos.value) * 4);
				} else {
					builder.krz(pos, V.f1);
					builder.ata(V.imm(offset), V.f1);
					builder.dro(V.imm(2), V.f1);
					return V.indRegReg("f5", "f1");
				}
			}
		}
	}

	function getInternalLabel(name: string): string {
		const count = (labelCount.get(name) || 0) + 1;
		labelCount.set(name, count);
		const label = name + count;

		const definedLabel = definedLabels.get(label);
		if (definedLabel instanceof Token) {
			errors.push(new ParseError(`'${label}' is defined internally`, definedLabel));
		}
		definedLabels.set(label, "internal");
		return label;
	}

	function defineLabel(def: Definition.Xok | Definition.Cersva) {
		const label = def.name.text;
		const definedLabel = definedLabels.get(label);
		if (definedLabel) {
			if (definedLabel == "internal") {
				errors.push(new ParseError(`'${label}' is defined internally`, def.name.token));
			} else {
				errors.push(new ParseError(`'${label}' is already defined`, def.name.token));
			}
		} else {
			definedLabels.set(label, def);
		}
	}

	function useLabel(use: LabelUse) {
		const label = use.name.text;
		let uses = usedLabels.get(label);
		if (uses) {
			uses.push(use);
		} else {
			usedLabels.set(label, [use]);
		}
	}
}

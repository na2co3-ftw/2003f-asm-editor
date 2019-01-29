import {Compare, ParseError, Token, Value, WritableValue, CompileResult} from "../types";
import {AsmBuilder, V} from "../builder";
import {AnaxExpression, Definition, Expression, Statement, TinkaParser, tokenize} from "./parser";

const NEGATE_COMPARE: {[compare: string]: Compare} = {
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

export function fullCompile(str: string, file: string = ""): CompileResult {
	const tokenized = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const parsed = new TinkaParser(tokenized.tokens, tokenized.eof).parse();
	if (parsed.root == null) {
		return {
			data: null,
			errors: parsed.errors,
			warnings: tokenized.warnings.concat(parsed.warnings)
		};
	}

	const compiled = compile(parsed.root, file);
	return {
		data: compiled.data,
		errors: parsed.errors.concat(compiled.errors),
		warnings: tokenized.warnings.concat(parsed.warnings, compiled.warnings)
	};
}

interface FunctionFrameInfo {
	stackSize: number,
	variables: Map<string, {offset: number, pointer: boolean, token: Token}>,
	usedVariables: Set<string>,
	dosnudLabel: string
}

type LabelDefinition = "internal" | Definition.Xok | Definition.Cersva;

type LabelUse = Statement.Fenxeo | Definition.Kue;

function compile(parsed: {definitions: Definition[], hasMain: boolean}, name: string): CompileResult {
	const {definitions, hasMain} = parsed;
	let builder = new AsmBuilder(name);
	let labelCount = new Map<string, number>();

	let labelDefinitions = new Map<string, LabelDefinition>();
	let labelUses = new Map<string, LabelUse[]>();

	let errors: ParseError[] = [];
	let warnings: ParseError[] = [];

	if (hasMain) {
		builder.krz(V.label("_fasal"), V.reg("xx"));
		builder.setHasMain(true);
	}

	for (const def of definitions) {
		if (def instanceof Definition.Kue) {
			useLabel(def);
			builder.kue(def.name.text, def.name.token);
		} else if (def instanceof Definition.Xok) {
			defineLabel(def);
			builder.xok(def.name.text, def.name.token);
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
					warnings.push(new ParseError(`'${arg.text}' is already defined`, arg.token));
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

	for (const [label, uses] of labelUses.entries()) {
		const def = labelDefinitions.get(label);
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
						warnings.push(new ParseError(`'${def.name.text}' takes ${def.args.length} argument(s) but given ${use.args.length}`, use.token));
					}
				}
			}
			labelDefinitions.delete(label);
		}
	}
	for (const [label, def] of labelDefinitions.entries()) {
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
					warnings.push(new ParseError(`'${stmt.name.text}' is already defined`, stmt.name.token));
				}
				ff.stackSize += stmt.length;
				builder.nta(V.imm(stmt.length * 4), V.f5);
				ff.variables.set(stmt.name.text, {
					offset: ff.stackSize,
					pointer: stmt.pointer,
					token: stmt.name.token
				});
			} else if (stmt instanceof Statement.Fenxeo) {
				useLabel(stmt);

				stmt.args.forEach((arg, i) => {
					const argValue = convertExpr(arg, i + 1);
					builder.nta(V.imm(4), V.f5);
					builder.krz(argValue, V.f5io);
				});

				builder.nta(V.imm(4), V.f5);
				builder.inj(V.label(stmt.name.text), V.xx, V.f5io);
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
			throw new ParseError("unreachable", null);
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
				if (pos.type == "Imm") {
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

		const definedLabel = labelDefinitions.get(label);
		if (definedLabel instanceof Definition) {
			errors.push(new ParseError(`'${label}' is defined internally`, definedLabel.name.token));
		}
		labelDefinitions.set(label, "internal");
		return label;
	}

	function defineLabel(def: Definition.Xok | Definition.Cersva) {
		const label = def.name.text;
		const definedLabel = labelDefinitions.get(label);
		if (definedLabel) {
			if (definedLabel == "internal") {
				errors.push(new ParseError(`'${label}' is defined internally`, def.name.token));
			} else {
				errors.push(new ParseError(`'${label}' is already defined`, def.name.token));
			}
		} else {
			labelDefinitions.set(label, def);
		}
	}

	function useLabel(use: LabelUse) {
		const label = use.name.text;
		let uses = labelUses.get(label);
		if (uses) {
			uses.push(use);
		} else {
			labelUses.set(label, [use]);
		}
	}
}

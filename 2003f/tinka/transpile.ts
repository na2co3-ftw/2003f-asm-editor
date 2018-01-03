import {Compare, ParsedFile, ParseError, Value, WritableValue} from "../types";
import {Definition, Expression, parse, Statement, tokenize} from "./parse";
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

interface FunctionFrameInfo {
	stackSize: number,
	variables: {[name: string]: number},
	dosnudLabel: string
}

export function fullCompile(str: string, file: string = ""): ParsedFile {
	const ts = tokenize(str.replace(/\r\n?/g, "\n"), file);
	return transpile(parse(ts));
}

function transpile(definitions: Definition[]): ParsedFile {
	let builder = new AsmBuilder();
	let labelCount: {[label: string]: number} = {};

	if (definitions.some(stmt => stmt instanceof Definition.Cersva && stmt.name == "_fasal")) {
		builder.krz(V.label("_fasal"), V.reg("xx"));
		builder.setHasMain(true);
	}

	for (const def of definitions) {
		if (def instanceof Definition.Kue) {
			builder.kue(def.name);
		} else if (def instanceof Definition.Xok) {
			builder.xok(def.name);
		} else if (def instanceof Definition.Cersva) {
			let ff: FunctionFrameInfo = {
				stackSize: 0,
				variables: {},
				dosnudLabel: getLabel("dosnud")
			};
			for (const arg of def.args) {
				ff.variables[arg.name] = ff.stackSize;
				ff.stackSize++;
			}
			const cersvaStackSize = ff.stackSize;
			builder.nll(def.name);
			builder.nta(V.imm(4), V.f5);
			builder.krz(V.f1, V.f5io);
			ff.stackSize++;
			transpileBlock(def.body, ff);
			builder.nll(ff.dosnudLabel);
			if (ff.stackSize > cersvaStackSize + 1) {
				builder.ata(V.imm((ff.stackSize - cersvaStackSize - 1) * 4), V.reg("f5"));
			}
			builder.krz(V.f5io, V.f1);
			builder.ata(V.imm(4), V.f5);
			builder.krz(V.f5io, V.xx);
		}
	}
	return builder.getParsedFile();

	function transpileBlock(statements: Statement[], ff: FunctionFrameInfo) {
		for (const stmt of statements) {
			builder.setNextToken(stmt.token);
			if (stmt instanceof Statement.Fi) {
				const endlabel = getLabel("fi");
				const left = convertExpr(stmt.left);
				builder.krz(left, V.f0);
				const right = convertExpr(stmt.right);
				builder.fi(V.f0, right, NEGATE_COMPARE[stmt.compare]);
				builder.malkrz(V.label(endlabel), V.xx);
				transpileBlock(stmt.body, ff);
				builder.nll(endlabel);
			} else if (stmt instanceof Statement.Fal) {
				const headLabel = getLabel("fal-rinyv");
				const endlabel = getLabel("fal");
				const left = convertExpr(stmt.left);
				builder.nll(headLabel);
				builder.krz(left, V.f0);
				const right = convertExpr(stmt.right);
				builder.fi(V.f0, right, NEGATE_COMPARE[stmt.compare]);
				builder.malkrz(V.label(endlabel), V.xx);
				transpileBlock(stmt.body, ff);
				builder.krz(V.label(headLabel), V.xx);
				builder.nll(endlabel);
			} else if (stmt instanceof Statement.Anax) {
				ff.stackSize += stmt.length;
				builder.nta(V.imm(stmt.length * 4), V.f5);
				ff.variables[stmt.name] = ff.stackSize;
			} else if (stmt instanceof Statement.Fenxeo) {
				let name: Value;
				if (stmt.name == "'3126834864") {
					name = V.imm(3126834864);
				} else {
					name = V.label(stmt.name);
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
					const dst = convertLeftExpr(stmt.destination);
					builder.krz(V.f0, dst);
				}
			} else if (stmt instanceof Statement.Operation) {
				switch (stmt.mnemonic) {
					case "nac":
						builder.nac(convertLeftExpr(stmt.operands[0]));
						break;
					case "krz":
					case "kRz":
						builder.krz(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "ata":
						builder.ata(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "nta":
						builder.nta(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "ada":
						builder.ada(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "ekc":
						builder.ekc(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "dal":
						builder.dal(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "dto":
						builder.dto(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "dro":
					case "dRo":
						builder.dro(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "dtosna":
						builder.dtosna(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]));
						break;
					case "lat":
						builder.lat(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]), convertLeftExpr(stmt.operands[2]));
						break;
					case "latsna":
						builder.latsna(convertExpr(stmt.operands[0]), convertLeftExpr(stmt.operands[1]), convertLeftExpr(stmt.operands[2]));
						break;
					default:
						throw new ParseError("");
				}
			} else if (stmt instanceof Statement.Dosnud) {
				const value = convertExpr(stmt.value);
				builder.krz(value, V.f0);
				builder.krz(V.label(ff.dosnudLabel), V.xx);
			} else {
				throw new ParseError("");
			}
		}

		function convertExpr(expr: Expression, count: number = 0): Value {
			if (expr instanceof Expression.Constant) {
				return V.imm(expr.value);
			}
			return convertLeftExpr(expr, count);
		}

		function convertLeftExpr(expr: Expression, count: number = 0): WritableValue {
			if (!(expr instanceof Expression.Anax)) {
				throw new ParseError("");
			}
			if (typeof ff.variables[expr.name] == "undefined") {
				throw new ParseError("");
			}
			const pos = convertExpr(expr.pos, count);
			if (pos instanceof Value.Pure) {
				return V.indRegDisp("f5", (ff.stackSize - ff.variables[expr.name] + pos.value + count) * 4);
			} else {
				builder.krz(pos, V.f1);
				builder.ata(V.imm(ff.stackSize - ff.variables[expr.name] + count), V.f1);
				builder.dro(V.imm(2), V.f1);
				return V.indRegReg("f5", "f1");
			}

		}
	}

	function getLabel(name: string): string {
		if (typeof labelCount[name] == "undefined") {
			labelCount[name] = 1;
		} else {
			labelCount[name]++;
		}
		return name + labelCount[name];
	}
}

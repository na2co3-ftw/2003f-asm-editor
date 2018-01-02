import {
	Definition, Xok, Kue, Cersva,
	Statement, Anax, Fi, Fal, Dosnud, Fenxeo, Operation,
	Expression, Constant, AnaxName,
	Compare
} from "./types";
import {Cond, ParsedFile, ParseError, Register, Token} from "../types";
import {AsmBuilder, WritableOperand, Operand, isImm, parseLabel} from "../builder";

const MONO_OPERATORS = ["nac"];
const BI_OPERATORS = [
	"krz", "kRz",
	"ata", "nta",
	"ada", "ekc", "dal",
	"dto", "dro", "dRo", "dtosna"
];
const TRI_OPERATORS = ["lat", "latsna"];
const NEGATE_COMPARE = {
	[Compare.xtlo]: Cond.llo,
	[Compare.xylo]: Cond.xolo,
	[Compare.clo]: Cond.niv,
	[Compare.niv]: Cond.clo,
	[Compare.llo]: Cond.xtlo,
	[Compare.xtlonys]: Cond.llonys,
	[Compare.xylonys]: Cond.xolonys,
	[Compare.llonys]: Cond.xtlonys,
	[Compare.xolonys]: Cond.xylonys
};

export function fullCompile(str: string, file: string = ""): ParsedFile {
	const ts = tokenize(str.replace(/\r\n?/g, "\n"), file);
	return transpile(parse(ts));
}

function tokenize(source: string, file: string = ""): Token[] {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		while (pos < source.length) {
			let char = source[pos];
			if (char == "-" && pos + 1 < source.length && source[pos + 1] == "-") {
				advance();
				while (pos < source.length && source[pos] != "\n") {
					advance();
				}
			} else if (!isWhiteSpace(char)) {
				break;
			}
			advance();
		}
		if (pos >= source.length) {
			break;
		}

		let text = "";
		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char) || char == "-" /* || char == "@" || char == "+" || char == ";" */) {
				break;
			}
			text += char;
			advance();
		}
		tokens.push(new Token(text, startRow, startColumn, file));
	}
	return tokens;

	function advance() {
		if (source[pos] == "\n") {
			row++;
			column = 0;
		} else {
			column++;
		}
		pos++;
	}
}

function isWhiteSpace(char: string): boolean {
	return char.search(/\s/) >= 0;
}

function parse(tokens: Token[]): Definition[] {
	let definitions: Definition[] = [];
	let idx = 0;
	while (idx < tokens.length) {
		const tokenStr = tokens[idx].text;
		if (tokenStr == "kue") {
			definitions.push(new Kue(parseLabel(tokens[++idx])));
		} else if (tokenStr == "xok") {
			definitions.push(new Xok(parseLabel(tokens[++idx])));
		} else if (tokenStr == "cersva") {
			const name = tokens[++idx].text;
			if (name.search(/^\d/) >= 0) {
				throw new ParseError(`Bad cersva name: ${name}`);
			}
			if (name == "'3126834864") {
				throw new ParseError("Already define '3126834864");
			}

			let args: {name: string, pointer: boolean}[] = [];
			while (++idx < tokens.length && tokens[idx].text != "rinyv") {
				const arg = tokens[idx].text;
				if (arg.endsWith("@")) {
					args.push({name: arg.slice(0, -1), pointer: true});
				} else {
					args.push({name: arg, pointer: false});
				}
			}
			if (idx >= tokens.length || tokens[idx].text != "rinyv") {
				throw new ParseError("Not found 'rinyv'");
			}
			const body = parseBlock();
			definitions.push(new Cersva(name, args, body));
		} else {
			throw new ParseError(`Unexpected token: ${tokenStr}`);
		}
		idx++;
	}
	return definitions;

	function parseBlock(): Statement[] {
		if (idx >= tokens.length || tokens[idx].text != "rinyv") {
			throw new ParseError("Expect: rinyv");
		}
		idx++;

		let statements: Statement[] = [];
		while (idx < tokens.length) {
			const token = tokens[idx];
			const tokenStr = token.text;
			if (tokenStr == "anax") {
				const label = tokens[++idx].text;
				if (label.includes("@")) {
					const [name, size] = label.split("@");
					statements.push(new Anax(token, name, true, parseInt(size)));
				} else {
					statements.push(new Anax(token, label));
				}
			} else if (tokenStr == "fi") {
				const left = parseExpression(tokens[++idx].text);
				const compare = Compare[tokens[++idx].text];
				const right = parseExpression(tokens[++idx].text);
				idx++;
				const body = parseBlock();
				statements.push(new Fi(token, left, compare, right, body));
			} else if (tokenStr == "fal") {
				const left = parseExpression(tokens[++idx].text);
				const compare = Compare[tokens[++idx].text];
				const right = parseExpression(tokens[++idx].text);
				idx++;
				const body = parseBlock();
				statements.push(new Fal(token, left, compare, right, body));
			} else if (MONO_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text)
				]));
			} else if (BI_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text)
				]));
			} else if (TRI_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text)
				]));
			} else if (tokenStr == "dosnud") {
				statements.push(new Dosnud(token, parseExpression(tokens[++idx].text)));
			} else if (tokenStr == "fenxeo") {
				let name = tokens[++idx].text;
				if (name.search(/^\d/) >= 0) {
					throw new ParseError(`Bad cersva name: ${name}`);
				}

				let args: Expression[] = [];
				while (++idx < tokens.length && tokens[idx].text != "el") {
					args.push(parseExpression(tokens[idx].text));
				}
				if (idx >= tokens.length || tokens[idx].text != "el") {
					throw new ParseError("Not found 'el'");
				}
				const dst = tokens[++idx].text;
				if (dst == "niv") {
					statements.push(new Fenxeo(token, name, args, null));
				} else {
					const dstExpr = parseExpression(dst);
					if (dstExpr instanceof AnaxName) {
						statements.push(new Fenxeo(token, name, args, dstExpr));
					} else {
						throw new ParseError("Not variable");
					}
				}
			} else if (tokenStr == "situv") {
				return statements;
			} else {
				throw new ParseError(`Unexpected token: ${tokenStr}`);
			}
			idx++;
		}
		throw new ParseError("'rinyv' count do not equals 'situv' count.");
	}
}

function parseExpression(token: string): Expression {
	if (token.search(/^\d+$/) >= 0) {
		return new Constant(parseInt(token));
	}
	const i = token.indexOf("@");
	if (i >= 0) {
		if (i == token.length - 1) {
			throw new ParseError(`Invalid operand ${token}`);
		}
		return new AnaxName(token.substr(0, i), parseExpression(token.substr(i + 1)));
	}
	return new AnaxName(token);
}

interface FunctionFrameInfo {
	stackSize: number,
	variables: {[name: string]: number},
	dosnudLabel: string
}

function transpile(definitions: Definition[]): ParsedFile {
	let builder = new AsmBuilder();
	let labelCount: {[label: string]: number} = {};

	if (definitions.some(stmt => stmt instanceof Cersva && stmt.name == "_fasal")) {
		builder.krz("_fasal", Register.xx);
		builder.setHasMain(true);
	}

	for (const def of definitions) {
		if (def instanceof Kue) {
			builder.kue(def.name);
		} else if (def instanceof Xok) {
			builder.xok(def.name);
		} else if (def instanceof Cersva) {
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
			builder.nta({v: 4}, Register.f5);
			builder.krz(Register.f1, [Register.f5]);
			ff.stackSize++;
			transpileBlock(def.body, ff);
			builder.nll(ff.dosnudLabel);
			if (ff.stackSize > cersvaStackSize + 1) {
				builder.ata({v: (ff.stackSize - cersvaStackSize - 1) * 4}, Register.f5);
			}
			builder.krz([Register.f5], Register.f1);
			builder.ata({v: 4}, Register.f5);
			builder.krz([Register.f5], Register.xx);
		}
	}
	return builder.getParsedFile();

	function transpileBlock(statements: Statement[], ff: FunctionFrameInfo) {
		for (const stmt of statements) {
			builder.setNextToken(stmt.token);
			if (stmt instanceof Fi) {
				const endlabel = getLabel("fi");
				const left = convertExpr(stmt.left);
				builder.krz(left, Register.f0);
				const right = convertExpr(stmt.right);
				builder.fi(Register.f0, right, negate(stmt.compare));
				builder.malkrz(endlabel, Register.xx);
				transpileBlock(stmt.body, ff);
				builder.nll(endlabel);
			} else if (stmt instanceof Fal) {
				const headLabel = getLabel("fal-rinyv");
				const endlabel = getLabel("fal");
				const left = convertExpr(stmt.left);
				builder.nll(headLabel);
				builder.krz(left, Register.f0);
				const right = convertExpr(stmt.right);
				builder.fi(Register.f0, right, negate(stmt.compare));
				builder.malkrz(endlabel, Register.xx);
				transpileBlock(stmt.body, ff);
				builder.krz(headLabel, Register.xx);
				builder.nll(endlabel);
			} else if (stmt instanceof Anax) {
				ff.stackSize += stmt.length;
				builder.nta({v: stmt.length * 4}, Register.f5);
				ff.variables[stmt.name] = ff.stackSize;
			} else if (stmt instanceof Fenxeo) {
				let name: Operand = stmt.name;
				if (name == "'3126834864") {
					name = {v: 3126834864};
				}
				stmt.args.forEach((arg, i) => {
					const argValue = convertExpr(arg, i + 1);
					builder.nta({v: 4}, Register.f5);
					builder.krz(argValue, [Register.f5]);
				});
				builder.nta({v: 4}, Register.f5);
				builder.inj(name, Register.xx, [Register.f5]);
				builder.ata({v: (stmt.args.length + 1) * 4}, Register.f5);
				if (stmt.destination != null) {
					const dst = convertLeftExpr(stmt.destination);
					builder.krz(Register.f0, dst);
				}
			} else if (stmt instanceof Operation) {
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
			} else if (stmt instanceof Dosnud) {
				const value = convertExpr(stmt.value);
				builder.krz(value, Register.f0);
				builder.krz(ff.dosnudLabel, Register.xx);
			} else {
				throw new ParseError("");
			}
		}

		function convertExpr(expr: Expression, count: number = 0): Operand {
			if (expr instanceof Constant) {
				return {v: expr.value};
			}
			return convertLeftExpr(expr, count);
		}
		function convertLeftExpr(expr: Expression, count: number = 0): WritableOperand {
			if (!(expr instanceof AnaxName)) {
				throw new ParseError("");
			}
			if (typeof ff.variables[expr.name] == "undefined") {
				throw new ParseError("");
			}
			const pos = convertExpr(expr.pos, count);
			if (isImm(pos)) {
				return [Register.f5, {v: (ff.stackSize - ff.variables[expr.name] + pos.v + count) * 4}];
			} else {
				builder.krz(pos, Register.f1);
				builder.ata({v: ff.stackSize - ff.variables[expr.name] + count}, Register.f1);
				builder.dro({v: 2}, Register.f1);
				return [Register.f5, Register.f1];
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

function negate(compare: Compare): Cond {
	return NEGATE_COMPARE[compare];
}


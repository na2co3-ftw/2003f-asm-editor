import {Compare, isCompare, ParseError, Token} from "../types";

export abstract class Definition {}

export namespace Definition {
	export class Kue extends Definition {
		constructor(public name: string) {
			super();
		}
	}

	export class Xok extends Definition {
		constructor(public name: string) {
			super();
		}
	}

	export class Cersva extends Definition {
		constructor(
			public name: string,
			public args: { name: string, pointer: boolean }[],
			public body: Statement[]
		) {
			super();
		}
	}
}

export abstract class Statement {
	constructor(public token: Token) {}
}

export namespace Statement {
	export class Anax extends Statement {
		constructor(
			token: Token,
			public name: string,
			public pointer: boolean = false,
			public length: number = 1
		) {
			super(token);
		}
	}

	export class Fi extends Statement {
		constructor(
			token: Token,
			public left: Expression,
			public compare: Compare,
			public right: Expression,
			public body: Statement[]
		) {
			super(token);
		}
	}

	export class Fal extends Statement {
		constructor(
			token: Token,
			public left: Expression,
			public compare: Compare,
			public right: Expression,
			public body: Statement[]
		) {
			super(token);
		}
	}

	export class Dosnud extends Statement {
		constructor(
			token: Token,
			public value: Expression
		) {
			super(token);
		}
	}

	export class Fenxeo extends Statement {
		constructor(
			token: Token,
			public name: string,
			public args: Expression[],
			public destination: Expression.Anax | null
		) {
			super(token);
		}
	}

	export class Operation extends Statement {
		constructor(
			token: Token,
			public mnemonic: string,
			public operands: Expression[]
		) {
			super(token);
		}
	}
}


export abstract class Expression {}

export namespace Expression {
	export class Constant extends Expression {
		constructor(public value: number) {
			super();
		}
	}

	export class Anax extends Expression {
		constructor(
			public name: string,
			public pos: Expression = new Constant(0)
		) {
			super();
		}
	}
}

const MONO_OPERATORS = ["nac"];

const BI_OPERATORS = [
	"krz", "kRz",
	"ata", "nta",
	"ada", "ekc", "dal",
	"dto", "dro", "dRo", "dtosna"
];

const TRI_OPERATORS = ["lat", "latsna"];

export function tokenize(source: string, file: string = ""): Token[] {
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

export function parse(tokens: Token[]): Definition[] {
	let definitions: Definition[] = [];
	let idx = 0;
	while (idx < tokens.length) {
		const tokenStr = tokens[idx].text;
		if (tokenStr == "kue") {
			definitions.push(new Definition.Kue(tokens[++idx].text));
		} else if (tokenStr == "xok") {
			definitions.push(new Definition.Xok(tokens[++idx].text));
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
			definitions.push(new Definition.Cersva(name, args, body));
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
					statements.push(new Statement.Anax(token, name, true, parseInt(size)));
				} else {
					statements.push(new Statement.Anax(token, label));
				}
			} else if (tokenStr == "fi") {
				const left = parseExpression(tokens[++idx].text);
				const compare = tokens[++idx].text;
				if (!isCompare(compare)) {
					throw new ParseError("");
				}
				const right = parseExpression(tokens[++idx].text);
				idx++;
				const body = parseBlock();
				statements.push(new Statement.Fi(token, left, compare, right, body));
			} else if (tokenStr == "fal") {
				const left = parseExpression(tokens[++idx].text);
				const compare = tokens[++idx].text;
				if (!isCompare(compare)) {
					throw new ParseError("");
				}
				const right = parseExpression(tokens[++idx].text);
				idx++;
				const body = parseBlock();
				statements.push(new Statement.Fal(token, left, compare, right, body));
			} else if (MONO_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Statement.Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text)
				]));
			} else if (BI_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Statement.Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text)
				]));
			} else if (TRI_OPERATORS.indexOf(tokenStr) >= 0) {
				statements.push(new Statement.Operation(token, tokenStr, [
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text),
					parseExpression(tokens[++idx].text)
				]));
			} else if (tokenStr == "dosnud") {
				statements.push(new Statement.Dosnud(token, parseExpression(tokens[++idx].text)));
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
					statements.push(new Statement.Fenxeo(token, name, args, null));
				} else {
					const dstExpr = parseExpression(dst);
					if (dstExpr instanceof Expression.Anax) {
						statements.push(new Statement.Fenxeo(token, name, args, dstExpr));
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
		return new Expression.Constant(parseInt(token));
	}
	const i = token.indexOf("@");
	if (i >= 0) {
		if (i == token.length - 1) {
			throw new ParseError(`Invalid operand ${token}`);
		}
		return new Expression.Anax(token.substr(0, i), parseExpression(token.substr(i + 1)));
	}
	return new Expression.Anax(token);
}

import {Compare, COMPARES, isCompare, ParseError, Token} from "../types";
import {Parser} from "../parser";
import {isValidAsmLabel} from "../builder";

export abstract class Definition {
	constructor(public token: Token) {}
}

export namespace Definition {
	export class Kue extends Definition {
		constructor(token: Token, public name: Name) {
			super(token);
		}
	}

	export class Xok extends Definition {
		constructor(token: Token, public name: Name) {
			super(token);
		}
	}

	export class Cersva extends Definition {
		constructor(
			token: Token,
			public name: Name,
			public args: Name[],
			public body: Statement[]
		) {
			super(token);
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
			public name: Name,
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
			public name: Name,
			public args: Expression[],
			public destination: AnaxExpression | null
		) {
			super(token);
		}
	}

	export class Nac extends Statement {
		constructor(
			token: Token,
			public dst: AnaxExpression
		) {
			super(token);
		}
	}

	export class BinaryOperation extends Statement {
		constructor(
			token: Token,
			public mnemonic: string,
			public src: Expression,
			public dst: AnaxExpression
		) {
			super(token);
		}
	}

	export class TernaryOperation extends Statement {
		constructor(
			token: Token,
			public mnemonic: string,
			public src: Expression,
			public dstl: AnaxExpression,
			public dsth: AnaxExpression
		) {
			super(token);
		}
	}
}

export abstract class Expression {
	constructor(public token: Token) {}
}

export namespace Expression {
	export class Constant extends Expression {
		constructor(token: Token, public value: number) {
			super(token);
		}
	}
}

export class AnaxExpression extends Expression {
	constructor(
		token: Token,
		public name: string,
		public pos: Expression | null = null
	) {
		super(token);
	}
}

export interface Name {
	text: string;
	token: Token;
}

const BI_OPERATORS = [
	"krz", "kRz",
	"ata", "nta",
	"ada", "ekc", "dal",
	"dto", "dro", "dRo", "dtosna"
];

const TRI_OPERATORS = ["lat", "latsna"];

const RESERVED_KEYWORDS = [
	"kue", "xok", "anax", "fi", "fal", "cersva", "dosnud", "fenxeo", "el",
	"nac", ...BI_OPERATORS, "kak", ...TRI_OPERATORS, ...COMPARES
];

const RESERVED_LABEL_REGEXP = /^(fi|fal(-rinyv)?|dosnud)\d+$/;

export function tokenize(source: string, file: string = ""): {tokens: Token[], eof: Token} {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		let text = "";

		while (pos < source.length) {
			let char = source[pos];
			if (char == "-" && source[pos + 1] == "-") {
				advance();
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

		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char)) {
				break;
			}
			if (char == "-" && source[pos + 1] == "-") {
				break;
			}
			text += char;
			advance();
		}
		tokens.push(new Token(text, startRow, startColumn, file));
	}
	return {tokens, eof: new Token("", row, column, file)};

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
	return /\s/.test(char);
}

function isImproperVariable(text: string): boolean {
	return /^\d*$/.test(text) ||
		RESERVED_KEYWORDS.indexOf(text) >= 0 ||
		/[^\spFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]/.test(text);
}

export class TinkaParser extends Parser<{definitions: Definition[], hasMain: boolean}> {
	private hasMain = false;

	parseRoot(): {definitions: Definition[], hasMain: boolean} {
		let definitions: Definition[] = [];
		while (this.isNotEOF()) {
			this.try(() => {
				definitions.push(this.parseDefinition());
			});
		}
		return {definitions, hasMain: this.hasMain};
	}

	private parseDefinition(): Definition {
		const token = this.take();
		if (token.text == "kue") {
			return new Definition.Kue(token, this.parseLabel());
		}
		if (token.text == "xok") {
			return new Definition.Xok(token, this.parseLabel(true));
		}
		if (token.text == "cersva") {
			const name = this.parseCersvaName(true);
			if (name.text == "_fasal") {
				this.hasMain = true;
			}

			let args: Name[] = [];
			while (this.isNotEOF()) {
				if (this.lookaheadString("rinyv")) {
					break;
				}
				const argToken = this.take();
				let arg = argToken.text;
				let pointer = false;
				if (arg.includes("@")) {
					arg = arg.slice(0, -1);
					pointer = true;
				}
				if (isImproperVariable(arg)) {
					this.warning("Improper variable name", argToken);
				} else if (pointer) {
					this.warning("Redundant '@'", argToken);
				}
				args.push({text: arg, token: argToken});
			}

			const body = this.parseBlock();
			return new Definition.Cersva(token, name, args, body);
		}
		throw new ParseError("Definition expected", token);
	}

	private parseBlock(): Statement[] {
		this.takeString("rinyv");

		let statements: Statement[] = [];
		while (this.isNotEOF()) {
			const situv = this.takeIfString("situv");
			if (situv) {
				if (statements.length == 0) {
					this.warning("Empty block", situv);
				}
				return statements;
			}
			this.try(() => {
				statements.push(this.parseStatement());
			});
		}
		throw new ParseError("'situv' expected", this.eof);
	}

	private parseStatement(): Statement {
		const token = this.take();
		if (token.text == "anax") {
			const nameToken = this.take();
			if (nameToken == this.eof) {
				throw new ParseError("Variable name expected", this.eof);
			} else if (nameToken.text.includes("@")) {
				const split = nameToken.text.split("@");
				const [name, size] = split;

				if (isImproperVariable(name)) {
					this.warning("Improper variable name", nameToken);
				}
				if (size == "") {
					throw new ParseError("Variable size must be specified", nameToken);
				} if (!/^[+-]?\d+$/.test(size)) {
					throw new ParseError(`Invalid variable size '${size}'`, nameToken);
				}
				if (/^[+-]/.test(size)) {
					this.warning(`Improper variable size with '${size[0]}'`, nameToken);
				}
				if (split.length > 2) {
					this.warning(`Redundant '${"@" + split.slice(2).join("@")}'`, nameToken);
				}

				return new Statement.Anax(
					token,
					{text: name, token: nameToken},
					true,
					parseInt(size)
				);
			} else {
				if (isImproperVariable(nameToken.text)) {
					this.warning("Improper variable name", nameToken);
				}
				return new Statement.Anax(token, {text: nameToken.text, token: nameToken});
			}
		}
		if (token.text == "fi") {
			const left = this.parseExpression();
			const compare = this.parseCompare();
			const right = this.parseExpression();
			const body = this.parseBlock();
			return new Statement.Fi(token, left, compare, right, body);
		}
		if (token.text == "fal") {
			const left = this.parseExpression();
			const compare = this.parseCompare();
			const right = this.parseExpression();
			const body = this.parseBlock();
			return new Statement.Fal(token, left, compare, right, body);
		}
		if (token.text == "nac") {
			return new Statement.Nac(token, this.parseAnaxExpression());
		}
		if (BI_OPERATORS.indexOf(token.text) >= 0) {
			return new Statement.BinaryOperation(token, token.text,
				this.parseExpression(),
				this.parseAnaxExpression()
			);
		}
		if (TRI_OPERATORS.indexOf(token.text) >= 0) {
			return new Statement.TernaryOperation(token, token.text,
				this.parseExpression(),
				this.parseAnaxExpression(),
				this.parseAnaxExpression()
			);
		}
		if (token.text == "dosnud") {
			return new Statement.Dosnud(token, this.parseExpression());
		}
		if (token.text == "fenxeo") {
			let name = this.parseCersvaName();

			let args: Expression[] = [];
			while (this.isNotEOF()) {
				if (this.lookaheadString("el")) {
					break;
				}
				args.push(this.parseExpression());
			}
			this.takeString("el");

			if (this.takeIfString("niv")) {
				return new Statement.Fenxeo(token, name, args, null);
			}
			return new Statement.Fenxeo(token, name, args, this.parseAnaxExpression());
		}
		throw new ParseError("Statement expected", token);
	}

	private parseLabel(strict: boolean = false): Name {
		const token = this.take();
		if (token != this.eof && isValidAsmLabel(token.text)) {
			if (strict) {
				if (/^\d/.test(token.text) ||
					RESERVED_KEYWORDS.indexOf(token.text) >= 0 ||
					RESERVED_LABEL_REGEXP.test(token.text)
				) {
					this.warning("Improper label name", token);
				}
			}
			return {text: token.text, token};
		}
		throw new ParseError("Label name expected", token);
	}

	private parseCersvaName(strict: boolean = false): Name {
		const token = this.take();
		if (token != this.eof && isValidAsmLabel(token.text) && !/^\d/.test(token.text)) {
			if (strict) {
				if (RESERVED_KEYWORDS.indexOf(token.text) >= 0 ||
					RESERVED_LABEL_REGEXP.test(token.text)
				) {
					this.warning("Improper cersva name", token);
				}
			}
			return {text: token.text, token};
		}
		throw new ParseError("Function name expected", token);
	}

	private parseExpression(): Expression {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Operand expected", this.eof);
		}

		const split = token.text.split("@");
		if (split[split.length - 1] == "") {
			throw new ParseError("Invalid operand", token);
		}
		const lastValueStr = split[split.length - 1];
		let lastValue;
		if (/^\d+$/.test(lastValueStr)) {
			lastValue = new Expression.Constant(token, parseInt(lastValueStr));
		} else {
			lastValue = new AnaxExpression(token, lastValueStr);
		}

		return split.slice(0, -1).reduceRight((pos, value) => {
			return new AnaxExpression(token, value, pos);
		}, lastValue);
	}

	private parseAnaxExpression(): AnaxExpression {
		const expr = this.parseExpression();
		if (expr instanceof AnaxExpression) {
			return expr;
		} else {
			throw new ParseError("Variable expected", expr.token);
		}
	}

	private parseCompare(): Compare {
		const token = this.take();
		if (token != this.eof && isCompare(token.text)) {
			return token.text;
		}
		throw new ParseError("Compare keyword expected", token);
	}
}

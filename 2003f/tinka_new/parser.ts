import {isCompare, ParseError, Token} from "../types";
import {isValidLabel} from "../2003lk/parser";
import {parseInt32, Parser} from "../parser";

export interface ParseResult {
	kueList: Token[];
	xokList: Token[];
	variables: VariableDeclaration[];
	initializeStatements: Statement[];
	cersvaList: Cersva[];
	hasMain: boolean;
}

export interface Cersva {
	name: Token,
	args: Token[],
	body: Block
}

export interface Block {
	variables: VariableDeclaration[];
	statements: Statement[];
}

export interface VariableDeclaration {
	name: Token;
	size?: number;
}

export abstract class Statement {
	protected constructor(public token: Token) {
	}
}

export namespace Statement {
	export class Assign extends Statement {
		constructor(
			token: Token,
			public variable: Expression.Variable,
			public value: Expression
		) {
			super(token);
		}
	}

	export class Fi extends Statement {
		constructor(
			token: Token,
			public condition: Expression,
			public body: Block
		) {
			super(token);
		}
	}

	export class Fal extends Statement {
		constructor(
			token: Token,
			public condition: Expression,
			public body: Block
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
}

export abstract class Expression {
	protected constructor() {
	}
}

export namespace Expression {
	export class Constant extends Expression {
		constructor(public value: number) {
			super();
		}
	}

	export class Variable extends Expression {
		constructor(
			public name: Token,
			public index?: Expression
		) {
			super();
		}
	}

	export class UnaryNode extends Expression {
		constructor(
			public operator: string,
			public value: Expression
		) {
			super();
		}
	}

	export class BinaryNode extends Expression {
		constructor(
			public left: Expression,
			public operator: string,
			public right: Expression
		) {
			super();
		}
	}

	export class Call extends Expression {
		constructor(
			public name: Token,
			public args: Expression[]
		) {
			super();
		}
	}
}


const DELIMITERS = new Set([":", "(", ")", ",", "+", "|", "#"]);

export function tokenize(source: string, file: string = ""):
	{ tokens: Token[], eof: Token } {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		while (pos < source.length) {
			const char = source[pos];
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

		if (DELIMITERS.has(source[pos])) {
			tokens.push(new Token(source[pos], row, column, file));
			advance();
			continue;
		}

		let text = "";
		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char) || DELIMITERS.has(char)) {
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

export class TinkaParser extends Parser<ParseResult> {
	private kueList: Token[] = [];
	private xokList: Token[] = [];
	private globalVariables: VariableDeclaration[] = [];
	private initializeStatements: Statement[] = [];
	private cersvaList: Cersva[] = [];
	private hasMain: boolean = false;

	protected parseRoot(): ParseResult {
		while (this.isNotEOF()) {
			this.try(() => {
				this.parseDefinition();
			});
		}
		return {
			kueList: this.kueList,
			xokList: this.xokList,
			variables: this.globalVariables,
			initializeStatements: this.initializeStatements,
			cersvaList: this.cersvaList,
			hasMain: this.hasMain
		};
	}

	private parseDefinition() {
		const token = this.take();
		if (token.text == "kue") {
			this.kueList.push(this.parseLabel());
			return;
		}
		if (token.text == "xok") {
			this.xokList.push(this.parseLabel(true));
			return;
		}
		if (token.text == "anax") {
			const anax = this.parseAnaxContent();
			this.globalVariables.push(anax.variable);
			if (anax.statement) {
				this.initializeStatements.push(anax.statement);
			}
			return;
		}
		if (token.text == "cersva") {
			const name = this.parseCersvaName(true);

			this.takeString("(");
			let args: Token[] = [];
			if (!this.takeIfString(")")) {
				while (true) {
					const arg = this.take();
					if (arg == this.eof) {
						throw new ParseError("Argument expected", arg);
					}
					args.push(arg);
					const punc = this.take();
					if (punc.text == ")") {
						break;
					}
					if (punc.text != ",") {
						throw new ParseError("')' or ',' expected", punc);
					}
				}
			}

			const body = this.parseBlock();
			this.cersvaList.push({name, args, body});

			if (name.text == "fasal") {
				this.hasMain = true;
			}
			return;
		}
		throw new ParseError("Definition expected", token);
	}

	private parseBlock(): Block {
		this.takeString("rinyv");

		let variables: VariableDeclaration[] = [];
		let statements: Statement[] = [];
		while (this.isNotEOF()) {
			const situv = this.takeIfString("situv");
			if (situv) {
				if (statements.length == 0) {
					this.warning("Empty block", situv);
				}
				return {variables, statements};
			}

			if (this.takeIfString("anax")) {
				this.try(() => {
					const anax = this.parseAnaxContent();
					variables.push(anax.variable);
					if (anax.statement) {
						statements.push(anax.statement);
					}
				});
				continue;
			}
			this.try(() => {
				statements.push(this.parseStatement());
			});
		}
		throw new ParseError("'situv' expected", this.eof);
	}

	private parseStatement(): Statement {
		let token: Token | null;
		if (token = this.takeIfString("fi")) {
			const condition = this.parseExpression();
			const body = this.parseBlock();
			return new Statement.Fi(token, condition, body);
		}
		if (token = this.takeIfString("fal")) {
			const condition = this.parseExpression();
			const body = this.parseBlock();
			return new Statement.Fal(token, condition, body);
		}
		if (token = this.takeIfString("dosnud")) {
			return new Statement.Dosnud(token, this.parseExpression());
		}

		const exp = this.parseExpression();
		if (token = this.takeIfString("el")) {
			if (!(exp instanceof Expression.Variable)) {
				throw new ParseError("Invalid assignment", token);
			}
			return new Statement.Assign(
				token,
				exp,
				this.parseExpression()
			);
		}
		if (token = this.takeIfString("eksa")) {
			return new Statement.Assign(
				token,
				this.parseVariableExpression(),
				exp
			);
		}
		throw new ParseError("Statement expected", this.take());
	}

	private parseAnaxContent(): { variable: VariableDeclaration, statement?: Statement } {
		const name = this.take();
		if (name == this.eof) {
			throw new ParseError("Variable name expected", this.eof);
		}
		let size: number | undefined;
		if (this.takeIfString(":")) {
			const sizeToken = this.take();
			if (sizeToken == this.eof || !/^\d+$/.test(sizeToken.text)) {
				throw new ParseError("Variable size expected", sizeToken);
			}
			size = parseInt32(sizeToken.text);
		}
		const variable = {name, size};

		const elToken = this.takeIfString("el");
		if (elToken) {
			if (typeof size != "undefined") {
				this.errorWithoutThrow("Array can not be initialized", name);
			}
			const value = this.parseExpression();
			return {variable, statement: new Statement.Assign(elToken, new Expression.Variable(name), value)};
		}
		return {variable};
	}

	private parseLabel(strict: boolean = false): Token {
		const token = this.take();
		if (token != this.eof && isValidLabel(token.text)) {
			// if (strict) {
			// 	if (/^\d/.test(token.text) || isImproperCersva(token.text)) {
			// 		this.warning("Improper label name", token);
			// 	}
			// }
			return token;
		}
		throw new ParseError("Label name expected", token);
	}

	private parseCersvaName(strict: boolean = false): Token {
		const token = this.take();
		if (token != this.eof && isValidLabel(token.text) && !/^\d/.test(token.text)) {
			// if (strict && isImproperCersva(token.text)) {
			// 	this.warning("Improper cersva name", token);
			// }
			return token;
		}
		throw new ParseError("Function name expected", token);
	}

	private parseExpression(): Expression {
		let exp = this.parseBitExpression();
		let token: Token | null;
		while (token = this.takeIf(token => isCompare(token.text))) {
			exp = new Expression.BinaryNode(
				exp, token.text, this.parseBitExpression()
			);
		}
		return exp;
	}

	private parseBitExpression(): Expression {
		let exp = this.parseShiftExpression();
		let token: Token | null;
		while (token = this.takeIf(token => token.text == "ada" || token.text == "ekc" || token.text == "dal")) {
			exp = new Expression.BinaryNode(
				exp, token.text, this.parseShiftExpression()
			);
		}
		return exp;
	}

	private parseShiftExpression(): Expression {
		let exp = this.parseAddExpression();
		let token: Token | null;
		while (token = this.takeIf(token => token.text == "dto" || token.text == "dtosna" || token.text == "dro" || token.text == "dRo")) {
			exp = new Expression.BinaryNode(
				exp, token.text, this.parseAddExpression()
			);
		}
		return exp;
	}

	private parseAddExpression(): Expression {
		let exp = this.parseMultiplyExpression();
		let token: Token | null;
		while (token = this.takeIf(token => token.text == "+" || token.text == "|")) {
			exp = new Expression.BinaryNode(
				exp, token.text == "+" ? "ata" : "nta", this.parseMultiplyExpression()
			);
		}
		return exp;
	}

	private parseMultiplyExpression(): Expression {
		let exp = this.parseUnaryExpression();
		let token: Token | null;
		while (token = this.takeIf(token => token.text == "lat" || token.text == "latsna")) {
			exp = new Expression.BinaryNode(
				exp, token.text, this.parseUnaryExpression()
			);
		}
		return exp;
	}

	private parseUnaryExpression(): Expression {
		const token = this.takeIf(token => token.text == "sna" || token.text == "nac");
		if (token) {
			return new Expression.UnaryNode(
				token.text,
				this.parseUnaryExpression()
			);
		}
		return this.parseAtomicExpression();
	}

	private parseAtomicExpression(): Expression {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Expression expected", this.eof);
		}

		if (/^\d+$/.test(token.text)) {
			return new Expression.Constant(parseInt32(token.text));
		}
		if (token.text == "#") {
			const nameToken = this.take();
			if (nameToken == this.eof) {
				throw new ParseError("Variable name expected", this.eof);
			}

			let index: Expression | undefined;
			if (this.takeIfString(":")) {
				index = this.parseUnaryExpression();
			}

			return new Expression.Variable(nameToken, index);
		}
		if (this.takeIfString("(")) {
			let args: Expression[] = [];
			if (!this.takeIfString(")")) {
				while (true) {
					args.push(this.parseExpression());
					const punc = this.take();
					if (punc.text == ")") {
						break;
					}
					if (punc.text != ",") {
						throw new ParseError("')' or ',' expected", punc);
					}
				}
			}
			return new Expression.Call(token, args);
		}
		throw new ParseError("Unexpected identifier", token);
	}

	private parseVariableExpression(): Expression.Variable {
		if (!this.lookaheadString("#")) {
			throw new ParseError("Variable expected", this.take());
		}
		return this.parseAtomicExpression() as Expression.Variable;
	}
}

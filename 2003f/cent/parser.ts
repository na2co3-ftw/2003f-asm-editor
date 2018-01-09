import {COMPARES, ParseError, Token} from "../types";
import {Parser} from "../parser";

export const BI_OPERATORS = [
	"ata", "nta",
	"ada", "ekc", "dal",
	"dto", "dro", "dRo", "dtosna"
];

export const TRI_OPERATORS = ["lat", "latsna"];

const KEYWORDS = [
	"nac", ...BI_OPERATORS, ...TRI_OPERATORS, ...COMPARES,
	"krz", "kRz", "ach", "roft", "ycax", "pielyn", "kinfit",
	"fal", "laf", "fi", "ol", "if", "cecio", "oicec", "<", ">"
];

const RESERVED_KEYWORDS = [
	"krzq", "kRzq", "achq", "roftq"
];

export abstract class Operation {
	constructor(public token: Token) {}
}

export namespace Operation {
	export class Number extends Operation {
		constructor(token: Token, public value: number) {
			super(token);
		}
	}

	export class Primitive extends Operation {}

	export class Fi extends Operation {
		constructor(token: Token, public mal: Operation[], public ol: Operation[] | null) {
			super(token);
		}
	}

	export class Cecio extends Operation {
		constructor(token: Token, public body: Operation[]) {
			super(token);
		}
	}

	export class Fal extends Operation {
		constructor(token: Token, public body: Operation[]) {
			super(token);
		}
	}
}

export interface Subroutine {
	name: Token;
	operations: Operation[];
}

export function tokenize(source: string, file: string = ""): {tokens: Token[], eof: Token, errors: ParseError[]} {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		let text = "";

		while (pos < source.length) {
			let char = source[pos];
			if (char == "'" && source[pos + 1] == "-") {
				advance();
				advance();
				while (source.substr(pos, 2) != "-'") {
					if (pos >= source.length) {
						const eof = new Token("", row, column, file);
						return {tokens, eof, errors: [new ParseError(`Not found "-'"`, eof)]};
					}
					advance();
				}
				advance();
				advance();
			} else if (!isWhiteSpace(char)) {
				break;
			} else {
				advance();
			}
		}
		if (pos >= source.length) {
			break;
		}

		let char = source[pos];
		if (char == "<" || char == ">") {
			tokens.push(new Token(char, row, column, file));
			advance();
			continue;
		}

		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char)) {
				break;
			}
			if (char == "'" && source[pos + 1] == "-" || char == "<" || char == ">") {
				break;
			}
			text += char;
			advance();
		}
		tokens.push(new Token(text, startRow, startColumn, file));
	}
	return {tokens, eof: new Token("", row, column, file), errors: []};

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

export class CentParser extends Parser<{operations: Operation[], subroutines: Subroutine[]}> {
	protected parseRoot(): {operations: Operation[]; subroutines: Subroutine[]} {
		let operations: Operation[] = [];
		let subroutines: Subroutine[] = [];
		while (this.isNotEOF()) {
			this.try(() => {
				if (this.lookaheadString("<")) {
					subroutines.push(this.parseSubroutine());
				} else {
					operations.push(this.parseOperation());
				}
			});
		}
		return {operations, subroutines};
	}

	private parseSubroutine(): Subroutine {
		let operations: Operation[] = [];
		this.takeString("<");

		const nameToken = this.take();
		if (nameToken == this.eof || nameToken.text == ">") {
			throw new ParseError("Subroutine name expected", nameToken);
		}
		if (/^\d*$/.test(nameToken.text) ||
			KEYWORDS.indexOf(nameToken.text) >= 0) {
			this.errorWithoutThrow("Invalid subroutine name", nameToken);
		}
		if (RESERVED_KEYWORDS.indexOf(nameToken.text) >= 0) {
			this.warning("Improper subroutine name", nameToken);
		}

		while (this.isNotEOF()) {
			if (this.takeIfString(">")) {
				if (operations.length == 0) {
					this.warning("Empty subroutine", nameToken);
				}
				return {name: nameToken, operations};
			}
			this.try(() => {
				operations.push(this.parseOperation());
			});
		}
		throw new ParseError("'>' expected", this.eof);
	}

	private parseOperation(): Operation {
		const token = this.take();
		if (/^\d+$/.test(token.text)) {
			return new Operation.Number(token, parseInt(token.text));
		}
		if (token.text == "fi") {
			let mal: Operation[] = [];
			let olToken: Token | null = null;
			while (this.isNotEOF()) {
				olToken = this.takeIfString("ol");
				if (olToken) {
					break;
				}
				if (this.takeIfString("if")) {
					if (mal.length == 0) {
						this.warning("Empty fi block", token);
					}
					return new Operation.Fi(token, mal, null);
				}
				this.try(() => {
					mal.push(this.parseOperation());
				});
			}

			if (olToken != null) {
				let ol: Operation[] = [];
				while (this.isNotEOF()) {
					if (this.takeIfString("if")) {
						if (mal.length == 0) {
							this.warning("Empty fi block", token);
						}
						if (ol.length == 0) {
							this.warning("Redundant 'ol'", olToken);
						}
						return new Operation.Fi(token, mal, ol);
					}
					this.try(() => {
						ol.push(this.parseOperation());
					});
				}
			}
			throw new ParseError("'if' expected", this.eof);
		}
		if (token.text == "cecio") {
			let body: Operation[] = [];
			while (this.isNotEOF()) {
				if (this.takeIfString("oicec")) {
					if (body.length == 0) {
						this.warning("Empty cecio block", token);
					}
					return new Operation.Cecio(token, body);
				}
				this.try(() => {
					body.push(this.parseOperation());
				});
			}
			throw new ParseError("'oicec' expected", this.eof);
		}
		if (token.text == "fal") {
			let body: Operation[] = [];
			while (this.isNotEOF()) {
				if (this.takeIfString("laf")) {
					if (body.length == 0) {
						this.warning("Empty fal block", token);
					}
					return new Operation.Fal(token, body);
				}
				this.try(() => {
					body.push(this.parseOperation());
				});
			}
			throw new ParseError("'laf' expected", this.eof);
		}
		if (token.text == "<" || token.text == ">") {
			throw new ParseError("Unexpected token", token);
		}
		return new Operation.Primitive(token);
	}
}

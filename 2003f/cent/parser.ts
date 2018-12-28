import {COMPARES, ParseError, Token} from "../types";
import {parseInt32, Parser} from "../parser";
import {isValidLabel} from "../2003lk/parser";

export const BI_OPERATORS = [
	"ata", "nta",
	"ada", "ekc", "dal",
	"dto", "dro", "dRo", "dtosna"
];

export const TRI_OPERATORS = ["lat", "latsna"];

const KEYWORDS = [
	"nac", ...BI_OPERATORS, ...TRI_OPERATORS, ...COMPARES,
	"krz", "kRz", "ach", "roft", "ycax", "pielyn", "kinfit", "tikl",
	"fal", "laf", "fi", "ol", "if", "cecio", "oicec", "<", ">",
	"kak", "krzq", "kRzq", "achq", "roftq", "malef", "felam"
];

const IMPROPER_SUBROUTINE_REGEXP = /[^FRVXa-z0-9,.?!':+|=$\\@&#"()《》_-]/;

const RESERVED_LABEL_REGEXP = /^(fal|laf|ol|if|cecio|oicec|leles-niv|leles-situv)\d+$/;

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

export interface ExternalFunction {
	name: Token;
	argNum: number;
}

export function tokenize(source: string, file: string = ""):
	{tokens: Token[], eof: Token, errors: ParseError[], warnings: ParseError[]} {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	let warnings: ParseError[] = [];
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
						return {tokens, eof, errors: [new ParseError(`Not found "-'"`, eof)], warnings};
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
		let token = new Token(text, startRow, startColumn, file);
		if (pos == source.length) {
			warnings.push(new ParseError("Ignored Token (need whitespace before EOF)", token));
		} else {
			tokens.push(token);
		}
	}
	return {tokens, eof: new Token("", row, column, file), errors: [], warnings};

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

export interface CentParsed {
	operations: Operation[],
	subroutines: Subroutine[],
	functions: ExternalFunction[]
}

function isValidSubroutine(name: string): boolean {
	return !/^\d/.test(name) && KEYWORDS.indexOf(name) < 0;
}

export class CentParser extends Parser<CentParsed> {
	private subroutines: Subroutine[] = [];
	private functions: ExternalFunction[] = [];

	protected parseRoot(): CentParsed {
		let operations: Operation[] = [];
		while (this.isNotEOF()) {
			this.try(() => {
				if (this.lookaheadString("<")) {
					this.parseSubroutineOrFunction();
				} else {
					operations.push(this.parseOperation(false));
				}
			});
		}
		return {
			operations,
			subroutines: this.subroutines,
			functions: this.functions
		};
	}

	private parseSubroutine(): Subroutine {
		let operations: Operation[] = [];
		this.takeString("<");

		const nameToken = this.take();
		if (nameToken == this.eof || nameToken.text == ">") {
			throw new ParseError("Subroutine name expected", nameToken);
		}
		if (!isValidSubroutine(nameToken.text)) {
			this.errorWithoutThrow("Invalid subroutine name", nameToken);
		}
		if (IMPROPER_SUBROUTINE_REGEXP.test(nameToken.text)) {
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
				operations.push(this.parseOperation(true));
			});
		}
		throw new ParseError("'>' expected", this.eof);
	}

	private parseFunction(): ExternalFunction {
		this.takeString("<");
		this.takeString("xok");

		const nameToken = this.take();
		if (nameToken == this.eof || nameToken.text == ">") {
			throw new ParseError("Function name expected", nameToken);
		}
		if (!isValidSubroutine(nameToken.text) ||
			!isValidLabel(nameToken.text)) {
			this.errorWithoutThrow("Invalid function name", nameToken);
		}
		if (RESERVED_LABEL_REGEXP.test(nameToken.text)) {
			this.warning("Improper function name", nameToken);
		}

		const argNumToken = this.take();
		if (argNumToken == this.eof || nameToken.text == ">") {
			throw new ParseError("Number of arguments expected", argNumToken);
		}
		if (!/^\d+$/.test(argNumToken.text)) {
			this.errorWithoutThrow("Invalid number of arguments", argNumToken);
		}

		this.takeString(">");

		return {name: nameToken, argNum: parseInt32(argNumToken.text)};
	}

	private parseSubroutineOrFunction(block: string | null = null) {
		if (this.lookaheadString("xok", 2)) {
			const func = this.parseFunction();
			this.functions.push(func);
			if (block) {
				this.warning(`Function should not defined in '${block}'`, func.name);
			}
		} else {
			const sub = this.parseSubroutine();
			this.subroutines.push(sub);
			if (block) {
				this.warning(`Subroutine should not defined in '${block}'`, sub.name);
			}
		}
	}

	private parseOperation(inSubroutine: boolean): Operation {
		const token = this.take();
		if (/^\d+$/.test(token.text)) {
			return new Operation.Number(token, parseInt32(token.text));
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
					if (!inSubroutine && this.lookaheadString("<")) {
						this.parseSubroutineOrFunction("fi");
					} else {
						mal.push(this.parseOperation(inSubroutine));
					}
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
						if (!inSubroutine && this.lookaheadString("<")) {
							this.parseSubroutineOrFunction("fi");
						} else {
							ol.push(this.parseOperation(inSubroutine));
						}
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
					if (!inSubroutine && this.lookaheadString("<")) {
						this.parseSubroutineOrFunction("cecio");
					} else {
						body.push(this.parseOperation(inSubroutine));
					}
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
					if (!inSubroutine && this.lookaheadString("<")) {
						this.parseSubroutineOrFunction("fal");
					} else {
						body.push(this.parseOperation(inSubroutine));
					}
				});
			}
			throw new ParseError("'laf' expected", this.eof);
		}
		if (token.text == "<" || token.text == ">") {
			throw new ParseError(`Unexpected '${token.text}'`, token);
		}
		return new Operation.Primitive(token);
	}
}

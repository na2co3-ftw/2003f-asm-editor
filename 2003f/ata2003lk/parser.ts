import {
	COMPARES, CompileResult, isRegister, ParseError, Token,
	WritableValue
} from "../types";
import {BINARY_OPERATORS, TERNARY_OPERATORS, V} from "../builder";
import {AsmParser, isValidLabel} from "../2003lk/parser";

const RESERVED_KEYWORDS = [
	"nll", "l'", "kue", "xok",
	"fen", "nac", ...BINARY_OPERATORS, "kak", ...TERNARY_OPERATORS, ...COMPARES,
	"fi", "inj",
	"zali", "ycax", "fenx", "cers", "dosn", "lar", "ral"
];

const RESERVED_LABEL_REGEXP = /^(lar(-sit)?)\d+$/;

export function fullCompile(str: string, file: string = ""): CompileResult {
	const {tokens, eof} = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const {root, errors, warnings} = new AtaAsmParser(tokens, eof, file).parse();
	return {data: root, errors, warnings};
}

function tokenize(source: string, file: string = ""): {tokens: Token[], eof: Token} {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		while (pos < source.length) {
			let char = source[pos];
			if (char == ";") {
				advance();
				while (pos < source.length && source[pos] != ";") {
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

		let char = source[pos];
		if (char == "@") {
			tokens.push(new Token("@", row, column, file));
			advance();
			continue;
		} else if (char == "+") {
			tokens.push(new Token("+", row, column, file));
			advance();
			continue;
		}

		let text = "";
		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char) || char == "@" || char == "+" || char == ";") {
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
	return char.search(/\s/) >= 0;
}

class AtaAsmParser extends AsmParser {
	private larCount = 0;
	private larSitCount = 0;
	private larToken: Token[] = [];
	private ral0: Token | null = null;
	private internalLabels = new Set<string>();

	constructor(tokens: Token[], eof: Token, name: string) {
		super(tokens, eof, name);
		this.explicitSpecifiedOrder = true;
	}

	protected parseExtraInstruction(token: Token): boolean {
		if (token.text == "zali") {
			this.builder.nta(V.imm(4), V.f5);
			this.builder.krz(this.parseOperand(), V.f5io);
		} else if (token.text == "ycax") {
			this.builder.ata(V.imm(4), V.f5);
		} else if (token.text == "fenx") {
			this.builder.nta(V.imm(4), V.f5);
			this.builder.inj(this.parseOperand(), V.xx, V.f5io);
			this.builder.ata(V.imm(4), V.f5);
		} else if (token.text == "dosn") {
			this.builder.krz(V.f5io, V.xx);
		} else if (token.text == "lar") {
			this.larCount++;
			this.larToken[this.larCount] = token;
			this.defineInternalLabel("lar" + this.larCount);
			this.builder.nll("lar" + this.larCount);
			this.builder.fi(this.parseOperand(), this.parseOperand(), this.parseCompare());
			this.builder.malkrz(V.label("lar-sit" + this.larCount), V.xx);
		} else if (token.text == "ral") {
			if (this.larCount == 0) {
				this.ral0 = token;
			} else if (this.larSitCount == this.larCount) {
				throw new ParseError("Duplicating 'ral'", token);
			}
			this.larSitCount = this.larCount;
			this.builder.krz(V.label("lar" + this.larSitCount), V.xx);
			this.defineInternalLabel("lar-sit" + this.larSitCount);
			this.builder.nll("lar-sit" + this.larSitCount);
			this.builder.fen();
		} else {
			return false;
		}
		return true;
	}

	protected parseExtraDirective(token: Token): boolean {
		if (token.text == "'c'i" || token.text == "'i'c" ) {
			throw new ParseError("Instruction expected", token);
		}
		if (token.text == "cers") {
			const label = this.parseLabel(true);
			this.defineLabel(label);
			this.builder.nll(label.text);
			return true;
		}
		return false;
	}

	protected parseExtraWritableOperand(token: Token): WritableValue | null {
		if (token.text == "s") {
			if (this.takeIfString("@")) {
				const dispToken = this.take();
				if (isRegister(dispToken.text)) {
					return V.indRegReg("f5", dispToken.text);
				} else if (/^\d+$/.test(dispToken.text)) {
					return V.indRegDisp("f5", parseInt(dispToken.text));
				}
				throw new ParseError("Invalid displacement", dispToken);
			}
		}
		return null;
	}

	protected parseLabel(strict: boolean = false): Token {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Label name expected", token);
		}
		if (isValidLabel(token.text)) {
			if (strict) {
				if (RESERVED_KEYWORDS.indexOf(token.text) >= 0 ||
					RESERVED_LABEL_REGEXP.test(token.text)) {
					this.warning("Improper label name", token);
				}
			}
			return token;
		}
		throw new ParseError("Invalid label name", token);
	}

	protected defineInternalLabel(label: string) {
		const definedLabel = this.labelDefinitions.get(label);
		if (definedLabel) {
			this.errorWithoutThrow(`'${label}' is defined internally`, definedLabel);
			this.labelDefinitions.delete(label);
		}
		this.internalLabels.add(label);
	}

	protected defineLabel(token: Token) {
		if (this.internalLabels.has(token.text)) {
			this.errorWithoutThrow(`'${token.text}' is defined internally`, token);
		} else {
			super.defineLabel(token);
		}
	}

	protected verify() {
		if (this.ral0) {
			if (this.labelDefinitions.has("lar0")) {
				this.warning("Not found corresponding 'lar'", this.ral0);
			} else {
				this.errorWithoutThrow("Not found corresponding 'lar'", this.ral0);
			}
		}
		for (let i = 1; i <= this.larCount; i++) {
			if (!this.internalLabels.has("lar-sit" + i)) {
				if (this.labelDefinitions.has("lar-sit" + i)) {
					this.warning("Not found corresponding 'ral'", this.larToken[i]);
				} else {
					this.errorWithoutThrow("Not found corresponding 'ral'", this.larToken[i]);
				}
			}
		}

		for (const [label, tokens] of this.labelUses) {
			const def = this.labelDefinitions.has(label);
			if (!def) {
				const internal = this.internalLabels.has(label);
				for (const token of tokens) {
					if (internal) {
						this.warning(`Internal label '${label}' should not be used`, token);
					} else {
						this.errorWithoutThrow(`'${label}' is not defined`, token);
					}
				}
			} else {
				this.labelDefinitions.delete(label);
			}
		}
		for (const [label, token] of this.labelDefinitions.entries()) {
			if (label == "lar0" && this.ral0) {
				continue;
			}
			if (label.startsWith("lar-sit")) {
				const count = label.substr(7);
				if (/\d+/.test(count)) {
					const countInt = parseInt(count);
					if (1 <= countInt && countInt <= this.larCount) {
						continue;
					}
				}
			}
			this.warning(`'${label}' is defined but not used`, token);
		}
	}
}

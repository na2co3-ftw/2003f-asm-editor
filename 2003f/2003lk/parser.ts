import {
	AsmModule, Compare, COMPARES, CompileResult, isCompare, isRegister, ParseError, Token, Value,
	WritableValue
} from "../types";
import {AsmBuilder, BINARY_OPERATORS, BuilderError, TERNARY_OPERATORS, V} from "../builder";
import {parseInt32, Parser} from "../parser";
import {literalText} from "../../i18n/text";
import {ParserText} from "../../i18n/parser-text";

const RESERVED_REGISTERS = [
	"f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "xx"
];

const RESERVED_KEYWORDS = [
	"'c'i", "'i'c", "nll", "l'", "kue", "xok",
	"fen", "nac", ...BINARY_OPERATORS, "kak", ...TERNARY_OPERATORS, ...COMPARES,
	"fi", "inj"
];

export function fullCompile(str: string, file: string = ""): CompileResult {
	const {tokens, eof} = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const {root, errors, warnings} = new AsmParser(tokens, eof, file).parse();
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

export function isValidLabel(name: string): boolean {
	return (
		name.search(/^\d*$/) < 0 &&
		RESERVED_REGISTERS.indexOf(name) < 0 &&
		name.search(/^[FRVXa-z0-9'_-]+$/) >= 0
	);
}

export class AsmParser extends Parser<AsmModule> {
	private builder: AsmBuilder;
	private isCI = false;
	private explicitSpecifiedOrder = false;
	private previousInstToken: Token | null = null;
	private previousDirectiveToken: Token | null = null;
	private afterFi = false;
	private afterMalkrz = false;
	private afterNll = false;
	private afterDirective = false;

	private labelDefinitions = new Map<string, Token>();
	private labelUses = new Map<string, Token[]>();

	constructor(tokens: Token[], eof: Token, name: string) {
		super(tokens, eof);
		this.builder = new AsmBuilder(name);
	}

	protected parseRoot(): AsmModule {
		this.builder.setHasMain(true);
		while (this.isNotEOF()) {
			this.try(() => {
				this.parseInstruction();
			});
		}

		this.verify();

		try {
			return this.builder.getAsmModule();
		} catch (e) {
			if (e instanceof BuilderError) {
				throw new ParseError(literalText(e.message), this.eof);
			} else {
				throw e;
			}
		}
	}

	private parseInstruction() {
		const token = this.take();
		this.builder.setNextToken(token);

		if (this.parseDirective(token)) {
			return;
		}
		if (this.parseLifem(token)) {
			return;
		}

		if (token.text == "fen") {
			this.builder.fen();
		} else if (token.text == "nac") {
			this.builder.nac(this.parseWritableOperand());
		} else if (AsmBuilder.isBinOp(token.text)) {
			let src, dst;
			if (this.isCI) {
				dst = this.parseWritableOperand();
				src = this.parseOperand();
			} else {
				src = this.parseOperand();
				dst = this.parseWritableOperand();
			}
			this.builder.binOp(token.text, src, dst);
		} else if (AsmBuilder.isTriOp(token.text)) {
			let src, dstl, dsth;
			if (this.isCI) {
				dstl = this.parseWritableOperand();
				dsth = this.parseWritableOperand();
				src = this.parseOperand();
			} else {
				src = this.parseOperand();
				dstl = this.parseWritableOperand();
				dsth = this.parseWritableOperand();
			}
			if (operandDepends(dstl, dsth)) {
				this.warning(ParserText.undefined_behavior, token); // TODO: show warning at operand dstl
			}
			this.builder.triOp(token.text, src, dstl, dsth);
		} else if (token.text == "fi") {
			this.builder.fi(this.parseOperand(), this.parseOperand(), this.parseCompare());
		} else if (token.text == "inj") {
			let a, b, c;
			if (this.isCI) {
				c = this.parseWritableOperand();
				b = this.parseWritableOperand();
				a = this.parseOperand();
			} else {
				a = this.parseOperand();
				b = this.parseWritableOperand();
				c = this.parseWritableOperand();
			}
			if (operandDepends(c, b)) {
				this.warning(ParserText.undefined_behavior, token); // TODO: show warning at operand c
			}
			this.builder.inj(a, b, c);
		} else {
			throw new ParseError(ParserText.instruction_expected, token);
		}

		if (!this.explicitSpecifiedOrder) {
			this.warning(ParserText.operand_order_should_be_specified, token);
			this.explicitSpecifiedOrder = true; // Show this warning only once
		}
		if (token.text == "malkrz" || token.text == "malkRz") {
			if (!this.afterFi) {
				this.warning(ParserText.malkrz_should_follow_fi, token);
			}
			if (this.afterNll) {
				this.warning(ParserText.malkrz_should_not_be_labeled, this.previousDirectiveToken);
			}
		} else if (this.afterFi) {
			this.warning(ParserText.fi_should_be_followed_by_malkrz, this.previousInstToken);
		}

		this.previousInstToken = token;
		this.afterFi = token.text == "fi";
		this.afterMalkrz = token.text == "malkrz" || token.text == "malkRz";
		this.afterNll = false;
		this.afterDirective = false;
	}

	private parseDirective(token: Token) {
		if (token.text == "'c'i") {
			this.isCI = true;
			this.explicitSpecifiedOrder = true;
		} else if (token.text == "'i'c") {
			this.isCI = false;
			this.explicitSpecifiedOrder = true;
		} else if (token.text == "nll") {
			const label = this.parseLabel(true);
			this.defineLabel(label);
			this.builder.nll(label.text);
		} else if (token.text == "l'") {
			try {
				const label = this.parseLabel(true);
				this.defineLabel(label);
				this.builder.l(label.text);
				if (this.afterDirective) {
					this.warning(ParserText.l_should_be_directly_preceded_by_an_instruction, token);
				} else if (this.afterMalkrz) {
					this.warning(ParserText.malkrz_should_not_be_labeled, token);
				}
			} catch (e) {
				if (e instanceof BuilderError) {
					throw new ParseError(literalText(e.message), token);
				} else {
					throw e;
				}
			}
		} else if (token.text == "kue") {
			const label = this.parseLabel();
			this.useLabel(label);
			this.builder.kue(label.text, label);
			this.builder.setHasMain(false);
		} else if (token.text == "xok") {
			const label = this.parseLabel(true);
			this.defineLabel(label);
			this.builder.xok(label.text, label);
		} else {
			return false;
		}

		if (this.afterNll) {
			this.warning(ParserText.nll_should_be_directly_followed_by_an_instruction, token);
		}
		this.previousDirectiveToken = token;
		this.afterNll = token.text == "nll";
		this.afterDirective = true;
		return true;
	}

	private parseLifem(token: Token): boolean {
		let size: number;
		if (token.text == "lifem") {
			size = 4;
		} else if (token.text == "lifem16") {
			size = 2;
		} else if (token.text == "lifem8") {
			size = 1;
		} else {
			return false;
		}

		const valueToken = this.take();
		if (valueToken == this.eof) {
			throw new ParseError(ParserText.value_expected, this.eof);
		}
		if (/^\d+$/.test(valueToken.text)) {
			this.builder.addValue(parseInt32(valueToken.text), size);
		} else if (isValidLabel(valueToken.text)) {
			this.useLabel(valueToken);
			this.builder.addValue(valueToken.text, size);
		} else {
			throw new ParseError(ParserText.invalid_value, valueToken);
		}

		if (this.afterFi) {
			this.warning(ParserText.fi_should_be_followed_by_malkrz, this.previousInstToken);
		}
		this.afterFi = false;
		this.afterMalkrz = false;
		this.afterNll = false;
		this.afterDirective = false;
		return true;
	}

	private parseOperand(writable: boolean = false): Value {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError(ParserText.operand_expected, this.eof);
		}

		if (isRegister(token.text)) {
			if (this.takeIfString("+")) {
				const dispToken = this.take();
				if (isRegister(dispToken.text)) {
					this.takeString("@");
					return V.indRegReg(token.text, dispToken.text);
				} else if (/^\d+$/.test(dispToken.text)) {
					this.takeString("@");
					return V.indRegDisp(token.text, parseInt32(dispToken.text));
				}
				throw new ParseError(ParserText.invalid_displacement, dispToken);
			} else if (this.takeIfString("@")) {
				return V.indReg(token.text);
			} else {
				return V.reg(token.text);
			}
		}
		if (isValidLabel(token.text)) {
			this.useLabel(token);
			if (this.takeIfString("+")) {
				const dispToken = this.take();
				if (isRegister(dispToken.text)) {
					if (this.takeIfString("+")) {
						const disp2Token = this.take();
						if (!/^\d+$/.test(disp2Token.text)) {
							throw new ParseError(ParserText.invalid_displacement, disp2Token);
						}
						this.takeString("@");
						return V.indLabelRegDisp(token.text, dispToken.text, parseInt32(disp2Token.text));
					} else {
						this.takeString("@");
						return V.indLabelReg(token.text, dispToken.text);
					}
				} else if (/^\d+$/.test(dispToken.text)) {
					if (this.takeIfString("+")) {
						const disp2Token = this.take();
						if (!isRegister(disp2Token.text)) {
							throw new ParseError(ParserText.invalid_displacement, disp2Token);
						}
						this.takeString("@");
						return V.indLabelRegDisp(token.text, disp2Token.text, parseInt32(dispToken.text));
					} else {
						this.takeString("@");
						return V.indLabelDisp(token.text, parseInt32(dispToken.text));
					}
				}
				throw new ParseError(ParserText.invalid_displacement, dispToken);
			} else if (this.takeIfString("@")) {
				return V.indLabel(token.text);
			} else if (!writable) {
				return V.label(token.text);
			}
		}
		if (writable) {
			throw new ParseError(ParserText.invalid_operand_to_write, token);
		}

		if (/^\d+$/.test(token.text)) {
			return V.imm(parseInt32(token.text));
		}
		throw new ParseError(ParserText.invalid_operand, token);
	}

	private parseWritableOperand(): WritableValue {
		return this.parseOperand(true) as WritableValue;
	}

	private parseCompare(): Compare {
		const token = this.take();
		if (token != this.eof && isCompare(token.text)) {
			return token.text;
		}
		throw new ParseError(ParserText.compare_keyword_expected, token);
	}

	private parseLabel(strict: boolean = false): Token {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError(ParserText.label_name_expected, token);
		}
		if (isValidLabel(token.text)) {
			if (strict) {
				if (RESERVED_KEYWORDS.indexOf(token.text) >= 0) {
					this.warning(ParserText.deprecated_label_name, token);
				}
			}
			return token;
		}
		throw new ParseError(ParserText.invalid_label_name, token);
	}

	private defineLabel(token: Token) {
		const definedLabel = this.labelDefinitions.get(token.text);
		if (definedLabel) {
			this.errorWithoutThrow(ParserText.already_defined(token.text), token);
		} else {
			this.labelDefinitions.set(token.text, token);
		}
	}

	private useLabel(token: Token) {
		let uses = this.labelUses.get(token.text);
		if (uses) {
			uses.push(token);
		} else {
			this.labelUses.set(token.text, [token]);
		}
	}

	private verify() {
		for (const [label, tokens] of this.labelUses) {
			const def = this.labelDefinitions.has(label);
			if (!def) {
				for (const token of tokens) {
					this.errorWithoutThrow(ParserText.undefined(label), token);
				}
			} else {
				this.labelDefinitions.delete(label);
			}
		}
		for (const [label, token] of this.labelDefinitions.entries()) {
			this.warning(ParserText.unused(label), token);
		}

		if (this.afterFi) {
			this.warning(ParserText.fi_should_be_followed_by_malkrz, this.previousInstToken);
		}
	}
}

function operandDepends(mem: Value, reg: Value): boolean {
	if (reg.type != "Reg") {
		return false;
	}
	if (mem.type == "IndReg") {
		return mem.reg == reg.reg;
	}
	if (mem.type == "IndRegDisp") {
		return mem.reg == reg.reg;
	}
	if (mem.type == "IndRegReg") {
		return mem.reg1 == reg.reg || mem.reg2 == reg.reg;
	}
	return false;
}

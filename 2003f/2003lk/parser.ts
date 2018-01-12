import {
	AsmModule, Compare, COMPARES, CompileResult, isCompare, isRegister, ParseError, Token, Value,
	WritableValue
} from "../types";
import {AsmBuilder, BINARY_OPERATORS, BuilderError, TERNARY_OPERATORS, V} from "../builder";
import {Parser} from "../parser";

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
		name.search(/^[pFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]+$/) >= 0
	);
}

class AsmParser extends Parser<AsmModule> {
	private builder: AsmBuilder;
	private isCI = false;

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

		for (const [label, tokens] of this.labelUses) {
			const def = this.labelDefinitions.has(label);
			if (!def) {
				for (const token of tokens) {
					this.errorWithoutThrow(`'${label}' is not defined`, token);
				}
			} else {
				this.labelDefinitions.delete(label);
			}
		}
		for (const [label, token] of this.labelDefinitions.entries()) {
			this.warning(`'${label}' is defined but not used`, token);
		}

		try {
			return this.builder.getAsmModule();
		} catch (e) {
			if (e instanceof BuilderError) {
				throw new ParseError(e.message, this.eof);
			} else {
				throw e;
			}
		}
	}

	parseInstruction() {
		const token = this.take();
		this.builder.setNextToken(token);
		if (token.text == "'c'i") {
			this.isCI = true;
		} else if (token.text == "'i'c") {
			this.isCI = false;
		} else if (token.text == "fen") {
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
			this.builder.inj(a, b, c);
		} else if (token.text == "nll") {
			const label = this.parseLabel();
			this.defineLabel(label);
			this.builder.nll(label.text);
		} else if (token.text == "l'") {
			try {
				const label = this.parseLabel();
				this.defineLabel(label);
				this.builder.l(label.text);
			} catch (e) {
				if (e instanceof BuilderError) {
					throw new ParseError(e.message, token);
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
			const label = this.parseLabel();
			this.defineLabel(label);
			this.builder.xok(label.text, label);
		} else {
			throw new ParseError("Instruction expected", token);
		}
	}

	private parseOperand(writable: boolean = false): Value {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Operand expected", this.eof);
		}

		if (isRegister(token.text)) {
			if (this.takeIfString("+")) {
				const dispToken = this.take();
				if (isRegister(dispToken.text)) {
					this.takeString("@");
					return V.indRegReg(token.text, dispToken.text);
				} else if (/^\d+$/.test(dispToken.text)) {
					this.takeString("@");
					return V.indRegDisp(token.text, parseInt(dispToken.text));
				}
				throw new ParseError("Invalid displacement", dispToken);
			} else if (this.takeIfString("@")) {
				return V.indReg(token.text);
			} else {
				return V.reg(token.text);
			}
		}
		if (writable) {
			throw new ParseError("Invalid operand to write value", token);
		}

		if (/^\d+$/.test(token.text)) {
			return V.imm(parseInt(token.text));
		}
		if (isValidLabel(token.text)) {
			this.useLabel(token);
			return V.label(token.text);
		}
		throw new ParseError("Invalid operand", token);
	}

	private parseWritableOperand(): WritableValue {
		return this.parseOperand(true) as WritableValue;
	}

	private parseCompare(): Compare {
		const token = this.take();
		if (token != this.eof && isCompare(token.text)) {
			return token.text;
		}
		throw new ParseError("Compare keyword expected", token);
	}

	private parseLabel(strict: boolean = false): Token {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Label name expected", token);
		}
		if (isValidLabel(token.text)) {
			if (strict) {
				if (RESERVED_KEYWORDS.indexOf(token.text) >= 0) {
					this.warning("Improper label name", token);
				}
			}
			return token;
		}
		throw new ParseError("Invalid label name", token);
	}

	private defineLabel(token: Token) {
		const definedLabel = this.labelDefinitions.get(token.text);
		if (definedLabel) {
			this.errorWithoutThrow(`'${token.text}' is already defined`, token);
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
}

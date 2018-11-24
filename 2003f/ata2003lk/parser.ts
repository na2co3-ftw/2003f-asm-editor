import {Compare, COMPARES, isCompare, ParseError, Register, Token, Value, WritableValue} from "../types";
import {AsmBuilder, BINARY_OPERATORS, TERNARY_OPERATORS, V} from "../builder";
import {parseInt32, Parser} from "../parser";

export type AtaInst =
	NullaryInst | UnaryReadonlyInst | UnaryInst | BinaryInst | TernaryInst |
	CompareInst | LarInst | RalInst | LabelDirective | ValueDirective;

interface NullaryInst {
	type: "nullary";
	token: Token;
	opcode: string;
}

interface UnaryReadonlyInst {
	type: "unaryRead";
	token: Token;
	opcode: string;
	src: Value;
}

interface UnaryInst {
	type: "unary";
	token: Token;
	opcode: string;
	dst: WritableValue;
}

interface BinaryInst {
	type: "binary";
	token: Token;
	opcode: string;
	src: Value;
	dst: WritableValue;
}

interface TernaryInst {
	type: "ternary";
	token: Token;
	opcode: string;
	src: Value;
	dst1: WritableValue;
	dst2: WritableValue;
}

interface CompareInst {
	type: "fi";
	token: Token;
	a: Value;
	b: Value;
	compare: Compare;
}

interface LarInst {
	type: "lar";
	token: Token;
	a: Value;
	b: Value;
	compare: Compare;
	id: number;
}

interface RalInst {
	type: "ral";
	token: Token;
	id: number;
}

interface LabelDirective {
	type: "label";
	token: Token;
	opcode: string;
	label: Token;
}

interface ValueDirective {
	type: "value";
	token: Token;
	value: number | string;
	size: number
}

const SUPPORTED_REGISTERS = ["f0", "f1", "f2", "f3", "f5"];

const RESERVED_KEYWORDS = [
	"nll", "l'", "kue", "xok", "xx",
	"lifem", "lifem16", "lifem8",
	"fen", "nac", ...BINARY_OPERATORS, "kak", ...TERNARY_OPERATORS, ...COMPARES,
	"fi", "inj",
	"dosn", "zali", "ycax", "dus", "maldus", "fenx", "cers", "lar", "ral"
];

const RESERVED_LABEL_REGEXP = /^--(lar--(sit--)?)\d+$/;

const TVARLON_KNLOAN_ADDRESS = 0xba5fb6b0 | 0;

export function tokenize(source: string, file: string = ""):
	{ tokens: Token[], eof: Token, errors: ParseError[] } {
	let pos = 0;
	let row = 0;
	let column = 0;
	let tokens: Token[] = [];
	while (true) {
		while (pos < source.length) {
			let char = source[pos];
			if (char == ";") {
				advance();
				while (source[pos] != ";") {
					if (pos >= source.length) {
						const eof = new Token("", row, column, file);
						return {tokens, eof, errors: [new ParseError("Not found ';'", eof)]};
					}
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
		if (char == "@" || char == "+" || char == "|") {
			tokens.push(new Token(char, row, column, file));
			advance();
			continue;
		}

		let text = "";
		const startRow = row;
		const startColumn = column;
		while (pos < source.length) {
			let char = source[pos];
			if (isWhiteSpace(char) || char == "@" || char == "+" || char == "|" || char == ";") {
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
	return char.search(/\s/) >= 0;
}

function isSupportedRegister(reg: string): reg is Register {
	return SUPPORTED_REGISTERS.indexOf(reg) >= 0;
}

function isValidLabel(name: string): boolean {
	return (
		name.search(/^\d*$/) < 0 &&
		!isSupportedRegister(name) &&
		name.search(/^[FRVXa-z0-9'_-]+$/) >= 0
	);
}

export class AtaAsmParser extends Parser<{ instructions: AtaInst[], externalLabels: Set<string> }> {
	private instructions: AtaInst[] = [];
	private externalLabels = new Set<string>();

	private instId = 0;
	private previousInstToken: Token | null = null;
	private previousDirectiveToken: Token | null = null;
	private afterFi = false;
	private afterMalkrz = false;
	private afterNll = false;
	private afterCers = false;
	private afterDirective = false;

	private labelDefinitions = new Map<string, Token>();
	private labelUses = new Map<string, Token[]>();
	private larStack: number[] = [];
	private internalLabels = new Set<string>();

	protected parseRoot(): { instructions: AtaInst[], externalLabels: Set<string> } {
		while (this.isNotEOF()) {
			this.try(() => {
				this.parseInstruction();
			});
		}

		this.verify();

		return {
			instructions: this.instructions,
			externalLabels: this.externalLabels
		};
	}

	private parseInstruction() {
		const token = this.take();
		this.instId++;

		if (this.parseDirective(token)) {
			return;
		} else if (this.parseLifem(token)) {
			return;
		} else if (token.text == "fen" || token.text == "dosn") {
			this.instructions.push({
				type: "nullary",
				token: token,
				opcode: token.text
			});
		} else if (token.text == "nac") {
			this.instructions.push({
				type: "unary",
				token: token,
				opcode: token.text,
				dst: this.parseWritableOperand()
			});
		} else if (token.text == "ycax") {
			const value = this.parseWritableOrImmOperand();
			if (value.type == "Imm") {
				this.instructions.push({
					type: "unaryRead",
					token: token,
					opcode: token.text,
					src: value
				});
			} else {
				this.instructions.push({
					type: "unary",
					token: token,
					opcode: token.text,
					dst: value
				});
			}
		} else if (token.text == "zali" || token.text == "dus" || token.text == "maldus") {
			this.instructions.push({
				type: "unaryRead",
				token: token,
				opcode: token.text,
				src: this.parseOperand()
			});
		} else if (token.text == "fenx") {
			this.instructions.push({
				type: "unaryRead",
				token: token,
				opcode: token.text,
				src: this.parseLabelOperand()
			});
		} else if (AsmBuilder.isBinOp(token.text)) {
			this.instructions.push({
				type: "binary",
				token: token,
				opcode: token.text,
				src: this.parseOperand(),
				dst: this.parseWritableOperand()
			});
		} else if (AsmBuilder.isTriOp(token.text)) {
			const src = this.parseOperand();
			const dstl = this.parseWritableOperand();
			const dsth = this.parseWritableOperand();
			if (operandDepends(dstl, dsth)) {
				this.warning("Undefined behavior", token); // TODO: show warning at operand dstl
			}
			this.instructions.push({
				type: "ternary",
				token: token,
				opcode: token.text,
				src: src,
				dst1: dstl,
				dst2: dsth
			});
		} else if (token.text == "inj") {
			const a = this.parseOperand();
			const b = this.parseWritableOperand();
			const c = this.parseWritableOperand();
			if (operandDepends(c, b)) {
				this.warning("Undefined behavior", token); // TODO: show warning at operand c
			}
			this.instructions.push({
				type: "ternary",
				token: token,
				opcode: token.text,
				src: a,
				dst1: b,
				dst2: c
			});
		} else if (token.text == "fi") {
			this.instructions.push({
				type: "fi",
				token: token,
				a: this.parseOperand(),
				b: this.parseOperand(),
				compare: this.parseCompare()
			});
		} else if (token.text == "lar") {
			this.larStack.push(this.instId);
			this.internalLabels.add("--lar--" + this.instId);
			this.instructions.push({
				type: "lar",
				token: token,
				a: this.parseOperand(),
				b: this.parseOperand(),
				compare: this.parseCompare(),
				id: this.instId,
			});
		} else if (token.text == "ral") {
			const id = this.larStack.pop();
			if (typeof id == "undefined") {
				throw new ParseError("Unexpected 'ral'", token);
			}
			this.internalLabels.add("--lar--sit--" + id);
			this.instructions.push({
				type: "ral",
				token: token,
				id
			});
		} else {
			throw new ParseError("Instruction expected", token);
		}

		if (token.text == "malkrz" || token.text == "malkRz" || token.text == "maldus") {
			if (!this.afterFi) {
				this.warning(`'${token.text}' should follow 'fi'`, token);
			}
			if (this.afterNll || this.afterCers) {
				this.warning(`'${token.text}' should not be labeled`, this.previousDirectiveToken);
			}
		} else if (this.afterFi) {
			this.warning(`'fi' should be followed by 'malkrz' or 'maldus'`, this.previousInstToken);
		}

		this.previousInstToken = token;
		this.afterFi = token.text == "fi";
		this.afterMalkrz = token.text == "malkrz" || token.text == "malkRz" || token.text == "maldus";
		this.afterNll = false;
		this.afterCers = false;
		this.afterDirective = false;
	}

	private parseDirective(token: Token) {
		if (token.text == "nll" || token.text == "cers") {
			const label = this.parseLabel(true);
			this.defineLabel(label);

			this.instructions.push({
				type: "label",
				token: token,
				opcode: token.text,
				label: label
			});
		} else if (token.text == "l'") {
			const label = this.parseLabel(true);
			this.defineLabel(label);
			if (this.afterDirective) {
				this.warning("l' should be directly preceded by an instruction", token);
			} else if (this.afterMalkrz) {
				this.warning(`'${this.previousInstToken!.text}' should not be labeled`, token);
			}

			this.instructions.push({
				type: "label",
				token: token,
				opcode: token.text,
				label: label
			});
		} else if (token.text == "kue") {
			const label = this.parseLabel(false, true);
			this.useLabel(label);
			this.externalLabels.add(label.text);

			this.instructions.push({
				type: "label",
				token: token,
				opcode: token.text,
				label: label
			});
		} else if (token.text == "xok") {
			const label = this.parseLabel(true, true);
			this.defineLabel(label);
			this.externalLabels.add(label.text);

			this.instructions.push({
				type: "label",
				token: token,
				opcode: token.text,
				label: label,
			});
		} else {
			return false;
		}

		if (this.afterNll) {
			this.warning("'nll' should be directly followed by an instruction", token);
		}
		this.previousDirectiveToken = token;
		this.afterNll = token.text == "nll";
		this.afterCers = token.text == "cers";
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
			throw new ParseError("Value expected", this.eof);
		}

		let value: number | string;
		if (/^\d+$/.test(valueToken.text)) {
			value = parseInt32(valueToken.text);
		} else if (valueToken.text == "tvarlon-knloan") {
			value = TVARLON_KNLOAN_ADDRESS;
		} else if (isValidLabel(valueToken.text)) {
			this.useLabel(valueToken);
			value = valueToken.text;
		} else {
			throw new ParseError("Invalid value", valueToken);
		}

		this.instructions.push({
			type: "value", token, value, size
		});

		if (this.afterFi) {
			this.warning("'fi' should be followed by 'malkrz'", this.previousInstToken);
		}
		this.afterFi = false;
		this.afterMalkrz = false;
		this.afterNll = false;
		this.afterCers = false;
		this.afterDirective = false;
		return true;
	}

	private parseOperand(writable: boolean = false, allowLabel: boolean = true): Value {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Operand expected", this.eof);
		}

		if (isSupportedRegister(token.text)) {
			if (this.takeIfString("+")) {
				const dispToken = this.take();
				if (isSupportedRegister(dispToken.text)) {
					this.takeString("@");
					return V.indRegReg(token.text, dispToken.text);
				} else if (/^\d+$/.test(dispToken.text)) {
					this.takeString("@");
					return V.indRegDisp(token.text, parseInt32(dispToken.text));
				}
				throw new ParseError("Invalid displacement", dispToken);
			} else if (this.takeIfString("|")) {
				const dispToken = this.take();
				if (/^\d+$/.test(dispToken.text)) {
					this.takeString("@");
					return V.indRegDisp(token.text, (-parseInt32(dispToken.text)) | 0);
				}
				throw new ParseError("Invalid displacement", dispToken);
			} else if (this.takeIfString("@")) {
				return V.indReg(token.text);
			} else {
				return V.reg(token.text);
			}
		}
		if (/^\d+$/.test(token.text)) {
			if (this.takeIfString("+")) {
				const dispToken = this.take();
				if (isSupportedRegister(dispToken.text)) {
					this.takeString("@");
					return V.indRegDisp(dispToken.text, parseInt32(token.text));
				}
				throw new ParseError("Invalid displacement", dispToken);
			} else if (!writable) {
				return V.imm(parseInt32(token.text));
			}
		}
		if (isValidLabel(token.text)) {
			if (token.text == "tvarlon-knloan") {
				if (this.takeIfString("@")) {
					throw new ParseError("Builtin label", token);
				}
				if (!writable) {
					return V.imm(TVARLON_KNLOAN_ADDRESS);
				}
			} else {
				this.useLabel(token);
				if (this.takeIfString("@")) {
					return V.indLabel(token.text);
				}
				if (!writable && allowLabel) {
					return V.label(token.text);
				}
			}
		}

		if (writable) {
			throw new ParseError("Invalid operand to write value", token);
		}

		throw new ParseError("Invalid operand", token);
	}

	private parseWritableOperand(): WritableValue {
		return this.parseOperand(true) as WritableValue;
	}

	private parseLabelOperand(): Value {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Operand expected", this.eof);
		}

		if (token.text == "tvarlon-knloan") {
			if (this.takeIfString("@")) {
				throw new ParseError("Builtin label", token);
			}
			return V.imm(TVARLON_KNLOAN_ADDRESS);
		}
		if (isValidLabel(token.text)) {
			this.useLabel(token);
			if (this.takeIfString("@")) {
				return V.indLabel(token.text);
			}
			return V.label(token.text);
		}
		throw new ParseError("Invalid operand", token);
	}

	private parseWritableOrImmOperand(): WritableValue | Value.Imm {
		return this.parseOperand(false, false) as WritableValue | Value.Imm;
	}

	private parseCompare(): Compare {
		const token = this.take();
		if (token != this.eof && isCompare(token.text)) {
			return token.text;
		}
		throw new ParseError("Compare keyword expected", token);
	}

	private parseLabel(strict: boolean = false, external: boolean = false): Token {
		const token = this.take();
		if (token == this.eof) {
			throw new ParseError("Label name expected", token);
		}
		if (isValidLabel(token.text)) {
			if (token.text == "tvarlon-knloan") {
				throw new ParseError(`Builtin label`, token);
			}
			if (external) {
				if (token.text == "xx") {
					throw new ParseError("Invalid label name", token);
				}
				if (RESERVED_LABEL_REGEXP.test(token.text)) {
					this.warning("Improper label name", token);
				}
			}
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

	private verify() {
		if (this.larStack.length != 0) {
			this.errorWithoutThrow("'ral' expected", this.eof);
		}
		if (this.afterFi) {
			this.warning("'fi' should be followed by 'malkrz' or 'maldus'", this.previousInstToken);
		}
		if (this.afterNll || this.afterCers) {
			this.errorWithoutThrow(
				`'${this.previousDirectiveToken!.text}' must be followed by an instruction`,
				this.previousDirectiveToken
			);
		}

		for (const [label, tokens] of this.labelUses) {
			if (this.externalLabels.has(label) && this.internalLabels.has(label)) {
				continue;
			}
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
			if (this.externalLabels.has(label) && this.internalLabels.has(label)) {
				this.errorWithoutThrow(`'${token.text}' is defined internally`, token);
			} else {
				this.warning(`'${label}' is defined but not used`, token);
			}
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

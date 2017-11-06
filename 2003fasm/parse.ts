import {Cond, Instruction, ParseError, Register, REGISTER_RESERVED, Token, Value, WritableValue} from "./types";

export type LabeledInstructions = {instruction: Instruction, labels: string[]}[]

export interface ParsedFile {
	instructions: LabeledInstructions;
	kueList: string[];
	xokList: string[];
}

export function fullParse(str: string, file: string = ""): ParsedFile {
	const ts = tokenize(str.replace(/\r\n?/g, "\n"), file);
	return toInstructions(beautify(ts));
}

function tokenize(source: string, file: string = ""): Token[] {
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

function beautify(tokens: Token[]): Token[] {
	let ret: Token[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].text == "+") {
			if (i > 0) {
				if (i + 1< tokens.length) {
					ret[ret.length - 1].text += "+" + tokens[i + 1].text;
					i++;
				} else {
					throw new ParseError("Unexpected + at the end of input");
				}
			} else {
				throw new ParseError("Unexpected + at the beginning of input");
			}
		} else if (tokens[i].text == "@") {
			if (i > 0) {
				ret[ret.length - 1].text += "@";
			} else {
				throw new ParseError("Unexpected @ at the beginning of input");
			}
		} else {
			ret.push(tokens[i]);
		}
	}
	return ret;
}

const RL = {
	"krz": Instruction.Krz,
	"kRz": Instruction.Krz,
	"ata": Instruction.Ata,
	"nta": Instruction.Nta,
	"ada": Instruction.Ada,
	"ekc": Instruction.Ekc,
	"dal": Instruction.Dal,
	"dto": Instruction.Dto,
	"dro": Instruction.Dro,
	"dRo": Instruction.Dro,
	"dtosna": Instruction.Dtosna,
	"malkrz": Instruction.MalKrz,
	"malkRz": Instruction.MalKrz
};

function toInstructions(tokens: Token[]): ParsedFile {
	let isCI = false;
	let kueList: string[] = [];
	let xokList: string[] = [];
	let labels: string[] = [];
	let instructions: LabeledInstructions = [];
	function pushInstruction(instruction: Instruction) {
		instructions.push({instruction, labels});
		labels = [];
	}

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i].text;
		if (token == "'c'i") {
			isCI = true;
		} else if (token == "'i'c") {
			isCI = false;
		} else if (token == "fen") {
			pushInstruction(new Instruction.Krz(tokens[i], new Value.R(Register.f0), new Value.R(Register.f0)));
		} else if (token == "nac" && i + 1 < tokens.length) {
			const dst = parseL(tokens[i + 1]);
			pushInstruction(new Instruction.Dal(tokens[i], new Value.Pure(0), dst));
		} else if (RL.hasOwnProperty(token) && i + 2 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 2]) : parseR(tokens[i + 1]);
			const dst = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			pushInstruction(new RL[token](tokens[i], src, dst));
			i += 2;
		} else if (token == "lat" && i + 3 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const dstl = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			const dsth = isCI ? parseL(tokens[i + 2]) : parseL(tokens[i + 3]);
			pushInstruction(new Instruction.Lat(tokens[i], src, dstl, dsth));
			i += 3;
		} else if (token == "latsna" && i + 3 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const dstl = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			const dsth = isCI ? parseL(tokens[i + 2]) : parseL(tokens[i + 3]);
			pushInstruction(new Instruction.Latsna(tokens[i], src, dstl, dsth));
			i += 3;
		} else if (token == "fi" && i + 3 < tokens.length && Cond.hasOwnProperty(tokens[i + 3].text)) {
			const a = parseR(tokens[i + 1]);
			const b = parseR(tokens[i + 2]);
			pushInstruction(new Instruction.Fi(tokens[i], a, b, Cond[tokens[i + 3].text]));
			i += 3;
		} else if (token == "inj" && i + 3 < tokens.length) {
			const a = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const b = parseL(tokens[i + 2]);
			const c = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 3]);
			pushInstruction(new Instruction.Inj(tokens[i], a, b, c));
			i += 3;
		} else if (token == "nll" && i + 1 < tokens.length) {
			labels.push(parseLabel(tokens[i + 1]));
			i += 1;
		} else if (token == "l'" && i + 1 < tokens.length) {
			if (instructions.length == 0) {
				throw new ParseError("l' must be preceded by an instruction");
			}
			if (instructions[instructions.length - 1].instruction == null) {
				throw new ParseError("nll must not be followed by l'");
			}
			instructions[instructions.length - 1].labels.push(parseLabel(tokens[i + 1]));
			i += 1;
		} else if (token == "kue" && i + 1 < tokens.length) {
			kueList.push(parseLabel(tokens[i + 1]));
			i += 1;
		} else if (token == "xok" && i + 1 < tokens.length) {
			xokList.push(parseLabel(tokens[i + 1]));
			i += 1;
		} else {
			throw new ParseError("Unparsable command sequence " + tokens.map(t => t.text).slice(i).join(" "));
		}
	}
	if (labels.length != 0) {
		throw new ParseError("nll must be followed by an instruction");
	}
	return {instructions, kueList, xokList};
}

function parseRegister(token: string): Register {
	if (Register.hasOwnProperty(token)) {
		return Register[token];
	}
	throw new ParseError("no register");
}

function parseR(token: Token): Value {
	try {
		return parseL(token);
	} catch(_) {}
	if (token.text.search(/^\d*$/) >= 0) {
		return new Value.Pure(parseInt(token.text));
	}
	if (isValidLabel(token.text)) {
		return new Value.Label(token.text);
	}
	throw new ParseError(`cannot parse \`${token.text}\` as a valid data"`);
}

function parseL(token: Token): WritableValue {
	const tokenStr = token.text;
	if (tokenStr.length == 2) {
		return new Value.R(parseRegister(tokenStr));
	}
	let match;
	if ((match = tokenStr.match(/^(..)@$/)) != null) {
		return new Value.RPlusNum(parseRegister(match[1]), 0);
	}
	if ((match = tokenStr.match(/^(..)\+(\d*)@$/)) != null) {
		return new Value.RPlusNum(parseRegister(match[1]), parseInt(match[2]));
	}
	if ((match = tokenStr.match(/^(..)\+(..)@$/)) != null) {
		if (Register.hasOwnProperty(match[2])) {
			return new Value.RPlusR(parseRegister(match[1]), parseRegister(match[2]));
		}
	}
	throw new ParseError(`cannot parse \`${tokenStr}\` as a valid place to put data`);
}

function isValidLabel(name: string): boolean {
	return (
		name.search(/^\d*$/) < 0 &&
		REGISTER_RESERVED.indexOf(name) < 0 &&
		name.search(/^[pFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]+$/) >= 0
	);
}

function parseLabel(token: Token): string {
	if (isValidLabel(token.text)) {
		return token.text;
	}
	throw new ParseError(`\`${token.text}\` cannot be used as a valid label`);
}

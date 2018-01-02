import {Cond, ParsedFile, ParseError, Register, Token} from "../types";
import {AsmBuilder, isValidLabel, Operand, parseLabel, WritableOperand} from "../builder";

export function fullCompile(str: string, file: string = ""): ParsedFile {
	const ts = tokenize(str.replace(/\r\n?/g, "\n"), file);
	return parse(associateExpr(ts));
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

function associateExpr(tokens: Token[]): Token[] {
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

function parse(tokens: Token[]): ParsedFile {
	let isCI = false;
	let builder = new AsmBuilder();
	builder.setHasMain(true);

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		builder.setNextToken(token);
		const tokenStr = token.text;
		if (tokenStr == "'c'i") {
			isCI = true;
		} else if (tokenStr == "'i'c") {
			isCI = false;
		} else if (tokenStr == "fen") {
			builder.krz(Register.f0, Register.f0);
		} else if (tokenStr == "nac" && i + 1 < tokens.length) {
			const dst = parseL(tokens[i + 1]);
			builder.nac(dst);
		} else if (AsmBuilder.isBinOp(tokenStr) && i + 2 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 2]) : parseR(tokens[i + 1]);
			const dst = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			builder.binOp(tokenStr, src, dst);
			i += 2;
		} else if (tokenStr == "lat" && i + 3 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const dstl = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			const dsth = isCI ? parseL(tokens[i + 2]) : parseL(tokens[i + 3]);
			builder.lat(src, dstl, dsth);
			i += 3;
		} else if (tokenStr == "latsna" && i + 3 < tokens.length) {
			const src = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const dstl = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 2]);
			const dsth = isCI ? parseL(tokens[i + 2]) : parseL(tokens[i + 3]);
			builder.latsna(src, dstl, dsth);
			i += 3;
		} else if (tokenStr == "fi" && i + 3 < tokens.length && Cond.hasOwnProperty(tokens[i + 3].text)) {
			const a = parseR(tokens[i + 1]);
			const b = parseR(tokens[i + 2]);
			builder.fi(a, b, Cond[tokens[i + 3].text]);
			i += 3;
		} else if (tokenStr == "inj" && i + 3 < tokens.length) {
			const a = isCI ? parseR(tokens[i + 3]) : parseR(tokens[i + 1]);
			const b = parseL(tokens[i + 2]);
			const c = isCI ? parseL(tokens[i + 1]) : parseL(tokens[i + 3]);
			builder.inj(a, b, c);
			i += 3;
		} else if (tokenStr == "nll" && i + 1 < tokens.length) {
			builder.nll(tokens[i + 1].text);
			i += 1;
		} else if (tokenStr == "l'" && i + 1 < tokens.length) {
			builder.l(parseLabel(tokens[i + 1]));
			i += 1;
		} else if (tokenStr == "kue" && i + 1 < tokens.length) {
			builder.kue(parseLabel(tokens[i + 1]));
			builder.setHasMain(false);
			i += 1;
		} else if (tokenStr == "xok" && i + 1 < tokens.length) {
			builder.xok(parseLabel(tokens[i + 1]));
			i += 1;
		} else {
			throw new ParseError("Unparsable command sequence " + tokens.map(t => t.text).slice(i).join(" "));
		}
	}
	return builder.getParsedFile();
}

function parseRegister(token: string): Register {
	if (Register.hasOwnProperty(token)) {
		return Register[token];
	}
	throw new ParseError("no register");
}

function parseR(token: Token): Operand {
	try {
		return parseL(token);
	} catch(_) {}
	if (token.text.search(/^\d*$/) >= 0) {
		return {v: parseInt(token.text)};
	}
	if (isValidLabel(token.text)) {
		return token.text;
	}
	throw new ParseError(`cannot parse \`${token.text}\` as a valid data"`);
}

function parseL(token: Token): WritableOperand {
	const tokenStr = token.text;
	if (tokenStr.length == 2) {
		return parseRegister(tokenStr);
	}
	let match;
	if ((match = tokenStr.match(/^(..)@$/)) != null) {
		return [parseRegister(match[1])];
	}
	if ((match = tokenStr.match(/^(..)\+(\d*)@$/)) != null) {
		return [parseRegister(match[1]), {v: parseInt(match[2])}];
	}
	if ((match = tokenStr.match(/^(..)\+(..)@$/)) != null) {
		if (Register.hasOwnProperty(match[2])) {
			return [parseRegister(match[1]), parseRegister(match[2])];
		}
	}
	throw new ParseError(`cannot parse \`${tokenStr}\` as a valid place to put data`);
}

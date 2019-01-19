import {ParseError, Token} from "./types";

export abstract class Parser<T> {
	private index = 0;
	private errors: ParseError[] = [];
	private warnings: ParseError[] = [];
	constructor(private tokens: Token[], protected eof: Token) {}

	parse(): {root: T | null, errors: ParseError[], warnings: ParseError[]} {
		let root: T | null = null;
		try {
			root = this.parseRoot();
		} catch (e) {
			if (e instanceof ParseError) {
				this.errors.push(e);
			} else {
				throw e;
			}
		}
		return {root, errors: this.errors, warnings: this.warnings};
	}

	protected abstract parseRoot(): T;

	protected isNotEOF(): boolean {
		return this.index < this.tokens.length;
	}

	protected take(): Token {
		if (this.index < this.tokens.length) {
			const token = this.tokens[this.index];
			this.index++;
			return token;
		}
		return this.eof;
	}

	protected takeString(text: string): Token {
		if (this.index < this.tokens.length) {
			const token = this.tokens[this.index];
			this.index++;
			if (token.text == text) {
				return token;
			}
			throw new ParseError(`'${text}' expected`, token);
		}
		throw new ParseError(`'${text}' expected`, this.eof);
	}

	protected takeIfString(text: string): Token | null {
		if (this.index < this.tokens.length) {
			const token = this.tokens[this.index];
			if (token.text == text) {
				this.index++;
				return token;
			}
		}
		return null;
	}

	protected takeIf(predicate: (token: Token) => boolean): Token | null {
		if (this.index < this.tokens.length) {
			const token = this.tokens[this.index];
			if (predicate(token)) {
				this.index++;
				return token;
			}
		}
		return null;
	}

	protected lookaheadString(text: string, pos: number = 1): boolean {
		const index = this.index + pos - 1;
		if (index < this.tokens.length) {
			if (this.tokens[index].text == text) {
				return true;
			}
		}
		return false;
	}

	protected try<T>(func: () => T): T | null {
		try {
			return func();
		} catch (e) {
			if (e instanceof ParseError) {
				this.errors.push(e);
				return null;
			} else {
				throw e;
			}
		}
	}

	protected warning(message: string, token: Token | null) {
		this.warnings.push(new ParseError(message, token));
	}

	protected errorWithoutThrow(message: string, token: Token | null) {
		this.errors.push(new ParseError(message, token));
	}
}

export function parseInt32(str: string): number {
	const length = str.length;
	if (length <= 15) {
		return parseInt(str, 10) | 0;
	}
	let n = 0;
	for (let i = 0; i < length; i++) {
		n = (n * 10 + str.charCodeAt(i) - 0x30) | 0;
	}
	return n;
}

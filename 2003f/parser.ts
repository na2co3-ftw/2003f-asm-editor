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

	abstract parseRoot(): T;

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

	protected lookaheadString(text: string): boolean {
		if (this.index < this.tokens.length) {
			if (this.tokens[this.index].text == text) {
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
}
export type TextLanguage = "ja";

export interface I18nText {
	get(language: TextLanguage): string;
}


type SimpleDictionary = {
	[L in TextLanguage]: string
};

export class SimpleText implements I18nText {
	constructor(private dict: SimpleDictionary) {
	}

	get(language: TextLanguage): string {
		return this.dict[language];
	}
}

type ParamDictionary<T> = {
	[L in TextLanguage]: (pram: T) => string
}


export class ParamText<T> implements I18nText {
	private constructor(private dict: ParamDictionary<T>, private param: T) {
	}

	static create<T = string>(dict: ParamDictionary<T>): (param: T) => ParamText<T> {
		return (param: T) => new ParamText(dict, param);
	}

	get(language: TextLanguage): string {
		return this.dict[language](this.param);
	}
}

export function literalText(text: string): I18nText {
	return {
		get() {
			return text;
		}
	};
}

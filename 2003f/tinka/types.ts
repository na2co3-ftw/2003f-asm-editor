import {Token} from "../types";
export {ParseError, RuntimeError, Token} from "../types";

export enum Compare {
	xtlo, xylo, clo, xolo, llo, niv, xtlonys, xylonys, xolonys, llonys
}

export abstract class Definition {
}
export class Kue extends Definition {
	constructor(public name: string) {
		super();
	}
}
export class Xok extends Definition {
	constructor(public name: string) {
		super();
	}
}
export class Cersva extends Definition {
	constructor(
		public name: string,
		public args: {name: string, pointer: boolean}[],
		public body: Statement[]
	) {
		super();
	}
}

export abstract class Statement {
	constructor(public token: Token) {}
}

export class Anax extends Statement {
	constructor(
		token: Token,
		public name: string,
		public pointer: boolean = false,
		public length: number = 1
	) {
		super(token);
	}
}
export class Fi extends Statement {
	constructor(
		token: Token,
		public left: Expression,
		public compare: Compare,
		public right: Expression,
		public body: Statement[]
	) {
		super(token);
	}
}
export class Fal extends Statement {
	constructor(
		token: Token,
		public left: Expression,
		public compare: Compare,
		public right: Expression,
		public body: Statement[]
	) {
		super(token);
	}
}
export class Dosnud extends Statement {
	constructor(
		token: Token,
		public value: Expression
	) {
		super(token);
	}
}
export class Fenxeo extends Statement {
	constructor(
		token: Token,
		public name: string,
		public args: Expression[],
		public destination: AnaxName|null
	) {
		super(token);
	}
}
export class Operation extends Statement {
	constructor(
		token: Token,
		public mnemonic: string,
		public operands: Expression[]
	) {
		super(token);
	}
}

export abstract class Expression {}
export class Constant extends Expression {
	constructor(public value: number) {
		super();
	}
}
export class AnaxName extends Expression {
	constructor(
		public name: string,
		public pos: Expression = new Constant(0)
	) {
		super();
	}
}

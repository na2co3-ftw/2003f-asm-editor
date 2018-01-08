import {AsmModule, Compare, Instruction, LabeledInstruction, Register, Token, Value, WritableValue} from "./types";

export class BuilderError {
	constructor(public message: string) {}
}

export class InvalidArgumentError extends BuilderError {}
export class MissingPrecedingInstError extends BuilderError {}
export class MissingFollowingInstError extends BuilderError {}
export class CrossingLabelError extends BuilderError {}

const BINOP_INST: {[mnemonic: string]: {new(src: Value, dst: WritableValue): Instruction}} = {
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

const TRIOP_INST: {[mnemonic: string]: {new(src: Value, dstl: WritableValue, dsth: WritableValue): Instruction}} = {
	"lat": Instruction.Lat,
	"latsna": Instruction.Latsna
};

export const BINARY_OPERATORS = Object.keys(BINOP_INST);

export const TERNARY_OPERATORS = Object.keys(TRIOP_INST);



export class AsmBuilder {
	private instructions: LabeledInstruction[] = [];
	private kueList: string[] = [];
	private xokList: string[] = [];
	private hasMain: boolean = false;
	private nextLabels: string[] = [];
	private nextToken: Token | null = null;

	getAsmModule(): AsmModule {
		if (this.nextLabels.length != 0) {
			throw new MissingFollowingInstError("nll must be followed by an instruction");
		}
		return {
			instructions: this.instructions,
			kueList: this.kueList,
			xokList: this.xokList,
			hasMain: this.hasMain
		};
	}

	private add(instruction: Instruction) {
		let labeledInst: LabeledInstruction = {instruction, labels: this.nextLabels};
		if (this.nextToken) {
			labeledInst.token = this.nextToken;
		}
		this.instructions.push(labeledInst);
		this.nextLabels = [];
		this.nextToken = null;
	}

	nac(dst: WritableValue) {
		this.add(new Instruction.Nac(dst));
	}

	ata(src: Value, dst: WritableValue) {
		this.add(new Instruction.Ata(src, dst));
	}
	nta(src: Value, dst: WritableValue) {
		this.add(new Instruction.Nta(src, dst));
	}
	ada(src: Value, dst: WritableValue) {
		this.add(new Instruction.Ada(src, dst));
	}
	ekc(src: Value, dst: WritableValue) {
		this.add(new Instruction.Ekc(src, dst));
	}
	dal(src: Value, dst: WritableValue) {
		this.add(new Instruction.Dal(src, dst));
	}
	dto(src: Value, dst: WritableValue) {
		this.add(new Instruction.Dto(src, dst));
	}
	dro(src: Value, dst: WritableValue) {
		this.add(new Instruction.Dro(src, dst));
	}
	dtosna(src: Value, dst: WritableValue) {
		this.add(new Instruction.Dtosna(src, dst));
	}
	krz(src: Value, dst: WritableValue) {
		this.add(new Instruction.Krz(src, dst));
	}
	malkrz(src: Value, dst: WritableValue) {
		this.add(new Instruction.MalKrz(src, dst));
	}

	lat(src: Value, dstl: WritableValue, dsth: WritableValue) {
		this.add(new Instruction.Lat(src, dstl, dsth));
	}
	latsna(src: Value, dstl: WritableValue, dsth: WritableValue) {
		this.add(new Instruction.Latsna(src, dstl, dsth));
	}

	fi(a: Value, b: Value, compare: Compare) {
		this.add(new Instruction.Fi(a, b, compare));
	}

	inj(a: Value, b: WritableValue, c: WritableValue) {
		this.add(new Instruction.Inj(a, b, c));
	}

	fen() {
		this.add(new Instruction.Fen());
	}

	binOp(mnemonic: string, src: Value, dst: WritableValue) {
		const Inst = BINOP_INST[mnemonic];
		if (!Inst) {
			throw new InvalidArgumentError(`'${mnemonic}' is not a binary operator`);
		}
		this.add(new Inst(src, dst));
	}

	triOp(mnemonic: string, src: Value, dstl: WritableValue, dsth: WritableValue) {
		const Inst = TRIOP_INST[mnemonic];
		if (!Inst) {
			throw new InvalidArgumentError(`'${mnemonic}' is not a ternary operator`);
		}
		this.add(new Inst(src, dstl, dsth));
	}

	l(label: string) {
		if (this.instructions.length == 0) {
			throw new MissingPrecedingInstError("l' must be preceded by an instruction");
		}
		if (this.nextLabels.length != 0) {
			throw new CrossingLabelError("nll must not be followed by l'");
		}
		this.instructions[this.instructions.length - 1].labels.push(label);
	}

	nll(label: string) {
		this.nextLabels.push(label);
	}

	kue(label: string) {
		this.kueList.push(label);
	}

	xok(label: string) {
		this.xokList.push(label);
	}

	setNextToken(token: Token) {
		this.nextToken = token;
	}

	setHasMain(hasMain: boolean) {
		this.hasMain = hasMain;
	}

	static isBinOp(mnemonic: string): boolean {
		return !!BINOP_INST[mnemonic];
	}

	static isTriOp(mnemonic: string): boolean {
		return !!TRIOP_INST[mnemonic];
	}
}

// Utilities for Value
export namespace V {
	export function reg(register: Register): Value.Reg {
		return new Value.Reg(register);
	}

	export function imm(value: number): Value.Imm {
		return new Value.Imm(value);
	}

	export function label(label: string): Value.Label {
		return new Value.Label(label);
	}

	export function indReg(register: Register): Value.IndReg {
		return new Value.IndReg(register);
	}

	export function indRegDisp(register: Register, disp: number): Value.IndRegDisp {
		return new Value.IndRegDisp(register, disp);
	}

	export function indRegReg(register1: Register, register2: Register): Value.IndRegReg {
		return new Value.IndRegReg(register1, register2);
	}

	export const f0 = new Value.Reg("f0");
	export const f1 = new Value.Reg("f1");
	export const f2 = new Value.Reg("f2");
	export const f3 = new Value.Reg("f3");
	export const f5 = new Value.Reg("f5");
	export const xx = new Value.Reg("xx");

	export const f5io = new Value.IndRegDisp("f5", 0);
}

import {
	Compare, Instruction, LabeledInstruction, ParsedFile, ParseError, Register, Token, Value,
	WritableValue
} from "./types";

export class BuilderError extends ParseError {}

export class InvalidArgumentError extends BuilderError {}
export class InvalidLabelNameError extends BuilderError {}
export class MissingPrecedingInstError extends BuilderError {}
export class MissingFollowingInstError extends BuilderError {}
export class CrossingLabelError extends BuilderError {}

const BINARY_OPERATORS = {
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

const RESERVED_REGISTERS = [
	"f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "xx"
];

export class AsmBuilder {
	private instructions: LabeledInstruction[] = [];
	private kueList: string[] = [];
	private xokList: string[] = [];
	private hasMain: boolean = false;
	private nextLabels: string[] = [];
	private nextToken: Token | null = null;

	getParsedFile(): ParsedFile {
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

	add(instruction: Instruction) {
		let labeledInst: LabeledInstruction = {instruction, labels: this.nextLabels};
		if (this.nextToken) {
			labeledInst.token = this.nextToken;
		}
		this.instructions.push(labeledInst);
		this.nextLabels = [];
		this.nextToken = null;
	}

	nac(dst: WritableValue) {
		this.add(new Instruction.Dal(new Value.Pure(0), dst));
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

	binOp(mnemonic: string, src: Value, dst: WritableValue) {
		const Inst = BINARY_OPERATORS[mnemonic];
		if (!Inst) {
			throw new InvalidArgumentError(`'${mnemonic}' is not a binary operator`);
		}
		this.add(new Inst(src, dst));
	}

	l(label: string) {
		if (!isValidLabel(label)) {
			throw new InvalidLabelNameError(`\`${label}\` cannot be used as a valid label`);
		}
		if (this.instructions.length == 0) {
			throw new MissingPrecedingInstError("l' must be preceded by an instruction");
		}
		if (this.nextLabels.length != 0) {
			throw new CrossingLabelError("nll must be followed by an instruction");
		}
		this.instructions[this.instructions.length - 1].labels.push(label);
	}

	nll(label: string) {
		if (!isValidLabel(label)) {
			throw new InvalidLabelNameError(`\`${label}\` cannot be used as a valid label`);
		}
		this.nextLabels.push(label);
	}

	kue(label: string) {
		if (!isValidLabel(label)) {
			throw new InvalidLabelNameError(`\`${label}\` cannot be used as a valid label`);
		}
		this.kueList.push(label);
	}

	xok(label: string) {
		if (!isValidLabel(label)) {
			throw new InvalidLabelNameError(`\`${label}\` cannot be used as a valid label`);
		}
		this.xokList.push(label);
	}

	setNextToken(token: Token) {
		this.nextToken = token;
	}

	setHasMain(hasMain: boolean) {
		this.hasMain = hasMain;
	}

	static isBinOp(mnemonic: string): boolean {
		return !!BINARY_OPERATORS[mnemonic];
	}
}

function isValidLabel(name: string): boolean {
	return (
		name.search(/^\d*$/) < 0 &&
		RESERVED_REGISTERS.indexOf(name) < 0 &&
		name.search(/^[pFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]+$/) >= 0
	);
}

// Utilities for Value
export namespace V {
	export function reg(register: Register): Value.R {
		return new Value.R(register);
	}

	export function imm(value: number): Value.Pure {
		return new Value.Pure(value);
	}

	export function label(label: string): Value.Label {
		if (!isValidLabel(label)) {
			throw new InvalidLabelNameError(`\`${label}\` cannot be used as a valid label`);
		}
		return new Value.Label(label);
	}

	export function indReg(register: Register): Value.RPlusNum {
		return new Value.RPlusNum(register, 0);
	}

	export function indRegDisp(register: Register, disp: number): Value.RPlusNum {
		return new Value.RPlusNum(register, disp);
	}

	export function indRegReg(register1: Register, register2: Register): Value.RPlusR {
		return new Value.RPlusR(register1, register2);
	}

	export const f0 = new Value.R("f0");
	export const f1 = new Value.R("f1");
	export const f2 = new Value.R("f2");
	export const f3 = new Value.R("f3");
	export const f5 = new Value.R("f5");
	export const xx = new Value.R("xx");

	export const f5io = new Value.RPlusNum("f5", 0);
}

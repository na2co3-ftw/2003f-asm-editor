import {
	Cond, Instruction, LabeledInstruction, ParsedFile, ParseError, Register, Token, Value,
	WritableValue
} from "./types";

export type WritableOperand = Register | [Register] | [Register, Register] | [Register, {v: number}];

export type Operand = WritableOperand | {v: number} | string;

export function isImm(operand: Operand): operand is {v: number} {
	return operand.hasOwnProperty("v");
}

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

const REGISTER_RESERVED = [
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

	nac(dst: WritableOperand) {
		this.add(new Instruction.Dal(new Value.Pure(0), toWritableValue(dst)));
	}

	ata(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Ata(toValue(src), toWritableValue(dst)));
	}
	nta(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Nta(toValue(src), toWritableValue(dst)));
	}
	ada(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Ada(toValue(src), toWritableValue(dst)));
	}
	ekc(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Ekc(toValue(src), toWritableValue(dst)));
	}
	dal(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Dal(toValue(src), toWritableValue(dst)));
	}
	dto(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Dto(toValue(src), toWritableValue(dst)));
	}
	dro(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Dro(toValue(src), toWritableValue(dst)));
	}
	dtosna(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Dtosna(toValue(src), toWritableValue(dst)));
	}
	krz(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.Krz(toValue(src), toWritableValue(dst)));
	}
	malkrz(src: Operand, dst: WritableOperand) {
		this.add(new Instruction.MalKrz(toValue(src), toWritableValue(dst)));
	}

	lat(src: Operand, dstl: WritableOperand, dsth: WritableOperand) {
		this.add(new Instruction.Lat(toValue(src), toWritableValue(dstl), toWritableValue(dsth)));
	}
	latsna(src: Operand, dstl: WritableOperand, dsth: WritableOperand) {
		this.add(new Instruction.Latsna(toValue(src), toWritableValue(dstl), toWritableValue(dsth)));
	}

	fi(a: Operand, b: Operand, cond: Cond) {
		this.add(new Instruction.Fi(toValue(a), toValue(b), cond));
	}

	inj(a: Operand, b: WritableOperand, c: WritableOperand) {
		this.add(new Instruction.Inj(toValue(a), toWritableValue(b), toWritableValue(c)));
	}

	binOp(mnemonic: string, src: Operand, dst: WritableOperand) {
		const Inst = BINARY_OPERATORS[mnemonic];
		if (!Inst) {
			throw new InvalidArgumentError(`'${mnemonic}' is not a binary operator`);
		}
		this.add(new Inst(toValue(src), toWritableValue(dst)));
	}

	l(label: string) {
		if (this.instructions.length == 0) {
			throw new MissingPrecedingInstError("l' must be preceded by an instruction");
		}
		if (this.nextLabels.length != 0) {
			throw new CrossingLabelError("nll must be followed by an instruction");
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
		return !!BINARY_OPERATORS[mnemonic];
	}
}

function toValue(operand: Operand): Value {
	if (isImm(operand)) {
		return new Value.Pure(operand.v);
	}
	if (typeof operand == "string") {
		return new Value.Label(operand);
	}
	return toWritableValue(operand);
}

function toWritableValue(operand: WritableOperand): WritableValue {
	if (Array.isArray(operand)) {
		if (operand.length == 1) {
			return new Value.RPlusNum(operand[0], 0);
		} else{
			const disp = operand[1];
			if (isImm(disp)) {
				return new Value.RPlusNum(operand[0], disp.v);
			} else {
				return new Value.RPlusR(operand[0], disp);
			}
		}
	}
	return new Value.R(operand);
}

export function isValidLabel(name: string): boolean {
	return (
		name.search(/^\d*$/) < 0 &&
		REGISTER_RESERVED.indexOf(name) < 0 &&
		name.search(/^[pFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]+$/) >= 0
	);
}

export function parseLabel(token: Token): string {
	if (isValidLabel(token.text)) {
		return token.text;
	}
	throw new InvalidLabelNameError(`\`${token.text}\` cannot be used as a valid label`);
}

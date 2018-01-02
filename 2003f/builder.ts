import {LabeledInstruction, ParsedFile} from "./2003lk/parse";
import {Instruction, Value, WritableValue, Cond, Register, Token} from "./types";

export type WritableOperand = Register | [Register] | [Register, Register] | [Register, {v: number}];
export type Operand = WritableOperand | {v: number} | string;
export function isImm(operand: Operand): operand is {v: number} {
	return operand.hasOwnProperty("v");
}

export class AsmBuilder {
	private instructions: LabeledInstruction[] = [];
	private kueList: string[] = [];
	private xokList: string[] = [];
	private hasMain: boolean = false;
	private nextLabels: string[] = [];
	private nextToken: Token | null = null;

	getParsedFile(): ParsedFile {
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

import {
	AsmModule, Compare, Instruction, LabeledInstruction, LabelWithToken, Register, Token, Value,
	WritableValue
} from "./types";

export class BuilderError {
	constructor(public message: string) {}
}

const BINOP_ALIESES: { [mnemonic: string]: Instruction.BinaryOpcode } = {
	"kRz": "krz",
	"kRz8i": "krz8i",
	"kRz8c": "krz8c",
	"kRz16i": "krz16i",
	"kRz16c": "krz16c",
	"dRo": "dro",
	"malkRz": "malkrz"
};

export const BINARY_OPERATORS = [...Instruction.BINARY_OPCODES, ...Object.keys(BINOP_ALIESES)];

export const TERNARY_OPERATORS = Instruction.TERNARY_OPCODES;

export class AsmBuilder {
	private instructions: LabeledInstruction[] = [];
	private kueList: LabelWithToken[] = [];
	private xokList: LabelWithToken[] = [];
	private hasMain: boolean = false;
	private nextLabels: string[] = [];
	private nextToken: Token | null = null;
	constructor(private name: string) {}

	getAsmModule(): AsmModule {
		if (this.nextLabels.length != 0) {
			throw new BuilderError("nll must be followed by an instruction");
		}
		return {
			name: this.name,
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

	static isBinOp(mnemonic: string): boolean {
		return Instruction.isBinaryOpcode(mnemonic) || !!BINOP_ALIESES[mnemonic];
	}

	static isTriOp(mnemonic: string): boolean {
		return Instruction.isTernaryOpcode(mnemonic);
	}

	nac(dst: WritableValue) {
		this.add({opcode: "nac", dst});
	}

	ata(src: Value, dst: WritableValue) {
		this.add({opcode: "ata", src, dst});
	}

	nta(src: Value, dst: WritableValue) {
		this.add({opcode: "nta", src, dst});
	}

	ada(src: Value, dst: WritableValue) {
		this.add({opcode: "ada", src, dst});
	}

	ekc(src: Value, dst: WritableValue) {
		this.add({opcode: "ekc", src, dst});
	}

	dal(src: Value, dst: WritableValue) {
		this.add({opcode: "dal", src, dst});
	}

	dto(src: Value, dst: WritableValue) {
		this.add({opcode: "dto", src, dst});
	}

	dro(src: Value, dst: WritableValue) {
		this.add({opcode: "dro", src, dst});
	}

	dtosna(src: Value, dst: WritableValue) {
		this.add({opcode: "dtosna", src, dst});
	}

	krz(src: Value, dst: WritableValue) {
		this.add({opcode: "krz", src, dst});
	}

	malkrz(src: Value, dst: WritableValue) {
		this.add({opcode: "malkrz", src, dst});
	}

	krz8i(src: Value, dst: WritableValue) {
		this.add({opcode: "krz8i", src, dst});
	}

	krz8c(src: Value, dst: WritableValue) {
		this.add({opcode: "krz8c", src, dst});
	}

	krz16i(src: Value, dst: WritableValue) {
		this.add({opcode: "krz16i", src, dst});
	}

	krz16c(src: Value, dst: WritableValue) {
		this.add({opcode: "krz16c", src, dst});
	}

	lat(src: Value, dstl: WritableValue, dsth: WritableValue) {
		this.add({opcode: "lat", src, dstl, dsth});
	}

	latsna(src: Value, dstl: WritableValue, dsth: WritableValue) {
		this.add({opcode: "latsna", src, dstl, dsth});
	}

	fi(a: Value, b: Value, compare: Compare) {
		this.add({opcode: "fi", a, b, compare});
	}

	inj(a: Value, b: WritableValue, c: WritableValue) {
		this.add({opcode: "inj", a, b, c});
	}

	fen() {
		this.add({opcode: "fen"});
	}

	l(label: string) {
		if (this.instructions.length == 0) {
			throw new BuilderError("l' must be preceded by an instruction");
		}
		if (this.nextLabels.length != 0) {
			throw new BuilderError("nll must not be followed by l'");
		}
		this.instructions[this.instructions.length - 1].labels.push(label);
	}

	nll(label: string) {
		this.nextLabels.push(label);
	}

	kue(label: string, token: Token | null) {
		this.kueList.push({name: label, token});
	}

	xok(label: string, token: Token | null) {
		this.xokList.push({name: label, token});
	}

	setNextToken(token: Token) {
		this.nextToken = token;
	}

	setHasMain(hasMain: boolean) {
		this.hasMain = hasMain;
	}

	binOp(mnemonic: string, src: Value, dst: WritableValue) {
		if (Instruction.isBinaryOpcode(mnemonic)) {
			this.add({opcode: mnemonic, src, dst});
			return;
		}
		const opcode = BINOP_ALIESES[mnemonic];
		if (!opcode) {
			throw new BuilderError(`'${mnemonic}' is not a binary operator`);
		}
		this.add({opcode, src, dst});
	}

	triOp(mnemonic: string, src: Value, dstl: WritableValue, dsth: WritableValue) {
		if (Instruction.isTernaryOpcode(mnemonic)) {
			this.add({opcode: mnemonic, src, dstl, dsth});
			return;
		}
		throw new BuilderError(`'${mnemonic}' is not a ternary operator`);
	}
}

// Utilities for Value
export namespace V {
	export function reg(register: Register): Value.Reg {
		return {
			type: "Reg",
			reg: register
		};
	}

	export function imm(value: number): Value.Imm {
		return {
			type: "Imm",
			value: value
		};
	}

	export function label(label: string): Value.Label {
		return {
			type: "Label",
			label: label
		};
	}

	export function indReg(register: Register): Value.IndReg {
		return {
			type: "IndReg",
			reg: register
		};
	}

	export function indRegDisp(register: Register, disp: number): Value.IndRegDisp {
		return {
			type: "IndRegDisp",
			reg: register,
			offset: disp
		};
	}

	export function indRegReg(register1: Register, register2: Register): Value.IndRegReg {
		return {
			type: "IndRegReg",
			reg1: register1,
			reg2: register2
		};
	}

	export const f0 = reg("f0");
	export const f1 = reg("f1");
	export const f2 = reg("f2");
	export const f3 = reg("f3");
	export const f5 = reg("f5");
	export const xx = reg("xx");

	export const f5io = indReg("f5");
	export const f5_4io = indRegDisp("f5", 4);
	export const f5_8io = indRegDisp("f5", 8);
}

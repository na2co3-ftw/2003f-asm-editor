import {I18nText} from "../i18n/text";

export class Token {
	constructor(
		public text: string,
		public row: number,
		public column: number,
		public file: string = ""
	) {}
}


export type Register = "f0" | "f1" | "f2" | "f3" | "f5" | "xx";

const REGISTERS = ["f0", "f1", "f2", "f3", "f5", "xx"];

export function isRegister(reg: string): reg is Register {
	return REGISTERS.indexOf(reg) >= 0;
}


export type WritableValue =
	Value.Reg | Value.IndReg | Value.IndRegDisp | Value.IndRegReg |
	Value.IndLabel | Value.IndLabelDisp | Value.IndLabelReg | Value.IndLabelRegDisp;

export type Value = WritableValue | Value.Imm | Value.Label;

export namespace Value {
	export interface Reg {
		type: "Reg";
		reg: Register;
	}

	export interface IndReg {
		type: "IndReg";
		reg: Register;
	}

	export interface IndRegDisp {
		type: "IndRegDisp";
		reg: Register;
		offset: number;
	}

	export interface IndRegReg {
		type: "IndRegReg";
		reg1: Register;
		reg2: Register;
	}

	export interface Imm {
		type: "Imm";
		value: number;
	}

	export interface Label {
		type: "Label";
		label: string;
	}

	export interface IndLabel {
		type: "IndLabel";
		label: string;
	}

	export interface IndLabelDisp {
		type: "IndLabelDisp";
		label: string;
		offset: number;
	}

	export interface IndLabelReg {
		type: "IndLabelReg";
		label: string;
		reg: Register;
	}

	export interface IndLabelRegDisp {
		type: "IndLabelRegDisp";
		label: string;
		reg: Register;
		offset: number;
	}
}


export type Instruction =
	Instruction.BinaryInstruction |
	Instruction.Nac |
	Instruction.TernaryInstruction |
	Instruction.Fi |
	Instruction.Inj |
	Instruction.Fen |
	Instruction.Error;

export namespace Instruction {
	export type BinaryOpcode =
		"krz" | "malkrz" | "krz8i" | "krz8c" | "krz16i" | "krz16c" |
		"ata" | "nta" | "ada" | "ekc" | "dal" |
		"dto" | "dro" | "dtosna";
	export const BINARY_OPCODES = [
		"krz", "malkrz", "krz8i", "krz8c", "krz16i", "krz16c",
		"ata", "nta", "ada", "ekc", "dal",
		"dto", "dro", "dtosna"
	];
	export type TernaryOpcode = "lat" | "latsna";
	export const TERNARY_OPCODES = ["lat", "latsna"];

	export function isBinary(inst: Instruction): inst is BinaryInstruction {
		return BINARY_OPCODES.indexOf(inst.opcode) >= 0;
	}

	export function isBinaryOpcode(opcode: string): opcode is BinaryOpcode {
		return BINARY_OPCODES.indexOf(opcode) >= 0;
	}

	export function isTernary(inst: Instruction): inst is TernaryInstruction {
		return TERNARY_OPCODES.indexOf(inst.opcode) >= 0;
	}

	export function isTernaryOpcode(opcode: string): opcode is TernaryOpcode {
		return TERNARY_OPCODES.indexOf(opcode) >= 0;
	}

	export interface BinaryInstruction {
		opcode: BinaryOpcode
		src: Value;
		dst: WritableValue;
	}

	export interface Nac {
		opcode: "nac";
		dst: WritableValue;
	}

	export interface TernaryInstruction {
		opcode: TernaryOpcode;
		src: Value;
		dstl: WritableValue;
		dsth: WritableValue;
	}

	export interface Fi {
		opcode: "fi";
		a: Value;
		b: Value;
		compare: Compare;
	}

	export interface Inj {
		opcode: "inj";
		a: Value;
		b: WritableValue;
		c: WritableValue;
	}

	export interface Fen {
		opcode: "fen";
	}

	export interface Error {
		opcode: "error";
		message: I18nText;
	}
}


export type Compare =
	"xtlo" | "xylo" | "clo" | "xolo" | "llo" | "niv" |
	"xtlonys" | "xylonys" | "xolonys" | "llonys";

export const COMPARES = [
	"xtlo", "xylo", "clo", "xolo", "llo", "niv",
	"xtlonys", "xylonys", "xolonys", "llonys"
];

export function isCompare(compare: string): compare is Compare {
	return COMPARES.indexOf(compare) >= 0;
}


export type LabeledInstruction = {
	instruction: Instruction,
	labels: string[],
	token?: Token;
}

export type LabeledValue = {
	size: number,
	value: number | string,
	labels: string[]
}

export type LabelWithToken = {name: string, token: Token | null};

export interface AsmModule {
	name: string;
	instructions: LabeledInstruction[];
	values: LabeledValue[];
	kueList: LabelWithToken[];
	xokList: LabelWithToken[];
	hasMain: boolean;
}

export class ParseError {
	constructor(public message: I18nText | string, public token: Token | null) {
	}
}

export type CompileResult = {data: AsmModule | null, errors: ParseError[], warnings: ParseError[]};

export class RuntimeError {
	constructor(public message: I18nText) {
	}
}

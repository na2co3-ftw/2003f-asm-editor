import {Hardware} from "./execute";
import {BigInt} from "./bigint";
import {getOperandText} from "./disasseble";

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


export type WritableValue = Value.Reg | Value.IndReg | Value.IndRegDisp | Value.IndRegReg;

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
}


export interface Instruction {
	exec(hw: Hardware): void;
	toString(): string;
}

export namespace Instruction {
	abstract class BinaryInstruction implements Instruction {
		constructor(private src: Value, private dst: WritableValue) {}

		exec(hw: Hardware) {
			hw.setValue(this.dst, this.compute(hw.getValue(this.dst), hw.getValue(this.src), hw));
		}

		protected abstract compute(a: number, b: number, hw:Hardware): number;

		toString(): string {
			return `${this.getName()} ${getOperandText(this.src)} ${getOperandText(this.dst)}`;
		}

		protected abstract getName(): string;
	}

	export class Ata extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (a + b) | 0; }
		protected getName(): string { return "ata"; }
	}

	export class Nta extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (a - b) | 0; }
		protected getName(): string { return "nta"; }
	}

	export class Ada extends BinaryInstruction {
		protected compute(a: number, b: number): number { return a & b; }
		protected getName(): string { return "ada"; }
	}

	export class Ekc extends BinaryInstruction {
		protected compute(a: number, b: number): number { return a | b; }
		protected getName(): string { return "ekc"; }
	}

	export class Dal extends BinaryInstruction {
		protected compute(a: number, b: number): number { return ~(a ^ b); }
		protected getName(): string { return "dal"; }
	}

	export class Dto extends BinaryInstruction {
		protected compute(a: number, b: number, hw: Hardware): number {
			if ((b & 0xffffffc0) != 0) {
				hw.warning(`Shift amount ${b} is larger than 63`);
			}
			return (b & 0xffffffe0) == 0 ? (a >>> b) | 0 : 0;
		}
		protected getName(): string { return "dto"; }
	}

	export class Dro extends BinaryInstruction {
		protected compute(a: number, b: number, hw: Hardware): number {
			if ((b & 0xffffffc0) != 0) {
				hw.warning(`Shift amount ${b} is larger than 63`);
			}
			return (b & 0xffffffe0) == 0 ? a << b : 0;
		}
		protected getName(): string { return "dro"; }
	}

	export class Dtosna extends BinaryInstruction {
		protected compute(a: number, b: number, hw: Hardware): number {
			if ((b & 0xffffffc0) != 0) {
				hw.warning(`Shift amount ${b} is larger than 63`);
			}
			if ((b & 0xffffffe0) == 0) {
				return a >> b;
			} else {
				return (a & 0x80000000) == 0 ? 0 : -1;
			}
		}
		protected getName(): string { return "dtosna"; }
	}

	export class Nac implements Instruction {
		constructor(
			private dst: WritableValue
		) {}

		exec(hw: Hardware) {
			hw.setValue(this.dst, ~hw.getValue(this.dst));
		}

		toString(): string {
			return `nac ${getOperandText(this.dst)}`;
		}
	}

	export class Lat implements Instruction {
		constructor(
			private src: Value,
			private dstl: WritableValue,
			private dsth: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = BigInt.fromUInt32(hw.getValue(this.src));
			const b = BigInt.fromUInt32(hw.getValue(this.dstl));
			const dst = a.times(b).toInt32Array(2);
			hw.setValue(this.dsth, typeof dst[1] != "undefined" ? dst[1] : 0);
			hw.setValue(this.dstl, typeof dst[0] != "undefined" ? dst[0] : 0);
		}

		toString(): string {
			return `lat ${getOperandText(this.src)} ${getOperandText(this.dstl)} ${getOperandText(this.dsth)}`;
		}
	}

	export class Latsna implements Instruction {
		constructor(
			private src: Value,
			private dstl: WritableValue,
			private dsth: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = BigInt.fromInt32(hw.getValue(this.src));
			const b = BigInt.fromInt32(hw.getValue(this.dstl));
			const dst = a.times(b).toInt32Array(2);
			hw.setValue(this.dsth, typeof dst[1] != "undefined" ? dst[1] : 0);
			hw.setValue(this.dstl, typeof dst[0] != "undefined" ? dst[0] : 0);
		}

		toString(): string {
			return `latsna ${getOperandText(this.src)} ${getOperandText(this.dstl)} ${getOperandText(this.dsth)}`;
		}
	}

	export class Krz implements  Instruction {
		constructor(private src: Value, private dst: WritableValue) {}

		exec(hw: Hardware) {
			hw.setValue(this.dst, hw.getValue(this.src));
		}

		toString(): string {
			return `krz ${getOperandText(this.src)} ${getOperandText(this.dst)}`;
		}
	}

	export class MalKrz extends Krz {
		exec(hw: Hardware) {
			if (hw.cpu.flag) super.exec(hw);
		}

		toString(): string {
			return "mal" + super.toString();
		}
	}

	export class Fi implements  Instruction {
		constructor(
			private a: Value,
			private b: Value,
			private compare: Compare
		) {}

		exec(hw: Hardware) {
			const a = hw.getValue(this.a);
			const b = hw.getValue(this.b);
			hw.cpu.flag = COMPARE_TO_FUNC[this.compare](a, b);
		}

		toString(): string {
			return `fi ${getOperandText(this.a)} ${getOperandText(this.b)} ${this.compare}`;
		}
	}

	export class Inj implements  Instruction {
		constructor(
			private a: Value,
			private b: WritableValue,
			private c: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = hw.getValue(this.a);
			const b = hw.getValue(this.b);
			hw.setValue(this.b, a);
			hw.setValue(this.c, b);
		}

		toString(): string {
			return `inj ${getOperandText(this.a)} ${getOperandText(this.b)} ${getOperandText(this.c)}`;
		}
	}

	export class Fen implements Instruction {
		constructor() {}
		exec(hw: Hardware) {}
		toString(): string { return `fen`; }
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

const COMPARE_TO_FUNC: {[compare: string]: (a: number, b:number) => boolean} = {
	xtlo: (a, b) => a <= b,
	xylo: (a, b) => a < b,
	clo: (a, b) => a == b,
	xolo: (a, b) => a >= b,
	llo: (a, b) => a > b,
	niv: (a, b) => a != b,
	xtlonys: (a, b) => (a >>> 0) <= (b >>> 0),
	xylonys: (a, b) => (a >>> 0) < (b >>> 0),
	xolonys: (a, b) => (a >>> 0) >= (b >>> 0),
	llonys: (a, b) => (a >>> 0) > (b >>> 0),
};


export type LabeledInstruction = {
	instruction: Instruction,
	labels: string[],
	token?: Token;
}

export type LabelWithToken = {name: string, token: Token | null};

export interface AsmModule {
	name: string;
	instructions: LabeledInstruction[];
	kueList: LabelWithToken[];
	xokList: LabelWithToken[];
	hasMain: boolean;
}

export class ParseError {
	constructor(public message: string, public token: Token | null) {}
}

export type CompileResult = {data: AsmModule | null, errors: ParseError[], warnings: ParseError[]};

export class RuntimeError {
	constructor(public message: string) {}
}

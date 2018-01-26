import {Hardware} from "./execute";
import {BigInt} from "./bigint";

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


export interface Value {
	getValue(hw: Hardware): number;
}

export interface WritableValue extends Value {
	setValue(hw: Hardware, value: number): void;
}

export namespace Value {
	export class Reg implements WritableValue {
		constructor(private r: Register) {}

		getValue(hw: Hardware): number {
			return hw.cpu.getRegister(this.r);
		}
		setValue(hw: Hardware, value: number) {
			hw.cpu.setRegister(this.r, value);
		}
	}

	export class IndReg implements WritableValue {
		constructor(private r: Register) {}

		getValue(hw: Hardware): number {
			return hw.memory.read(hw.cpu.getRegister(this.r));
		}
		setValue(hw: Hardware, value: number) {
			hw.memory.write(hw.cpu.getRegister(this.r), value);
		}
	}

	export class IndRegDisp implements WritableValue {
		private offset: number;

		constructor(private r: Register, offset: number) {
			this.offset = offset | 0;
		}

		getValue(hw: Hardware): number {
			const address = (hw.cpu.getRegister(this.r) + this.offset) | 0;
			return hw.memory.read(address);
		}
		setValue(hw: Hardware, value: number) {
			const address = (hw.cpu.getRegister(this.r) + this.offset) | 0;
			hw.memory.write(address, value);
		}
	}

	export class IndRegReg implements WritableValue {
		constructor(private r1: Register, private r2: Register) {}

		getValue(hw: Hardware): number {
			const address = (hw.cpu.getRegister(this.r1) + hw.cpu.getRegister(this.r2)) | 0;
			return hw.memory.read(address);
		}
		setValue(hw: Hardware, value: number) {
			const address = (hw.cpu.getRegister(this.r1) + hw.cpu.getRegister(this.r2)) | 0;
			hw.memory.write(address, value);
		}
	}

	export class Imm implements Value {
		public value: number;

		constructor(value: number) {
			this.value = value | 0;
		}

		getValue(hw: Hardware): number {
			return this.value;
		}
	}

	export class Label implements Value {
		constructor(private label: string) {}

		getValue(hw: Hardware): number {
			const address = hw.program.resolveLabel(hw.cpu.nx, this.label);
			if (address == null) {
				throw new RuntimeError(`Undefined label \`${this.label}\``);
			}
			return address;
		}
	}
}


export interface Instruction {
	exec(hw: Hardware): void;
}

export namespace Instruction {
	abstract class BinaryInstruction implements Instruction {
		constructor(private src: Value, private dst: WritableValue) {}

		exec(hw: Hardware) {
			this.dst.setValue(hw, this.compute(this.dst.getValue(hw), this.src.getValue(hw)));
		}

		protected abstract compute(a: number, b: number): number;
	}

	export class Ata extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (a + b) | 0; }
	}

	export class Nta extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (a - b) | 0; }
	}

	export class Ada extends BinaryInstruction {
		protected compute(a: number, b: number): number { return a & b; }
	}

	export class Ekc extends BinaryInstruction {
		protected compute(a: number, b: number): number { return a | b; }
	}

	export class Dal extends BinaryInstruction {
		protected compute(a: number, b: number): number { return ~(a ^ b); }
	}

	export class Dto extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (b & 0xffffffe0) == 0 ? (a >>> b) | 0 : 0; }
	}

	export class Dro extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (b & 0xffffffe0) == 0 ? a << b : 0; }
	}

	export class Dtosna extends BinaryInstruction {
		protected compute(a: number, b: number): number {
			if ((b & 0xffffffe0) == 0) {
				return a >> b;
			} else {
				return (a & 0x80000000) == 0 ? 0 : -1;
			}
		}
	}

	export class Nac implements Instruction {
		constructor(
			private dst: WritableValue
		) {}

		exec(hw: Hardware) {
			this.dst.setValue(hw, ~this.dst.getValue(hw));
		}
	}

	export class Lat implements Instruction {
		constructor(
			private src: Value,
			private dstl: WritableValue,
			private dsth: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = BigInt.fromUInt32(this.src.getValue(hw));
			const b = BigInt.fromUInt32(this.dstl.getValue(hw));
			const dst = a.times(b).toInt32Array(2);
			this.dsth.setValue(hw, typeof dst[1] != "undefined" ? dst[1] : 0);
			this.dstl.setValue(hw, typeof dst[0] != "undefined" ? dst[0] : 0);
		}
	}

	export class Latsna implements Instruction {
		constructor(
			private src: Value,
			private dstl: WritableValue,
			private dsth: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = BigInt.fromInt32(this.src.getValue(hw));
			const b = BigInt.fromInt32(this.dstl.getValue(hw));
			const dst = a.times(b).toInt32Array(2);
			this.dsth.setValue(hw, typeof dst[1] != "undefined" ? dst[1] : 0);
			this.dstl.setValue(hw, typeof dst[0] != "undefined" ? dst[0] : 0);
		}
	}

	export class Krz implements  Instruction {
		constructor(private src: Value, private dst: WritableValue) {}

		exec(hw: Hardware) {
			this.dst.setValue(hw, this.src.getValue(hw));
		}
	}

	export class MalKrz extends Krz {
		exec(hw: Hardware) {
			if (hw.cpu.flag) super.exec(hw);
		}
	}

	export class Fi implements  Instruction {
		constructor(
			private a: Value,
			private b: Value,
			private compare: Compare
		) {}

		exec(hw: Hardware) {
			const a = this.a.getValue(hw);
			const b = this.b.getValue(hw);
			hw.cpu.flag = COMPARE_TO_FUNC[this.compare](a, b);
		}
	}

	export class Inj implements  Instruction {
		constructor(
			private a: Value,
			private b: WritableValue,
			private c: WritableValue
		) {}

		exec(hw: Hardware) {
			const a = this.a.getValue(hw);
			const b = this.b.getValue(hw);
			this.b.setValue(hw, a);
			this.c.setValue(hw, b);
		}
	}

	export class Fen implements Instruction {
		constructor() {}
		exec(hw: Hardware) {}
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

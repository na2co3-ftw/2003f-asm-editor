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

export enum Register {
	f0, f1, f2, f3, f5, xx
}

export const REGISTER_RESERVED = [
	"f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "xx"
];

export interface Value {
	getValue(hw: Hardware): number;
}

export interface WritableValue extends Value {
	setValue(hw: Hardware, value: number);
}

export namespace Value {
	export class R implements WritableValue {
		constructor(private r: Register) {}

		getValue(hw: Hardware): number {
			return hw.cpu.getRegister(this.r);
		}
		setValue(hw: Hardware, value: number) {
			hw.cpu.setRegister(this.r, value);
		}
	}

	export class RPlusNum implements WritableValue {
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

	export class RPlusR implements WritableValue {
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

	export class Pure implements Value {
		private value: number;

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
	exec(hw: Hardware);
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
		protected compute(a: number, b: number): number { return (b & 0xffffffe0) == 0 ? a >>> b : 0; }
	}

	export class Dro extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (b & 0xffffffe0) == 0 ? a << b : 0; }
	}

	export class Dtosna extends BinaryInstruction {
		protected compute(a: number, b: number): number { return (b & 0xffffffe0) == 0 ? a >> b : 0; }
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
			private cond: Cond
		) {}

		exec(hw: Hardware) {
			const a = this.a.getValue(hw);
			const b = this.b.getValue(hw);
			hw.cpu.flag = COND_TO_FUNC[this.cond](a, b);
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
}

export enum Cond {
	xtlo, xylo, clo, xolo, llo, niv, xtlonys, xylonys, xolonys, llonys
}

export const COND_TO_FUNC = {
	[Cond.xtlonys]: (a, b) => a <= b,
	[Cond.xylonys]: (a, b) => a < b,
	[Cond.clo]: (a, b) => a == b,
	[Cond.xolonys]: (a, b) => a >= b,
	[Cond.llonys]: (a, b) => a > b,
	[Cond.niv]: (a, b) => a != b,
	[Cond.xtlo]: lif((a, b) => a <= b),
	[Cond.xylo]: lif((a, b) => a < b),
	[Cond.xolo]: lif((a, b) => a >= b),
	[Cond.llo]: lif((a, b) => a > b),
};

export class ParseError {
	constructor(public message: string) {}
}

export class RuntimeError {
	constructor(public message: string) {}
}

function lif(f: (a: number, b: number) => boolean): (a: number, b: number) => boolean {
	return (a, b) => f(a ^ 0x80000000, b ^ 0x80000000);
}

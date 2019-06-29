import {Instruction, Register, RuntimeError, Value, WritableValue} from "./types";
import {Memory} from "./memory";
import {initialAddress, Program} from "./linker";
import {V} from "./builder";
import {BigInt} from "./bigint";
import {InterpreterText} from "../i18n/interpreter-text";
import {I18nText} from "../i18n/text";

const initialF5 = 0x6d7aa0f8|0;
const outermostRetAddress = 0xbda574b8|0;
const debugOutputAddress = 0xba5fb6b0|0;

const COMPARE_TO_FUNC: { [compare: string]: (a: number, b: number) => boolean } = {
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

const BININST_TO_FUNC: { [opcode: string]: (a: number, b: number, hw: Hardware) => number } = {
	ata: (a, b) => (a + b) | 0,
	nta: (a, b) => (a - b) | 0,
	ada: (a, b) => a & b,
	ekc: (a, b) => a | b,
	dal: (a, b) => ~(a ^ b),

	dto(a, b, hw) {
		if ((b & 0xffffffc0) != 0) {
			hw.warning(InterpreterText.too_large_shift_amount(b));
		}
		return (b & 0xffffffe0) == 0 ? (a >>> b) | 0 : 0;
	},

	dro(a, b, hw) {
		if ((b & 0xffffffc0) != 0) {
			hw.warning(InterpreterText.too_large_shift_amount(b));
		}
		return (b & 0xffffffe0) == 0 ? a << b : 0;
	},

	dtosna(a, b, hw) {
		if ((b & 0xffffffc0) != 0) {
			hw.warning(InterpreterText.too_large_shift_amount(b));
		}
		if ((b & 0xffffffe0) == 0) {
			return a >> b;
		} else {
			return (a & 0x80000000) == 0 ? 0 : -1;
		}
	}
};

export class CPU {
	f0: number = 0x82ebfc85|0; // garbage
	f1: number = 0xfc73c497|0; // garbage
	f2: number = 0x9cf84b9d|0; // garbage
	f3: number = 0x92c073e6|0; // garbage
	f5: number = initialF5;
	nx: number;
	xx: number = 0xba3decfd|0; // garbage
	flag: boolean = false;

	constructor(initNx: number) {
		this.nx = initNx;
	}

	getRegister(r: Register): number {
		//console.log(`${r} -> ${this[r]}`);
		return this[r];
	}

	setRegister(r: Register, value: number) {
		//console.log(`${r} <- ${value}`);
		this[r] = value;
	}
}

const enum ExecResult {
	CONTINUE, END, BREAK, ERROR
}

type MemoryValue =
	Value.IndReg | Value.IndRegDisp | Value.IndRegReg |
	Value.IndLabel | Value.IndLabelDisp | Value.IndLabelReg | Value.IndLabelRegDisp;

const MEMORY_VALUES = [
	"IndReg", "IndRegDisp", "IndRegReg", "IndLabel", "IndLabelDisp", "IndLabelReg", "IndLabelRegDisp"
];

function isMemoryValue(value: Value): value is MemoryValue {
	return MEMORY_VALUES.indexOf(value.type) >= 0;
}

export class Hardware {
	cpu: CPU;
	memory: Memory;
	program: Program | null = null;
	log: string[];
	errors: RuntimeError[];
	warnings: RuntimeError[];

	constructor() {
		this.cpu = new CPU(initialAddress);
		this.memory = new Memory(this);
		this.memory.write(initialF5, outermostRetAddress);
		this.log = [];
		this.errors = [];
		this.warnings = [];
	}

	execute(program: Program, callback: () => void) {
		this.load(program);
		this.log = [];
		const f = () => {
			if (this.execOneInstruction(false) == ExecResult.CONTINUE) {
				setTimeout(f, 0);
			} else {
				callback();
			}
		};
		setTimeout(f, 0);
	}

	load(program: Program) {
		this.program = program;
		this.program.initializeMemory(this.memory);
	}

	execOneStep(initial: boolean = false): boolean {
		let ret = this.execOneInstruction(initial);
		while (ret == ExecResult.CONTINUE) {
			ret = this.execOneInstruction(true);
		}
		return ret != ExecResult.END && ret != ExecResult.ERROR;
	}

	finalize() {
		if (this.cpu.f5 != initialF5) {
			this.errors.push(new RuntimeError(InterpreterText.f5_is_not_preserved({
				expected: initialF5,
				actual: this.cpu.f5
			})));
		}
	}

	private execInstruction(inst: Instruction) {
		if (Instruction.isBinary(inst)) {
			switch (inst.opcode) {
				case "krz":
					this.setValue(inst.dst, this.getValue(inst.src));
					return;
				case "malkrz":
					if (this.cpu.flag) {
						this.setValue(inst.dst, this.getValue(inst.src));
					}
					return;
				case "krz8i":
					this.setValue(inst.dst, this.getValue8(inst.src));
					return;
				case "krz8c":
					this.setValue8(inst.dst, this.getValue(inst.src));
					return;
				case "krz16i":
					this.setValue(inst.dst, this.getValue16(inst.src));
					return;
				case "krz16c":
					this.setValue16(inst.dst, this.getValue(inst.src));
					return;
			}

			const a = this.getValue(inst.dst);
			const b = this.getValue(inst.src);
			this.setValue(inst.dst, BININST_TO_FUNC[inst.opcode](a, b, this));
			return;
		}

		switch (inst.opcode) {
			case "nac":
				this.setValue(inst.dst, ~this.getValue(inst.dst));
				return;
			case "lat": {
				const a = BigInt.fromUInt32(this.getValue(inst.src));
				const b = BigInt.fromUInt32(this.getValue(inst.dstl));
				const dst = a.times(b).toInt32Array(2);
				this.setValue(inst.dsth, typeof dst[1] != "undefined" ? dst[1] : 0);
				this.setValue(inst.dstl, typeof dst[0] != "undefined" ? dst[0] : 0);
				return;
			}
			case "latsna": {
				const a = BigInt.fromInt32(this.getValue(inst.src));
				const b = BigInt.fromInt32(this.getValue(inst.dstl));
				const dst = a.times(b).toInt32Array(2);
				this.setValue(inst.dsth, typeof dst[1] != "undefined" ? dst[1] : 0);
				this.setValue(inst.dstl, typeof dst[0] != "undefined" ? dst[0] : 0);
				return;
			}
			case "fi": {
				const a = this.getValue(inst.a);
				const b = this.getValue(inst.b);
				this.cpu.flag = COMPARE_TO_FUNC[inst.compare](a, b);
				return;
			}
			case "inj": {
				const a = this.getValue(inst.a);
				const b = this.getValue(inst.b);
				this.setValue(inst.b, a);
				this.setValue(inst.c, b);
				return;
			}
			case "fen":
				return;
			case "error":
				throw new RuntimeError(inst.message);
		}
	}

	private calcAddress(operand: MemoryValue): number {
		switch (operand.type) {
			case "IndReg":
				return this.cpu.getRegister(operand.reg);
			case "IndRegDisp":
				return (this.cpu.getRegister(operand.reg) + operand.offset) | 0;
			case "IndRegReg":
				return (this.cpu.getRegister(operand.reg1) + this.cpu.getRegister(operand.reg2)) | 0;
			case "IndLabel":
				return this.resolveLabel(operand.label);
			case "IndLabelDisp":
				return (this.resolveLabel(operand.label) + operand.offset) | 0;
			case "IndLabelReg":
				return (this.resolveLabel(operand.label) + this.cpu.getRegister(operand.reg)) | 0;
			case "IndLabelRegDisp":
				return (this.resolveLabel(operand.label) +
					this.cpu.getRegister(operand.reg) + operand.offset) | 0;
		}
	}

	warning(message: I18nText) {
		this.warnings.push(new RuntimeError(message));
	}

	private getValue(operand: Value): number {
		if (isMemoryValue(operand)) {
			return this.memory.read(this.calcAddress(operand));
		}
		switch (operand.type) {
			case "Reg":
				return this.cpu.getRegister(operand.reg);
			case "Imm":
				return operand.value;
			case "Label":
				return this.resolveLabel(operand.label);
		}
	}

	private setValue(operand: WritableValue, value: number) {
		if (isMemoryValue(operand)) {
			this.memory.write(this.calcAddress(operand), value);
			return;
		}
		this.cpu.setRegister(operand.reg, value);
	}

	private getValue8(operand: Value): number {
		if (isMemoryValue(operand)) {
			return this.memory.read8(this.calcAddress(operand));
		}
		switch (operand.type) {
			case "Reg":
				return this.cpu.getRegister(operand.reg) >> 24;
			case "Imm":
				return operand.value >> 24;
			case "Label":
				return this.resolveLabel(operand.label) >> 24;
		}
	}

	private setValue8(operand: WritableValue, value: number) {
		if (isMemoryValue(operand)) {
			this.memory.write8(this.calcAddress(operand), value);
			return;
		}

		const oldValue = this.cpu.getRegister(operand.reg);
		this.cpu.setRegister(operand.reg, (oldValue & 0x00ffffff) | ((value & 0xff) << 24));
	}

	private getValue16(operand: Value): number {
		if (isMemoryValue(operand)) {
			return this.memory.read16(this.calcAddress(operand));
		}
		switch (operand.type) {
			case "Reg":
				return this.cpu.getRegister(operand.reg) >> 16;
			case "Imm":
				return operand.value >> 16;
			case "Label":
				return this.resolveLabel(operand.label) >> 16;
		}
	}

	private setValue16(operand: WritableValue, value: number) {
		if (isMemoryValue(operand)) {
			this.memory.write16(this.calcAddress(operand), value);
			return;
		}

		const oldValue = this.cpu.getRegister(operand.reg);
		this.cpu.setRegister(operand.reg, (oldValue & 0x0000ffff) | ((value & 0xffff) << 16));
	}

	private execOneInstruction(breakNewStep: boolean): ExecResult {
		if (this.program == null) {
			return ExecResult.END;
		}
		const xxInst = this.program.readInstruction(this.cpu.nx);
		if (xxInst == null) {
			this.errors.push(new RuntimeError(InterpreterText.invalid_nx_address(this.cpu.nx)));
			return ExecResult.ERROR;
		}
		const {next, instruction, token} = xxInst;
		if (breakNewStep && token) {
			return ExecResult.BREAK;
		}

		this.cpu.xx = next;
		try {
			this.execInstruction(instruction);
		} catch (e) {
			if (e instanceof RuntimeError) {
				this.errors.push(e);
				return ExecResult.ERROR;
			}
			throw e;
		}
		this.updateNX();

		if (this.cpu.nx == outermostRetAddress) {
			this.finalize();
			return ExecResult.END;
		} else if (this.cpu.nx == debugOutputAddress) {
			const value = this.getValue(V.f5_4io);
			this.log.push((value >>> 0).toString());
			this.cpu.xx = this.getValue(V.f5io);
			this.updateNX();
		}
		return ExecResult.CONTINUE;
	}

	updateNX() {
		this.cpu.nx = this.cpu.xx;
	}

	private resolveLabel(label: string): number {
		if (this.program == null) {
			throw new RuntimeError(InterpreterText.undefined_label(label));
		}
		const address = this.program.resolveLabel(this.cpu.nx, label);
		if (address == null) {
			throw new RuntimeError(InterpreterText.undefined_label(label));
		}
		return address;
	}
}

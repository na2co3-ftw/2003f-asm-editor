import {Instruction, Register, RuntimeError, Value} from "./types";
import {initialAddress, TentativeLoad} from "./tentativeLoad";
import {Memory} from "./memory";

const initialF5 = 0x6d7aa0f8|0;
const outermostRetAddress = 0xbda574b8|0;
const debugOutputAddress = 0xba5fb6b0|0;

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
		//console.log(`${Register[r]} -> ${this[r]}`);
		if (r == Register.f0) return this.f0;
		if (r == Register.f1) return this.f1;
		if (r == Register.f2) return this.f2;
		if (r == Register.f3) return this.f3;
		if (r == Register.f5) return this.f5;
		if (r == Register.xx) return this.xx;
		throw new RuntimeError("cannot happen");
	}

	setRegister(r: Register, value: number) {
		//console.log(`${Register[r]} <- ${value}`);
		if (r == Register.f0) { this.f0 = value; return; }
		if (r == Register.f1) { this.f1 = value; return; }
		if (r == Register.f2) { this.f2 = value; return; }
		if (r == Register.f3) { this.f3 = value; return; }
		if (r == Register.f5) { this.f5 = value; return; }
		if (r == Register.xx) {
			this.xx = value; return;
		}
	}
}

export class Hardware {
	cpu: CPU;
	memory: Memory;
	program: TentativeLoad;
	log: string[];

	constructor() {
		this.cpu = new CPU(initialAddress);
		this.memory = new Memory();
		this.memory.write(initialF5, outermostRetAddress);
		this.log = [];
	}

	execute(program: TentativeLoad, callback: () => void) {
		this.load(program);
		this.log = [];
		const f = () => {
			if (this.execOne()) {
				setTimeout(f, 0);
			} else {
				callback();
			}
		};
		setTimeout(f, 0);
	}

	load(program: TentativeLoad) {
		this.program = program;
	}

	execOne(): boolean {
		const instruction = this.updateXXAndGetInstruction();
		if (instruction instanceof Instruction.TERMINATE) {
			return this.finalize();
		}
		instruction.exec(this);
		this.updateNX();
		return true;
	}

	finalize(): boolean {
		if (this.cpu.f5 != initialF5) {
			throw new RuntimeError(`f5 register was not preserved after the call. It should be in ${initialF5} but is actually in ${this.cpu.f5}`);
		}
		return false;
	}

	updateNX() {
		this.cpu.nx = this.cpu.xx;
	}

	updateXXAndGetInstruction(): Instruction {
		const tat = this.program.tentativeAddresTable;
		if (tat.hasOwnProperty(this.cpu.nx)) {
			const [newXX, instruction] = tat[this.cpu.nx];
			this.cpu.xx = newXX;
			return instruction;
		} else {
			if (this.cpu.nx == outermostRetAddress) {
				return new Instruction.TERMINATE();
			} else if (this.cpu.nx == debugOutputAddress) {
				const value = new Value.RPlusNum(Register.f5, 4).getValue(this);
				this.log.push(value.toString());
				return new Instruction.Krz(null, new Value.RPlusNum(Register.f5, 0), new Value.R(Register.xx));
			} else {
				throw new RuntimeError("nx has an invalid address " + this.cpu.nx);
			}
		}
	}
}

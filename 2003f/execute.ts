import {Register, RuntimeError, Value} from "./types";
import {Memory} from "./memory";
import {initialAddress, Program} from "./linker";

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
	}

	execOneStep(initial: boolean = false): boolean {
		let ret = this.execOneInstruction(initial);
		while (ret == ExecResult.CONTINUE) {
			ret = this.execOneInstruction(true);
		}
		return ret != ExecResult.END && ret != ExecResult.ERROR;
	}

	private execOneInstruction(breakNewStep: boolean): ExecResult {
		if (this.program == null) {
			return ExecResult.END;
		}
		const xxInst = this.program.readNX(this.cpu.nx);
		if (xxInst == null) {
			this.errors.push(new RuntimeError("nx has an invalid address " + this.cpu.nx));
			return ExecResult.ERROR;
		}
		const {next, instruction, token} = xxInst;
		if (breakNewStep && token) {
			return ExecResult.BREAK;
		}
		
		this.cpu.xx = next;
		try {
			instruction.exec(this);
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
			const value = new Value.IndRegDisp("f5", 4).getValue(this);
			this.log.push((value >>> 0).toString());
			this.cpu.xx = new Value.IndRegDisp("f5", 0).getValue(this);
			this.updateNX();
		}
		return ExecResult.CONTINUE;
	}

	finalize() {
		if (this.cpu.f5 != initialF5) {
			this.errors.push(new RuntimeError(`f5 register was not preserved after the call. It should be in ${initialF5} but is actually in ${this.cpu.f5}`));
		}
	}

	updateNX() {
		this.cpu.nx = this.cpu.xx;
	}

	warning(message: string) {
		this.warnings.push(new RuntimeError(message));
	}
}

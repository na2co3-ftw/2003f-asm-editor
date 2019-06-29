import {Hardware} from "./execute";
import {InterpreterText} from "../i18n/interpreter-text";

function decompose(a: number): [number, number, number, number] {
	return [
		a >>> 24,
		(a >>> 16) & 0xff,
		(a >>> 8) & 0xff,
		a & 0xff
	];
}

function compose(a: number, b: number, c: number, d: number): number {
	return (a << 24) + (b << 16) + (c << 8) + d;
}

export const SECTION_SIZE = 4;

export class Memory {
	data: {[address: number]: number} = {};
	usingSections: number[] = [];
	constructor(private hw: Hardware) {}

	write(address: number, value: number) {
		if ((address & 0x3) != 0) {
			this.hw.warning(InterpreterText.write_memory_not_aligned(address));
		}
		const [a, b, c, d] = decompose(value);
		this.writeByte(address, a);
		this.writeByte(address + 1, b);
		this.writeByte(address + 2, c);
		this.writeByte(address + 3, d);
		this.useMemory(address, 4);
	}

	write16(address: number, value: number) {
		if ((address & 0x1) != 0) {
			this.hw.warning(InterpreterText.write_memory_not_aligned(address));
		}
		this.writeByte(address, (value >> 8) & 0xff);
		this.writeByte(address + 1, value & 0xff);
		this.useMemory(address, 2);
	}

	write8(address: number, value: number) {
		this.writeByte(address, value & 0xff);
		this.useMemory(address, 1);
	}

	read16(address: number): number {
		if ((address & 0x1) != 0) {
			this.hw.warning(InterpreterText.read_memory_not_aligned(address));
		}
		const a = this.readByte(address);
		const b = this.readByte(address + 1);
		return ((a << 24) >> 16) + b;
	}

	read(address: number): number {
		if ((address & 0x3) != 0) {
			this.hw.warning(InterpreterText.read_memory_not_aligned(address));
		}
		const a = this.readByte(address);
		const b = this.readByte(address + 1);
		const c = this.readByte(address + 2);
		const d = this.readByte(address + 3);
		return compose(a, b, c, d);
	}

	read8(address: number): number {
		return (this.readByte(address) << 24) >> 24;
	}

	private writeByte(address: number, value: number) {
		this.data[address] = value;
	}

	private readByte(address: number): number {
		if (this.data.hasOwnProperty(address)) {
			return this.data[address];
		}
		const value = Math.floor(Math.random() * 0x100);
		this.hw.warning(InterpreterText.read_memory_uninitialized);
		this.writeByte(address, value);
		this.useMemory(address, 1);
		return value;
	}

	private useMemory(address: number, size: number) {
		const section = address >>> SECTION_SIZE;
		if (this.usingSections.indexOf(section) < 0) {
			this.usingSections.push(section);
			this.usingSections.sort((a, b) => a - b);
		}

		const endSection = (address + size - 1) >>> SECTION_SIZE;
		if (section != endSection) {
			if (this.usingSections.indexOf(endSection) < 0) {
				this.usingSections.push(endSection);
				this.usingSections.sort((a, b) => a - b);
			}
		}
	}
}

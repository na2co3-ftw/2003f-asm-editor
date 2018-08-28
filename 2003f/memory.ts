import {Hardware} from "./execute";

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
			this.hw.warning(`Write memory by not aligned address ${address}`);
		}
		const [a, b, c, d] = decompose(value);
		//console.log(`${address} <- ${value}`);
		this.writeByte(address, a);
		this.writeByte(address + 1, b);
		this.writeByte(address + 2, c);
		this.writeByte(address + 3, d);
		const section = address >>> SECTION_SIZE;
		if (this.usingSections.indexOf(section) < 0) {
			this.usingSections.push(section);
			this.usingSections.sort((a, b) => a - b);
		}
	}

	writeByte(address: number, value: number) {
		this.data[address] = value;
	}

	read(address: number): number {
		if ((address & 0x3) != 0) {
			this.hw.warning(`Read memory by not aligned address ${address}`);
		}
		const a = this.readByte(address);
		const b = this.readByte(address + 1);
		const c = this.readByte(address + 2);
		const d = this.readByte(address + 3);
		//console.log(`${address} -> ${compose(a, b, c, d)}`);
		return compose(a, b, c, d);
	}

	readByte(address: number): number {
		if (this.data.hasOwnProperty(address)) {
			return this.data[address];
		}
		const value = Math.floor(Math.random() * 0x100);
		this.hw.warning("Read undefined memory");
		this.writeByte(address, value);
		return value;
	}
}

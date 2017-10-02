import {Instruction, ParseError} from "./types";
import {Program} from "./linker";

export class TentativeLoad implements Program {
	constructor(
		private tentativeAddresTable: {[address: number]: [number, Instruction]},
		private labelTable: {[label: string]: number}
	) {}

	resolveLabel(label: string): number | null {
		if (this.labelTable.hasOwnProperty(label)) {
			return this.labelTable[label];
		}
		return null;
	}

	readNX(address: number): [number, Instruction] | null {
		if (this.tentativeAddresTable.hasOwnProperty(address)) {
			return this.tentativeAddresTable[address];
		}
		return null;
	}

	static from(initialAddress: number, arr: {instruction: Instruction, labels: string[]}[]): TentativeLoad {
		let tentativeAddressTable: {[address: number]: [number, Instruction]} = {};
		let labelTable: {[label: string]: number} = {};
		let address = initialAddress;
		for (let {instruction, labels} of arr) {
			let next = (address + Math.floor(Math.random() * 4) + 1) | 0;
			tentativeAddressTable[address] = [next, instruction];
			for (let label of labels) {
				if (labelTable.hasOwnProperty(label)) {
					throw new ParseError("duplicating label: " + label);
				}
				labelTable[label] = address;
			}
			address = next;
		}
		return new TentativeLoad(tentativeAddressTable, labelTable);
	}
}

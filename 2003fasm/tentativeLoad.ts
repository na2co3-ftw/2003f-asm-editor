import {Instruction, ParseError} from "./types";

export const initialAddress = 0x1482e8d4|0;

export class TentativeLoad {
	constructor(
		public tentativeAddresTable: {[address: number]: [number, Instruction]},
		public labelTable: {[label: string]: number}
	) {}

	static from(arr: {instruction: Instruction, labels: string[]}[]): TentativeLoad {
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

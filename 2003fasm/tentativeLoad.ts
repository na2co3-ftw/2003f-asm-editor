import {Instruction, ParseError} from "./types";
import {ParsedFile} from "./parse";

export const MAX_SIZE = 65536;

export class TentativeLoad {
	constructor(
		private tentativeAddresTable: {[address: number]: [number, Instruction]},
		private labelTable: {[label: string]: number},
		private xokList: string[],
	) {}

	resolveLabel(label: string, kueTable: {[label: string]: number} = {}): number | null {
		if (this.labelTable.hasOwnProperty(label)) {
			return this.labelTable[label];
		}
		if (this.xokList.indexOf(label) < 0) {
			return null;
		}
		if (kueTable.hasOwnProperty(label)) {
			return kueTable[label];
		}
		return null;
	}

	readNX(address: number): [number, Instruction] | null {
		if (this.tentativeAddresTable.hasOwnProperty(address)) {
			return this.tentativeAddresTable[address];
		}
		return null;
	}

	static from(baseAddress: number, file: ParsedFile): TentativeLoad {
		let tentativeAddressTable: {[address: number]: [number, Instruction]} = {};
		let labelTable: {[label: string]: number} = {};
		let localAddress = 0;
		for (let {instruction, labels} of file.instructions) {
			const address = (baseAddress + localAddress) | 0;
			const next = localAddress + Math.floor(Math.random() * 4) + 1;
			tentativeAddressTable[address] = [(baseAddress + next) | 0, instruction];
			for (let label of labels) {
				if (labelTable.hasOwnProperty(label)) {
					throw new ParseError("duplicating local label: " + label);
				}
				labelTable[label] = address;
			}
			localAddress = next;
			if (localAddress >= MAX_SIZE) {
				throw new ParseError("size limit of a single file was exceeded");
			}
		}
		for (const xok of file.xokList) {
			if (labelTable.hasOwnProperty(xok)) {
				throw new ParseError(`conflict: cannot import label \`${xok}\` that is already defined in the file`);
			}
		}
		return new TentativeLoad(tentativeAddressTable, labelTable, file.xokList);
	}
}

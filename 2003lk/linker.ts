import {MAX_SIZE, TentativeLoad, LoadedInstruction} from "./tentativeLoad";
import {ParsedFile} from "./parse";
import {ParseError} from "./types";

export const initialAddress = 0x14830000|0;

export class Program {
	constructor(
		private pages: TentativeLoad[],
		private kueTable: {[label: string]: number}
		) {}

	readNX(address: number): LoadedInstruction | null {
		const pageId = addressToPageId(address);
		if (this.pages.hasOwnProperty(pageId)) {
			return this.pages[pageId].readNX(address);
		}
		return null;
	}

	resolveLabel(currentNX: number, label: string): number | null {
		const pageId = addressToPageId(currentNX);
		if (this.pages.hasOwnProperty(pageId)) {
			return this.pages[pageId].resolveLabel(label, this.kueTable);
		}
		return null;
	}

	static link(files: ParsedFile[]): Program {
		let hasMain = false;
		let loads: TentativeLoad[] = [];
		let kueTable: {[label: string]: number} = {};
		files.forEach((file, index) => {
			let pageId = index + 1;
			if (file.hasMain) {
				pageId = 0;
				if (hasMain) {
					throw new ParseError("multiple main files");
				}
				hasMain = true;
			}

			const loaded = TentativeLoad.from((initialAddress + pageId * MAX_SIZE) | 0, file);
			
			for (const kue of file.kueList) {
				const address = loaded.resolveLabel(kue);
				if (address == null) {
					throw new ParseError(`cannot export label \`${kue}\` that is not defined in the file`);
				}
				if (kueTable.hasOwnProperty(kue)) {
					throw new ParseError(`conflict: different files export the same label \`${kue}\``);
				}
				kueTable[kue] = address;
			}

			loads[pageId] = loaded;
		});
		if (!hasMain) {
			throw new ParseError("no main file");
		}
		return new Program(loads, kueTable);
	}
}

function addressToPageId(address: number): number {
	return Math.floor(((address - initialAddress) >>> 0) / MAX_SIZE);
}

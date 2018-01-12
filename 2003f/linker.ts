import {AsmModule, Instruction, ParseError, Token} from "./types";

export const initialAddress = 0x14830000|0;

const PAGE_SIZE = 65536;

export interface LoadedInstruction {
	next: number,
	instruction: Instruction,
	token?: Token
}

export interface TentativeLoad {
	addressTable: Map<number, LoadedInstruction>;
	labels: Map<string, number>;
	xoks: Set<string>;
}

export class Program {
	constructor(
		private pages: Map<number, TentativeLoad>,
		private kueTable: Map<string, number>
	) {}

	readNX(address: number): LoadedInstruction | null {
		const page = this.pages.get(addressToPageId(address));
		if (page) {
			return page.addressTable.get(address) || null;
		}
		return null;
	}

	resolveLabel(currentNX: number, label: string): number | null {
		const page = this.pages.get(addressToPageId(currentNX));
		if (page) {
			const localLabel = page.labels.get(label);
			if (localLabel) {
				return localLabel;
			}
			if (page.xoks.has(label)) {
				return this.kueTable.get(label)!;
			}
			return null;
		}
		return null;
	}
}

export function linkModules(files: AsmModule[]): {program: Program, errors: ParseError[]} {
	let hasMain = false;
	let pages = new Map<number, TentativeLoad>();
	let kueTable = new Map<string, number>();
	let errors: ParseError[] = [];
	files.forEach((file, index) => {
		let pageId = index + 1;
		if (file.hasMain) {
			pageId = 0;
			if (hasMain) {
				errors.push(new ParseError("Multiple main files", null));
			} else {
				pageId = 0;
				hasMain = true;
			}
		}

		const baseAddress = (initialAddress + pageId * PAGE_SIZE) | 0;
		const {page, errors: loadErrors} = toTentativeLoad(baseAddress, file);
		errors.push(...loadErrors);

		for (const kue of file.kueList) {
			const address = page.labels.get(kue.name)!;
			if (kueTable.has(kue.name)) {
				errors.push(new ParseError(`Different files export the same label '${kue.name}'`, kue.token));
				continue;
			}
			kueTable.set(kue.name, address);
		}

		pages.set(pageId, page);
	});
	for (const file of files) {
		for (const xok of file.xokList) {
			if (!kueTable.has(xok.name)) {
				errors.push(new ParseError(`'${xok.name}' is not defined in any other file`, xok.token));
			}
		}
	}

	if (!hasMain) {
		errors.push(new ParseError("No main file", null));
	}
	return {program: new Program(pages, kueTable), errors};
}

function addressToPageId(address: number): number {
	return Math.floor(((address - initialAddress) >>> 0) / PAGE_SIZE);
}

function toTentativeLoad(baseAddress: number, file: AsmModule): {page: TentativeLoad, errors: ParseError[]} {
	let addressTable = new Map<number, LoadedInstruction>();
	let labels = new Map<string, number>();
	let localAddress = 0;
	let errors: ParseError[] = [];
	for (const inst of file.instructions) {
		const address = (baseAddress + localAddress) | 0;
		const next = localAddress + Math.floor(Math.random() * 4) + 1;
		addressTable.set(address, {
			next: (baseAddress + next) | 0,
			instruction: inst.instruction,
			token: inst.token
		});
		for (let label of inst.labels) {
			labels.set(label, address);
		}
		localAddress = next;
		if (localAddress >= PAGE_SIZE) {
			errors.push(new ParseError(`Size of '${file.name}' is exceeds the limit`, null));
			break;
		}
	}
	return {
		page: {
			addressTable,
			labels,
			xoks: new Set(file.xokList.map(x => x.name)),
		},
		errors
	};
}

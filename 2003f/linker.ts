import {AsmModule, Instruction, ParseError, Token} from "./types";
import {Memory} from "./memory";
import {LinkerText} from "../i18n/linker-text";

export const initialAddress = 0x14830000|0;

const PAGE_SIZE = 65536;

export interface LoadedInstruction {
	next: number,
	instruction: Instruction,
	token?: Token
}

export interface LoadedValue {
	size: number,
	value: number | string
}

export interface TentativeLoad {
	codeTable: Map<number, LoadedInstruction>;
	valueTable: Map<number, LoadedValue>;
	labels: Map<string, number>;
	xoks: Set<string>;
}

export class Program {
	constructor(
		private pages: Map<number, TentativeLoad>,
		private kueTable: Map<string, number>
	) {}

	readInstruction(address: number): LoadedInstruction | null {
		const page = this.pages.get(addressToPageId(address));
		if (page) {
			return page.codeTable.get(address) || null;
		}
		return null;
	}

	resolveLabel(currentNX: number, label: string): number | null {
		return this.resolveLabelWithPageId(addressToPageId(currentNX), label);
	}

	initializeMemory(memory: Memory) {
		for (const [pageId, page] of this.pages) {
			for (const [address, value] of page.valueTable) {
				let v;
				if (typeof value.value == "number") {
					v = value.value;
				} else {
					v = this.resolveLabelWithPageId(pageId, value.value);
					if (v == null) {
						continue;
					}
				}
				if (value.size == 4) {
					memory.write(address, v);
				} else if (value.size == 2) {
					memory.write16(address, v);
				} else {
					memory.write8(address, v);
				}
			}
		}
	}

	private resolveLabelWithPageId(pageId: number, label: string): number | null {
		const page = this.pages.get(pageId);
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
				errors.push(new ParseError(LinkerText.multiple_main_files, null));
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
				errors.push(new ParseError(LinkerText.duplicated_global_label(kue.name), kue.token));
				continue;
			}
			kueTable.set(kue.name, address);
		}

		pages.set(pageId, page);
	});
	for (const file of files) {
		for (const xok of file.xokList) {
			if (!kueTable.has(xok.name)) {
				errors.push(new ParseError(LinkerText.undefined_external_label(xok.name), xok.token));
			}
		}
	}

	if (!hasMain) {
		errors.push(new ParseError(LinkerText.no_main_files, null));
	}
	return {program: new Program(pages, kueTable), errors};
}

function addressToPageId(address: number): number {
	return Math.floor(((address - initialAddress) >>> 0) / PAGE_SIZE);
}

function toTentativeLoad(baseAddress: number, file: AsmModule): {page: TentativeLoad, errors: ParseError[]} {
	let labels = new Map<string, number>();
	let localAddress = 0;

	let codeTable = new Map<number, LoadedInstruction>();
	let errors: ParseError[] = [];
	for (const inst of file.instructions) {
		const address = (baseAddress + localAddress) | 0;
		const next = localAddress + 4;
		codeTable.set(address, {
			next: (baseAddress + next) | 0,
			instruction: inst.instruction,
			token: inst.token
		});
		for (let label of inst.labels) {
			labels.set(label, address);
		}
		localAddress = next;
		if (localAddress >= PAGE_SIZE) {
			errors.push(new ParseError(LinkerText.too_large_file(file.name), null));
			break;
		}
	}

	let valueTable = new Map<number, LoadedValue>();
	for (const value of file.values) {
		if (localAddress % value.size != 0) {
			localAddress += value.size - localAddress % value.size;
		}
		if (localAddress >= PAGE_SIZE) {
			errors.push(new ParseError(LinkerText.too_large_file(file.name), null));
			break;
		}
		const address = (baseAddress + localAddress) | 0;
		valueTable.set(address, value);
		for (let label of value.labels) {
			labels.set(label, address);
		}
		localAddress += value.size;
	}

	return {
		page: {
			codeTable, valueTable, labels,
			xoks: new Set(file.xokList.map(x => x.name)),
		},
		errors
	};
}

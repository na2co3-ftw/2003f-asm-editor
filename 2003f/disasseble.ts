import {AsmModule} from "./types";

export function disassemble(module: AsmModule): string {
	let ret =  "'i'c\n";

	for (const {name} of module.kueList) {
		ret += `kue ${name}\n`;
	}

	for (const {name} of module.xokList) {
		ret += `xok ${name}\n`;
	}

	for (const {instruction, labels} of module.instructions) {
		ret += instruction.toString();
		for (const label of labels) {
			ret += ` l' ${label}`;
		}
		ret += "\n";
	}

	return ret;
}

import {AsmModule, Value} from "./types";

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

export function getOperandText(operand: Value): string {
	switch (operand.type) {
		case "Reg":
			return operand.reg;
		case "IndReg":
			return operand.reg + "@";
		case "IndRegDisp":
			return `${operand.reg}+${operand.offset}@`;
		case "IndRegReg":
			return `${operand.reg1}+${operand.reg2}@`;
		case "Imm":
			return operand.value.toString();
		case "Label":
			return operand.label;
	}
}

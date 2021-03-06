import {AsmModule, Instruction, Value} from "./types";

export function disassemble(module: AsmModule): string {
	let ret =  "'i'c\n";

	for (const {name} of module.kueList) {
		ret += `kue ${name}\n`;
	}

	for (const {name} of module.xokList) {
		ret += `xok ${name}\n`;
	}

	for (const {instruction, labels} of module.instructions) {
		const text = getInstText(instruction);
		if (text == null) {
			continue;
		}
		ret += text;
		for (const label of labels) {
			ret += ` l' ${label}`;
		}
		ret += "\n";
	}

	for (const {size, value, labels} of module.values) {
		if (size == 4) {
			ret += "lifem ";
		} else {
			ret += `lifem${(size * 8)} `;
		}

		if (typeof value == "number") {
			ret += (value >>> 0).toString();
		} else {
			ret += value;
		}

		for (const label of labels) {
			ret += ` l' ${label}`;
		}
		ret += "\n";
	}

	return ret;
}

function getInstText(inst: Instruction): string | null {
	if (Instruction.isBinary(inst)) {
		return `${inst.opcode} ${getOp(inst.src)} ${getOp(inst.dst)}`;
	}
	if (Instruction.isTernary(inst)) {
		return `${inst.opcode} ${getOp(inst.src)} ${getOp(inst.dstl)} ${getOp(inst.dsth)}`;
	}

	switch (inst.opcode) {
		case "nac":
			return `nac ${getOp(inst.dst)}`;
		case "fi":
			return `fi ${getOp(inst.a)} ${getOp(inst.b)} ${inst.compare}`;
		case "inj":
			return `inj ${getOp(inst.a)} ${getOp(inst.b)} ${getOp(inst.c)}`;
		case "fen":
			return "fen";
		case "error":
			return null;
	}
}

function getOp(operand: Value): string {
	switch (operand.type) {
		case "Reg":
			return operand.reg;
		case "IndReg":
			return operand.reg + "@";
		case "IndRegDisp":
			return `${operand.reg}+${operand.offset >>> 0}@`;
		case "IndRegReg":
			return `${operand.reg1}+${operand.reg2}@`;
		case "Imm":
			return (operand.value >>> 0).toString();
		case "Label":
			return operand.label;
		case "IndLabel":
			return operand.label + "@";
		case "IndLabelDisp":
			return `${operand.label}+${operand.offset >>> 0}@`;
		case "IndLabelReg":
			return `${operand.label}+${operand.reg}@`;
		case "IndLabelRegDisp":
			return `${operand.label}+${operand.reg}+${operand.offset >>> 0}@`;
	}
}

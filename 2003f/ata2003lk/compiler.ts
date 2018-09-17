import {AsmBuilder, BuilderError, V} from "../builder";
import {CompileResult, ParseError, Value} from "../types";
import {AtaAsmParser, AtaInst, tokenize} from "./parser";

export function fullCompile(str: string, file: string = ""): CompileResult {
	const tokenized = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const parsed = new AtaAsmParser(tokenized.tokens, tokenized.eof).parse();
	if (parsed.root == null) {
		return {
			data: null,
			errors: [...tokenized.errors, ...parsed.errors],
			warnings: parsed.warnings
		};
	}

	const compiled = compile(parsed.root, file);
	return {
		data: compiled.data,
		errors: [...tokenized.errors, ...parsed.errors, ...compiled.errors],
		warnings: [...parsed.warnings, ...compiled.warnings]
	};
}

function compile(parsed: { instructions: AtaInst[], externalLabels: Set<string> }, name: string): CompileResult {
	let builder = new AsmBuilder(name);
	let errors: ParseError[] = [];

	builder.setHasMain(true);

	for (const inst of parsed.instructions) {
		builder.setNextToken(inst.token);
		switch (inst.type) {
			case "nullary":
				if (inst.opcode == "dosn") {
					builder.krz(V.f5io, V.xx);
				} else if (inst.opcode == "fen") {
					builder.fen();
				}
				break;
			case "unaryRead":
				if (inst.opcode == "zali") {
					builder.nta(V.imm(4), V.f5);
					builder.krz(convertValue(inst.src), V.f5io);
				} else if (inst.opcode == "ycax") {
					builder.ata(V.imm((inst.src as Value.Imm).value * 4), V.f5);
				} else if (inst.opcode == "fenx") {
					builder.nta(V.imm(4), V.f5);
					builder.inj(convertValue(inst.src), V.xx, V.f5io);
					builder.ata(V.imm(4), V.f5);
				} else if (inst.opcode == "dus") {
					builder.krz(convertValue(inst.src), V.xx);
				} else if (inst.opcode == "maldus") {
					builder.malkrz(convertValue(inst.src), V.xx);
				}
				break;
			case "unary":
				if (inst.opcode == "nac") {
					builder.nac(inst.dst);
				} else if (inst.opcode == "ycax") {
					builder.dro(V.imm(2), inst.dst);
					builder.ata(inst.dst, V.f5);
				}
				break;
			case "binary":
				builder.binOp(inst.opcode, convertValue(inst.src), inst.dst);
				break;
			case "ternary":
				if (inst.opcode == "inj") {
					builder.inj(convertValue(inst.src), inst.dst1, inst.dst2);
				} else {
					builder.triOp(inst.opcode, convertValue(inst.src), inst.dst1, inst.dst2);
				}
				break;
			case "fi":
				builder.fi(convertValue(inst.a), convertValue(inst.b), inst.compare);
				break;
			case "lar":
				builder.nll("--lar--" + inst.id);
				builder.fi(convertValue(inst.a), convertValue(inst.b), inst.compare);
				builder.malkrz(V.label("--lar--sit--" + inst.id), V.xx);
				break;
			case "ral":
				builder.krz(V.label("--lar--" + inst.id), V.xx);
				builder.nll("--lar--sit--" + inst.id);
				break;
			case "label":
				if (inst.opcode == "nll" || inst.opcode == "cers") {
					builder.nll(convertLabel(inst.label.text));
				} else if (inst.opcode == "l'") {
					try {
						builder.l(convertLabel(inst.label.text));
					} catch (e) {
						if (e instanceof BuilderError) {
							errors.push(new ParseError(e.message, inst.token));
						} else {
							throw e;
						}
					}
				} else if (inst.opcode == "kue") {
					builder.setHasMain(false);
					builder.kue(convertLabel(inst.label.text), inst.label);
				} else if (inst.opcode == "xok") {
					builder.xok(convertLabel(inst.label.text), inst.label);
				}
				break;
		}
	}

	if (parsed.instructions.length > 0 && parsed.instructions[parsed.instructions.length - 1].type == "ral") {
		builder.fen();
	}

	return {
		data: builder.getAsmModule(),
		errors,
		warnings: []
	};

	function convertLabel(label: string): string {
		if (!parsed.externalLabels.has(label)) {
			return `--${label}--`;
		}
		return label;
	}

	function convertValue(value: Value): Value {
		if (value.type == "Label") {
			if (!parsed.externalLabels.has(value.label)) {
				return V.label(`--${value.label}--`);
			}
		}
		return value;
	}
}

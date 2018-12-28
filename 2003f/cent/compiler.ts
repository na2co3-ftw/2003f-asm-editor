import {AsmModule, CompileResult, isCompare, ParseError} from "../types";
import {AsmBuilder, V} from "../builder";
import {
	BI_OPERATORS, CentParsed, CentParser, ExternalFunction, Operation, Subroutine, tokenize,
	TRI_OPERATORS
} from "./parser";

export function fullCompile(str: string, file: string = ""): CompileResult {
	const tokenized = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const parsed = new CentParser(tokenized.tokens, tokenized.eof).parse();
	if (parsed.root == null) {
		return {
			data: null,
			errors: tokenized.errors.concat(parsed.errors),
			warnings: tokenized.warnings.concat(parsed.warnings)
		};
	}

	const compiled = new CentCompiler(parsed.root, file).compile();
	return {
		data: compiled.data,
		errors: tokenized.errors.concat(parsed.errors, compiled.errors),
		warnings: tokenized.warnings.concat(parsed.warnings, compiled.warnings)
	};
}

class CentCompiler {
	private builder: AsmBuilder;

	private cecioCount = 0;
	private falCount = 0;
	private fiCount = 0;
	private lelesCount = 0;

	private subroutineMap = new Map<string, Subroutine>();
	private subroutineCallStack: Subroutine[] = [];
	private recursiveSubroutines = new Set<Subroutine>();
	private duplicatedSubroutines = new Map<Subroutine, Set<Subroutine>>();
	private usedSubroutines = new Set<Subroutine>();
	private internalLabels = new Set<string>();

	private functionMap = new Map<string, ExternalFunction>();
	private usedFunctions = new Set<ExternalFunction>();

	private errors: ParseError[] = [];
	private warnings: ParseError[] = [];

	constructor(private parsed: CentParsed, name: string) {
		this.builder = new AsmBuilder(name);
	}

	compile(): {data: AsmModule, errors: ParseError[], warnings: ParseError[]} {
		for (const sub of this.parsed.subroutines) {
			if (this.subroutineMap.has(sub.name.text)) {
				let definedSub = this.subroutineMap.get(sub.name.text)!;
				let dups = this.duplicatedSubroutines.get(definedSub) || new Set();
				dups.add(sub);
				this.duplicatedSubroutines.set(definedSub, dups);
			} else {
				this.subroutineMap.set(sub.name.text, sub);
			}
		}

		for (const func of this.parsed.functions) {
			if (this.functionMap.has(func.name.text)) {
				this.errors.push(new ParseError(`'${func.name.text}' is already defined`, func.name));
				continue;
			}

			this.builder.xok(func.name.text, func.name);
			if (this.subroutineMap.has(func.name.text)) {
				this.warnings.push(new ParseError(`Subroutine '${func.name.text}' hides function '${func.name.text}'`, func.name));
			} else {
				this.functionMap.set(func.name.text, func);
			}
		}

		this.builder.setHasMain(true);
		this.builder.nta(V.imm(4), V.f5);
		this.builder.krz(V.f1, V.f5io);
		this.builder.krz(V.f5, V.f1);

		for (const operation of this.parsed.operations) {
			this.compileOperation(operation);
		}

		for (const sub of this.recursiveSubroutines) {
			this.errors.push(new ParseError("Recursive subroutine", sub.name));
		}
		for (const sub of this.subroutineMap.values()) {
			if (!this.usedSubroutines.has(sub)) {
				this.warnings.push(new ParseError(`'${sub.name.text}' is defined but not used`, sub.name));
			}
			let dups = this.duplicatedSubroutines.get(sub);
			if (dups) {
				if (this.usedSubroutines.has(sub)) {
					for (const dup of dups) {
						this.errors.push(new ParseError(`'${dup.name.text}' is already defined`, dup.name));
					}
				} else {
					for (const dup of dups) {
						this.warnings.push(new ParseError(`'${dup.name.text}' is already defined`, dup.name));
					}
				}
			}
		}
		for (const func of this.functionMap.values()) {
			if (this.internalLabels.has(func.name.text)) {
				this.errors.push(new ParseError(`'${func.name.text}' is defined internally`, func.name));
			} else if (!this.usedFunctions.has(func)) {
				this.warnings.push(new ParseError(`'${func.name.text}' is defined but not used`, func.name));
			}
		}

		this.builder.krz(V.f1, V.f5);
		this.builder.krz(V.f5io, V.f1);
		this.builder.ata(V.imm(4), V.f5);
		this.builder.krz(V.f5io, V.xx);

		return {
			data: this.builder.getAsmModule(),
			errors: this.errors,
			warnings: this.warnings
		};
	}

	private compileOperation(operation: Operation) {
		const builder = this.builder;
		builder.setNextToken(operation.token);
		if (operation instanceof Operation.Number) {
			builder.nta(V.imm(4), V.f5);
			builder.krz(V.imm(operation.value), V.f5io);
		} else if (operation instanceof Operation.Primitive) {
			this.compilePrimitiveOperation(operation);
		} else if (operation instanceof Operation.Fi) {
			const count = ++this.fiCount;

			builder.fi(V.f5io, V.imm(0), "clo");
			builder.malkrz(V.label("--ol--" + count), V.xx);

			for (const op of operation.mal) {
				this.compileOperation(op);
			}

			if (operation.ol != null) {
				builder.krz(V.label("--if--" + count), V.xx);

				this.internalLabels.add("--ol--" + count);
				builder.nll("--ol--" + count);
				for (const op of operation.ol) {
					this.compileOperation(op);
				}

				this.internalLabels.add("--if--" + count);
				builder.nll("--if--" + count);
			} else {
				this.internalLabels.add("--ol--" + count);
				builder.nll("--ol--" + count);
			}
		} else if (operation instanceof Operation.Cecio) {
			const count = ++this.cecioCount;

			this.internalLabels.add("--cecio--" + count);
			builder.nll("--cecio--" + count);
			builder.fi(V.f5io, V.f5_4io, "llo");
			builder.malkrz(V.label("--oicec--" + count), V.xx);

			for (const op of operation.body) {
				this.compileOperation(op);
			}
			builder.ata(V.imm(1), V.f5io);
			builder.krz(V.label("--cecio--" + count), V.xx);

			this.internalLabels.add("--oicec--" + count);
			builder.nll("--oicec--" + count);
			builder.ata(V.imm(8), V.f5);
		} else if (operation instanceof Operation.Fal) {
			const count = ++this.falCount;

			this.internalLabels.add("--fal--" + count);
			builder.nll("--fal--" + count);
			builder.fi(V.f5io, V.imm(0), "clo");
			builder.malkrz(V.label("--laf--" + count), V.xx);

			for (const op of operation.body) {
				this.compileOperation(op);
			}
			builder.krz(V.label("--fal--" + count), V.xx);

			this.internalLabels.add("--laf--" + count);
			builder.nll("--laf--" + count);
		}
	}

	private compilePrimitiveOperation(operation: Operation.Primitive) {
		const builder = this.builder;
		const text = operation.token.text;
		if (text == "nac") {
			builder.nac(V.f5io);
		} else if (text == "sna") {
			builder.nac(V.f5io);
			builder.ata(V.imm(1), V.f5io);
		} else if (BI_OPERATORS.indexOf(text) >= 0) {
			builder.binOp(text, V.f5io, V.f5_4io);
			builder.ata(V.imm(4), V.f5);
		} else if (TRI_OPERATORS.indexOf(text) >= 0) {
			builder.triOp(text, V.f5io, V.f5_4io, V.f0);
			builder.inj(V.f0, V.f5_4io, V.f5io);
		} else if (isCompare(text)) {
			const count = ++this.lelesCount;

			builder.fi(V.f5io, V.f5_4io, text);
			builder.malkrz(V.label("--leles-niv--" + count), V.xx);

			builder.krz(V.imm(0), V.f5_4io);
			builder.krz(V.label("--leles-situv--" + count), V.xx);

			this.internalLabels.add("--leles-niv--" + count);
			builder.nll("--leles-niv--" + count);
			builder.krz(V.imm(1), V.f5_4io);

			this.internalLabels.add("--leles-situv--" + count);
			builder.nll("--leles-situv--" + count);
			builder.ata(V.imm(4), V.f5);
		} else if (text == "krz" || text == "kRz") {
			builder.nta(V.imm(4), V.f5);
			builder.krz(V.f5_4io, V.f5io);
		} else if (text == "ach") {
			builder.inj(V.f5io, V.f5_4io, V.f5io);
		} else if (text == "roft") {
			builder.krz(V.f5_8io, V.f0);
			builder.inj(V.f5io, V.f5_4io, V.f5_8io);
			builder.krz(V.f0, V.f5io);
		} else if (text == "ycax") {
			builder.ata(V.imm(4), V.f5);
		} else if (text == "pielyn") {
			builder.krz(V.f1, V.f5);
		} else if (text == "kinfit") {
			builder.krz(V.f1, V.f0);
			builder.nta(V.f5, V.f0);
			builder.dtosna(V.imm(2), V.f0);
			builder.nta(V.imm(4), V.f5);
			builder.krz(V.f0, V.f5io);
		} else if (text == "tikl") {
			builder.nta(V.imm(4), V.f5);
			builder.inj(V.imm(0xba5fb6b0 | 0), V.xx, V.f5io);
			builder.ata(V.imm(8), V.f5);
		} else if (this.subroutineMap.has(text)) {
			const sub = this.subroutineMap.get(text)!;
			this.usedSubroutines.add(sub);

			if (this.duplicatedSubroutines.has(sub)) {
				return;
			}

			const i = this.subroutineCallStack.indexOf(sub);
			if (i >= 0) {
				for (const s of this.subroutineCallStack.slice(i)) {
					this.recursiveSubroutines.add(s);
				}
				return;
			}

			builder.fen(); // for step execution
			this.subroutineCallStack.push(sub);
			for (const op of sub.operations) {
				this.compileOperation(op);
			}
			this.subroutineCallStack.pop();
		} else if (this.functionMap.has(text)) {
			const func = this.functionMap.get(text)!;
			this.usedFunctions.add(func);

			builder.nta(V.imm(4), V.f5);
			builder.inj(V.label(text), V.xx, V.f5io);
			if (func.argNum != 0) {
				builder.ata(V.imm(func.argNum * 4), V.f5);
			}
			builder.krz(V.f0, V.f5io);
		} else {
			this.errors.push(new ParseError("Invalid operation", operation.token));
			return;
		}
	}
}

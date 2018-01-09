import {AsmBuilder, V} from "../builder";
import {AsmModule, CompileResult, isCompare, ParseError} from "../types";
import {BI_OPERATORS, CentParser, Operation, Subroutine, tokenize, TRI_OPERATORS} from "./parser";

export function fullCompile(str: string, file: string = ""): CompileResult {
	const tokenized = tokenize(str.replace(/\r\n?/g, "\n"), file);
	const parsed = new CentParser(tokenized.tokens, tokenized.eof).parse();
	if (parsed.root == null) {
		return {
			data: null,
			errors: tokenized.errors.concat(parsed.errors),
			warnings: parsed.warnings
		};
	}

	const compiled = new CentCompiler(parsed.root.operations, parsed.root.subroutines).compile();
	return {
		data: compiled.data,
		errors: tokenized.errors.concat(parsed.errors, compiled.errors),
		warnings: parsed.warnings.concat(compiled.warnings)
	};
}

class CentCompiler {
	private builder = new AsmBuilder();

	private cecioCount = 0;
	private falCount = 0;
	private fiCount = 0;
	private lelesCount = 0;

	private subroutineMap = new Map<string, Subroutine>();
	private subroutineCallStack: Subroutine[] = [];
	private recursiveSubroutines = new Set<Subroutine>();
	private usedSubroutines = new Set<Subroutine>();

	private errors: ParseError[] = [];
	private warnings: ParseError[] = [];

	constructor(private operations: Operation[], private subroutines: Subroutine[]) {}

	compile(): {data: AsmModule, errors: ParseError[], warnings: ParseError[]} {
		for (const sub of this.subroutines) {
			if (this.subroutineMap.has(sub.name.text)) {
				this.errors.push(new ParseError(`'${sub.name.text}' is already defined`, sub.name));
			} else {
				this.subroutineMap.set(sub.name.text, sub);
			}
		}

		this.builder.setHasMain(true);
		this.builder.nta(V.imm(4), V.f5);
		this.builder.krz(V.f1, V.f5io);
		this.builder.krz(V.f5, V.f1);

		for (const operation of this.operations) {
			this.compileOperation(operation);
		}

		for (const sub of this.recursiveSubroutines) {
			this.errors.push(new ParseError("Recursive subroutine", sub.name));
		}
		for (const sub of this.subroutines) {
			if (!this.usedSubroutines.has(sub)) {
				this.warnings.push(new ParseError(`'${sub.name.text}' is defined but not used`, sub.name));
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
			builder.malkrz(V.label("ol" + count), V.xx);

			for (const op of operation.mal) {
				this.compileOperation(op);
			}

			if (operation.ol != null) {
				builder.krz(V.label("if" + count), V.xx);

				builder.nll("ol" + count);
				for (const op of operation.ol) {
					this.compileOperation(op);
				}

				builder.nll("if" + count);
			} else {
				builder.nll("ol" + count);
			}
		} else if (operation instanceof Operation.Cecio) {
			const count = ++this.cecioCount;

			builder.nll("cecio" + count);
			builder.fi(V.f5io, V.f5_4io, "llo");
			builder.malkrz(V.label("oicec" + count), V.xx);

			for (const op of operation.body) {
				this.compileOperation(op);
			}
			builder.ata(V.imm(1), V.f5io);
			builder.krz(V.label("cecio" + count), V.xx);

			builder.nll("oicec" + count);
			builder.ata(V.imm(8), V.f5);
		} else if (operation instanceof Operation.Fal) {
			const count = ++this.falCount;

			builder.nll("fal" + count);
			builder.fi(V.f5io, V.imm(0), "clo");
			builder.malkrz(V.label("laf" + count), V.xx);

			for (const op of operation.body) {
				this.compileOperation(op);
			}
			builder.krz(V.label("fal" + count), V.xx);

			builder.nll("laf" + count);
		}
	}

	private compilePrimitiveOperation(operation: Operation.Primitive) {
		const builder = this.builder;
		const text = operation.token.text;
		if (text == "nac") {
			builder.nac(V.f5io);
		} else if (BI_OPERATORS.indexOf(text) >= 0) {
			builder.binOp(text, V.f5io, V.f5_4io);
			builder.ata(V.imm(4), V.f5);
		} else if (TRI_OPERATORS.indexOf(text) >= 0) {
			builder.triOp(text, V.f5io, V.f5_4io, V.f0);
			builder.inj(V.f0, V.f5_4io, V.f5io);
		} else if (isCompare(text)) {
			const count = ++this.lelesCount;

			builder.fi(V.f5io, V.f5_4io, text);
			builder.malkrz(V.label("leles-niv" + count), V.xx);

			builder.krz(V.imm(0), V.f5_4io);
			builder.krz(V.label("leles-situv" + count), V.xx);

			builder.nll("leles-niv" + count);
			builder.krz(V.imm(1), V.f5_4io);

			builder.nll("leles-situv" + count);
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
		} else {
			const sub = this.subroutineMap.get(text);
			if (sub == null) {
				this.errors.push(new ParseError("Invalid operation", operation.token));
				return;
			}
			const i = this.subroutineCallStack.indexOf(sub);
			if (i >= 0) {
				for (const s of this.subroutineCallStack.slice(i)) {
					this.recursiveSubroutines.add(s);
				}
				return;
			}
			this.usedSubroutines.add(sub);

			builder.fen(); // for step execution
			this.subroutineCallStack.push(sub);
			for (const op of sub.operations) {
				this.compileOperation(op);
			}
			this.subroutineCallStack.pop();
		}
	}
}

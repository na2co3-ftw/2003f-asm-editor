import isEqual from "lodash.isequal";

import {fullCompile as compileAsm} from "../2003f/2003lk/parser";
import {fullCompile as compileTinka} from "../2003f/tinka/compiler";
import {fullCompile as compileCent} from "../2003f/cent/compiler";
import {fullCompile as compileAtaAsm} from "../2003f/ata2003lk/parser";
import {linkModules, Program} from "../2003f/linker";
import {AsmModule, CompileResult, ParseError, Token} from "../2003f/types";
import {disassemble} from "../2003f/disasseble";

export {Program};

export type Language = "2003lk" | "tinka" | "cent" | "ata2003lk";

export interface SourceFile {
	source: string;
	name: string;
	language: Language;
}

export const LANGUAGES: Language[] = ["2003lk", "tinka", "cent", "ata2003lk"];

export interface ErrorsAndWarnings {
	fileErrors: ParseError[][];
	fileWarnings: ParseError[][];
	linkErrors: ParseError[];
	linkWarnings: ParseError[];
}

function compile(file: SourceFile): CompileResult {
	let result: CompileResult;
	try {
		if (file.language == "2003lk") {
			result = compileAsm(file.source, file.name);
		} else if (file.language == "tinka") {
			result = compileTinka(file.source, file.name);
		} else if (file.language == "cent") {
			result = compileCent(file.source, file.name);
		} else {
			result = compileAtaAsm(file.source, file.name);
		}
	} catch (e) {
		if (e instanceof ParseError) {
			result = {data: null, errors: [e], warnings: []};
		} else {
			throw e;
		}
	}
	return result;
}

export function isTranspilableToAsm(language: Language): boolean {
	return language != "2003lk";
}

export function TranspileToAsm(file: SourceFile): string | null {
	const module = compile(file).data;
	return module && disassemble(module);
}

export default class CachedCompiler {
	private parsedSources: SourceFile[];
	private parsedFiles: (AsmModule | null)[];
	program: Program | null;
	private fileErrors: ParseError[][];
	private fileWarnings: ParseError[][];
	private linkErrors: ParseError[];
	private linkWarnings: ParseError[];

	constructor() {
		this.parsedSources = [];
		this.parsedFiles = [];
		this.program = null;
		this.fileErrors = [];
		this.fileWarnings = [];
		this.linkErrors = [];
		this.linkWarnings = [];
	}

	compileAll(files: SourceFile[]) {
		let shouldLink = false;
		let hasError = false;
		files.forEach((file, id) => {
			if (isEqual(file, this.parsedSources[id])) {
				return;
			}
			let result = compile(file);
			this.parsedFiles[id] = result.data;
			this.fileErrors[id] = result.errors;
			this.fileWarnings[id] = result.warnings;

			this.parsedSources[id] = Object.assign({}, file);
			shouldLink = true;
			if (result.errors.length != 0) {
				hasError = true;
			}
		});

		if (files.length != this.parsedSources.length) {
			this.parsedSources.length = files.length;
			this.parsedFiles.length = files.length;
			this.fileErrors.length = files.length;
			this.fileWarnings.length = files.length;
			shouldLink = true;
		}

		if (shouldLink) {
			try {
				const files = hasError ? this.parsedFiles.filter(f => f != null) : this.parsedFiles;
				const {program, errors} = linkModules(files as AsmModule[]);
				this.program = program;
				this.linkErrors = errors;
				this.linkWarnings = [];
			} catch (e) {
				if (e instanceof ParseError) {
					this.program = null;
					this.linkErrors = [e];
					this.linkWarnings = [];
				} else {
					throw e;
				}
			}
		}
		if (this.linkErrors.length != 0) {
			hasError = true;
		}
		if (hasError) {
			this.program = null;
		}
	}

	getErrorsAndWarnings(): ErrorsAndWarnings {
		let errorTokens = new Set<Token>();
		let fileErrors = this.fileErrors.map(errors => {
			for (const error of errors) {
				if (error.token) {
					errorTokens.add(error.token);
				}
			}
			return errors.slice(0);
		});

		let linkErrors: ParseError[] = [];
		this.linkErrors.forEach(error => {
			if (error.token) {
				errorTokens.add(error.token);
				for (let i = 0; i < this.parsedSources.length; i++) {
					if (this.parsedSources[i].name == error.token.file) {
						fileErrors[i].push(error);
						return;
					}
				}
			}
			linkErrors.push(error);
		});


		let fileWarnings = this.fileWarnings.map(warnings => {
			return warnings.filter(warning => !errorTokens.has(warning.token!));
		});

		let linkWarnings: ParseError[] = [];
		this.linkWarnings.forEach(warning => {
			if (warning.token) {
				if (errorTokens.has(warning.token)) {
					return;
				}
				for (let i = 0; i < this.parsedSources.length; i++) {
					if (this.parsedSources[i].name == warning.token.file) {
						fileWarnings[i].push(warning);
						return;
					}
				}
			}
			linkWarnings.push(warning);
		});

		return {
			fileErrors, fileWarnings, linkErrors, linkWarnings
		};
	}
}

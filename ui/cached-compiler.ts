import {fullCompile as compileAsm} from "../2003f/2003lk/parser";
import {fullCompile as compileTinka} from "../2003f/tinka/compiler";
import {fullCompile as compileCent} from "../2003f/cent/compiler";
import {Program} from "../2003f/linker";
import {AsmModule, CompileResult, ParseError} from "../2003f/types";
import isEqual = require("lodash.isequal");

export {Program};

type Language = "2003lk" | "tinka" | "cent";

export interface SourceFile {
	source: string;
	name: string;
	language: Language;
}

export const LANGUAGES: Language[] = ["2003lk", "tinka", "cent"];

export default class CachedCompiler {
	private parsedSources: SourceFile[];
	private parsedFiles: (AsmModule | null)[];
	program: Program | null;
	fileErrors: ParseError[][];
	fileWarnings: ParseError[][];
	linkErrors: ParseError[];
	linkWarnings: ParseError[];

	constructor() {
		this.clear();
	}

	clear() {
		this.parsedSources = [];
		this.parsedFiles = [];
		this.program = null;
		this.fileErrors = [];
		this.fileWarnings = [];
		this.linkErrors = [];
		this.linkWarnings = [];
	}

	compile(files: SourceFile[]) {
		let shouldLink = false;
		let hasError = false;
		files.forEach((file, id) => {
			if (isEqual(file, this.parsedSources[id])) {
				return;
			}
			let result: CompileResult;
			try {
				if (file.language == "2003lk") {
					result = compileAsm(file.source, file.name);
				} else if (file.language == "tinka") {
					result = compileTinka(file.source, file.name);
				} else {
					result = compileCent(file.source, file.name);
				}
			} catch (e) {
				if (e instanceof ParseError) {
					result = {data: null, errors: [e], warnings: []};
				} else {
					throw e;
				}
			}
			this.parsedFiles[id] = result.data;
			this.fileErrors[id] = result.errors;
			this.fileWarnings[id] = result.warnings;
			this.parsedSources[id] = Object.assign({}, file);
			shouldLink = true;
			hasError = result.errors.length != 0;
		});
		if (files.length != this.parsedSources.length) {
			this.parsedSources.length = files.length;
			this.parsedFiles.length = files.length;
			this.fileErrors.length = files.length;
			this.fileWarnings.length = files.length;
			shouldLink = true;
		}

		if (hasError) {
			this.program = null;
			return null;
		}
		if (shouldLink) {
			try {
				this.program = Program.link(this.parsedFiles as AsmModule[]);
				this.linkErrors = [];
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
	}
}

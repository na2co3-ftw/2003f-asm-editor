import {fullCompile as compileAsm} from "../2003f/2003lk/parse";
import {fullCompile as compileTinka} from "../2003f/tinka/compiler";
import {Program} from "../2003f/linker";
import {AsmModule, ParseError} from "../2003f/types";
import isEqual = require("lodash.isequal");

export {Program};

export interface SourceFile {
	source: string;
	name: string;
	language: "2003lk" | "tinka";
}

export default class CachedCompiler {
	private parsedSources: SourceFile[];
	private parsedFiles: (AsmModule | null)[];
	private parsedProgram: Program | null;
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
		this.parsedProgram = null;
		this.fileErrors = [];
		this.fileWarnings = [];
		this.linkErrors = [];
		this.linkWarnings = [];
	}

	compile(files: SourceFile[]): Program | null {
		let shouldLink = false;
		let hasError = false;
		files.forEach((file, id) => {
			if (isEqual(file, this.parsedSources[id])) {
				return;
			}
			try {
				if (file.language == "2003lk") {
					this.parsedFiles[id] = compileAsm(file.source, file.name);
					this.fileErrors[id] = [];
					this.fileWarnings[id] = [];
				} else {
					const {data, errors, warnings} = compileTinka(file.source, file.name);
					this.fileErrors[id] = errors;
					this.fileWarnings[id] = warnings;
					this.parsedFiles[id] = data;
					if (errors.length != 0) {
						hasError = true;
					}
				}
			} catch (e) {
				if (e instanceof ParseError) {
					this.parsedFiles[id] = null;
					this.fileErrors[id] = [e];
					this.fileWarnings[id] = [];
					hasError = true;
				} else {
					throw e;
				}
			}
			this.parsedSources[id] = Object.assign({}, file);
			shouldLink = true;
		});
		if (files.length != this.parsedSources.length) {
			this.parsedSources.length = files.length;
			this.parsedFiles.length = files.length;
			this.fileErrors.length = files.length;
			this.fileWarnings.length = files.length;
			shouldLink = true;
		}

		if (hasError) {
			this.parsedProgram = null;
			return null;
		}
		if (shouldLink) {
			try {
				this.parsedProgram = Program.link(this.parsedFiles as AsmModule[]);
				this.linkErrors = [];
				this.linkWarnings = [];
			} catch (e) {
				if (e instanceof ParseError) {
					this.parsedProgram = null;
					this.linkErrors = [e];
					this.linkWarnings = [];
				} else {
					throw e;
				}
			}
		}
		return this.parsedProgram;
	}
}

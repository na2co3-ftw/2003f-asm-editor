import {fullParse, ParsedFile} from "../2003lk/parse";
import {Program} from "../2003lk/linker";
import {ParseError} from "../2003lk/types";

export {Program};

export interface SourceFile {
	source: string;
	name: string;
}

export default class CachedCompiler {
	private parsedSources: SourceFile[];
	private parsedFiles: (ParsedFile | null)[];
	private parsedProgram: Program | null;
	private errors: string[];

	constructor() {
		this.clear();
	}

	clear() {
		this.parsedSources = [];
		this.parsedFiles = [];
		this.parsedProgram = null;
		this.errors = [];
	}

	compile(files: SourceFile[]): Program | null {
		let shouldLink = false;
		let hasError = false;
		files.forEach((file, id) => {
			if (this.parsedSources[id] &&
				file.source == this.parsedSources[id].source &&
				file.name == this.parsedSources[id].name
			) {
				return;
			}
			try {
				this.parsedFiles[id] = fullParse(file.source, file.name);
				this.errors[id] = "";
			} catch (e) {
				if (e instanceof ParseError) {
					this.parsedFiles[id] = null;
					this.errors[id] = e.message;
					hasError = true;
				} else {
					throw e;
				}
			}
			this.parsedSources[id] = {source: file.source, name: file.name};
			shouldLink = true;
		});
		if (files.length != this.parsedSources.length) {
			this.parsedSources.length = files.length;
			this.parsedFiles.length = files.length;
			this.errors.length = files.length + 1;
			shouldLink = true;
		}

		if (hasError) {
			this.parsedProgram = null;
			return null;
		}
		if (shouldLink) {
			try {
				this.parsedProgram = Program.link(this.parsedFiles as ParsedFile[]);
				this.errors[files.length] = "";
			} catch (e) {
				if (e instanceof ParseError) {
					this.parsedProgram = null;
					this.errors[files.length] = e.message;
				} else {
					throw e;
				}
			}
		}
		return this.parsedProgram;
	}

	getErrors(): string[] {
		return this.errors.filter(e => e);
	}
}

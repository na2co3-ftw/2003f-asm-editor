import React = require("react");
import classNames = require("classnames");
import CodeMirror = require("codemirror");
import CodeMirrorComponent, {MarkerInfo} from "./codemirror-component";

import "codemirror/theme/neat.css";

import "codemirror/addon/selection/active-line";
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/lint.css";

import "../codemirror/mode/2003lk/2003lk";
import "../codemirror/mode/tinka/tinka";
import "../codemirror/mode/cent/cent";

import CachedCompiler, {LANGUAGES, Program, SourceFile} from "./cached-compiler";
import EditorTab from "./editor-tab";
import EditorStatusBar from "./editor-status-bar";
import {ParseError, Token} from "../2003f/types";

const DEFAULT_ASM_NAME = "fib_non_recursive";
const DEFAULT_ASM = `'c'i    
nta f5 4   krz f5@ 12    
nta f5 4   inj f5@ xx fib1    ata f5 8
krz xx f5@  

'c'i  
nll fib1  
krz f0 f5+ 4@  
krz f1 0  
krz f2 1  
fi f0 0 clo   l' is   malkrz xx ka
nta f0 1
krz f3 f1
ata f3 f2
inj f1 f2 f3  
krz xx is  
krz f0 f1    l' ka  
krz xx f5@
`;

export interface MarkerInfoM extends MarkerInfo {
	file: string;
}

interface EditorProps {
	className? : string;
	markers: MarkerInfoM[]
	active: boolean
}

interface EditorState {
	fileId: number;
	sources: SourceFile[];
	fileErrors: ParseError[][];
	fileWarnings: ParseError[][];
	linkErrors: ParseError[];
	linkWarnings: ParseError[];
}

function parseErrorsToAnnotations(errors: ParseError[], severity: string): CodeMirror.Annotation[] {
	let annotations: CodeMirror.Annotation[] = [];
	for (const error of errors) {
		if (error.token != null) {
			let length =  error.token.text.length;
			if (length == 0) {
				length = 1;
			}
			annotations.push({
				message: error.message,
				severity,
				from: CodeMirror.Pos(error.token.row, error.token.column),
				to: CodeMirror.Pos(error.token.row, error.token.column + length)
			});
		}
	}
	return annotations;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
	private cm: CodeMirrorComponent;
	private lintOptions: CodeMirror.LintOptions;
	private parser: CachedCompiler;
	private chageTimeout: number | null = null;

	constructor(props: EditorProps) {
		super(props);

		this.lintOptions = {
			getAnnotations: () => {
				const fileId = this.state.fileId;
				if (!this.state.fileErrors[fileId] || !this.state.fileWarnings[fileId]) {
					return [];
				}
				const errors = parseErrorsToAnnotations(this.state.fileErrors[fileId], "error");
				const warnings = parseErrorsToAnnotations(this.state.fileWarnings[fileId], "warning");
				return errors.concat(warnings);
			},
			async: false,
			hasGutters: true,
			delay: 0
		};

		this.parser = new CachedCompiler();

		this.state = {
			fileId: 0,
			sources: [{name: DEFAULT_ASM_NAME, source:DEFAULT_ASM, language: "2003lk"}],
			fileErrors: [],
			fileWarnings: [],
			linkErrors: [],
			linkWarnings: []
		};

		this.editorChange = this.editorChange.bind(this);
		this.importChange = this.importChange.bind(this);
		this.newTab = this.newTab.bind(this);
		this.selectTab = this.selectTab.bind(this);
		this.closeTab = this.closeTab.bind(this);
		this.renameFile = this.renameFile.bind(this);
		this.changeLanguage = this.changeLanguage.bind(this);
		this.parse = this.parse.bind(this);
	}

	componentDidUpdate(_: EditorProps, prevState: EditorState) {
		if (this.state.fileId != prevState.fileId) {
			this.cm.performLint();
		} else {
			const fileId = this.state.fileId;
			if (this.state.fileErrors[fileId] != prevState.fileErrors[fileId] ||
				this.state.fileWarnings[fileId] != prevState.fileWarnings[fileId]) {
				this.cm.performLint();
			}
		}

		if (this.state.sources != prevState.sources) {
			if (this.chageTimeout != null) {
				clearTimeout(this.chageTimeout);
			}
			this.chageTimeout = setTimeout(this.parse, 500);
		}
	}

	private editorChange(editor: CodeMirror.Editor) {
		const value = editor.getValue();
		this.setState((state: EditorState) => {
			const sources = state.sources.slice(0);
			sources[state.fileId] = Object.assign({}, sources[state.fileId], {
				source: value
			});
			return {sources};
		});
	}

	private importChange(e: React.ChangeEvent<HTMLInputElement>) {
		for (const file of Array.from(e.target.files!)) {
			const reader = new FileReader();
			reader.addEventListener("load", e => {
				let source = (e.target as FileReader).result.replace(/\r\n?/g, "\n");
				this.setState((state: EditorState) => {
					const name = this.uniqueFileName(state.sources.length, file.name, state.sources);
					let language = "2003lk";
					if (name.endsWith(".tinka")) {
						language = "tinka";
					}
					if (name.endsWith(".cent")) {
						language = "cent";
					}

					const sources = [...state.sources, {
						name,
						source,
						language
					}];
					return {sources, fileId: sources.length - 1};
				});
			});
			reader.readAsText(file);
		}
	}

	private newTab() {
		this.setState((state: EditorState) => {
			const name = this.uniqueFileName(state.sources.length, "untitled", state.sources);
			const sources = [...state.sources, {name: name, source: "", language: "2003lk"}];
			return {sources, fileId: sources.length - 1};
		});
	}

	private selectTab(id: number) {
		this.setState({fileId: id});
	}

	private closeTab(id: number){
		this.setState((state: EditorState) => {
			if (state.sources.length <= 1) {
				return {};
			}
			const sources = state.sources.slice(0);
			sources.splice(id, 1);
			let fileId = state.fileId;
			if (fileId >= sources.length) {
				fileId--;
			}
			return {sources, fileId};
		});
	}

	private renameFile(id: number, name: string) {
		if (name.search(/\S/) < 0) {
			return;
		}
		this.setState((state: EditorState) => {
			const sources = state.sources.slice(0);
			sources[id] = Object.assign({}, sources[id], {
				name: this.uniqueFileName(id, name, sources)
			});
			return {sources};
		});
	}

	private uniqueFileName(id: number, name: string, sources: SourceFile[]) {
		const i = name.lastIndexOf(".");
		let ext = "";
		if (i >= 0) {
			ext = name.substr(i);
			name = name.substr(0, i);
		}
		let appendNumber = 1;
		while (true) {
			const newName = name + (appendNumber == 1 ? "" : "_" + appendNumber) + ext;
			if (sources.every((source: SourceFile, _id: number) =>
				_id == id || source.name != newName)
			) {
				return newName;
			}
			appendNumber++;
		}
	}

	changeLanguage() {
		this.setState((state: EditorState) => {
			const sources = state.sources.slice(0);
			const language = sources[state.fileId].language;
			const newLanguage = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
			sources[state.fileId] = Object.assign({}, sources[state.fileId], {
				language: newLanguage
			});
			return {sources};
		});
	}

	private parse() {
		this.parser.compile(this.state.sources);

		let errorTokens = new Set<Token>();
		let fileErrors = this.parser.fileErrors.map(errors => {
			for (const error of errors) {
				if (error.token) {
					errorTokens.add(error.token);
				}
			}
			return errors.slice(0);
		});
		let linkErrors: ParseError[] = [];
		this.parser.linkErrors.forEach(error => {
			if (error.token) {
				errorTokens.add(error.token);
				for (let i = 0; i < this.state.sources.length; i++) {
					if (this.state.sources[i].name == error.token.file) {
						fileErrors[i].push(error);
						return;
					}
				}
			}
			linkErrors.push(error);
		});


		let fileWarnings = this.parser.fileWarnings.map(warnings => {
			return warnings.filter(warning => !errorTokens.has(warning.token!));
		});
		let linkWarnings: ParseError[] = [];
		this.parser.linkWarnings.forEach(warning => {
			if (warning.token) {
				if (errorTokens.has(warning.token)) {
					return;
				}
				for (let i = 0; i < this.state.sources.length; i++) {
					if (this.state.sources[i].name == warning.token.file) {
						fileWarnings[i].push(warning);
						return;
					}
				}
			}
			linkWarnings.push(warning);
		});

		this.setState({
			fileErrors: fileErrors,
			fileWarnings: fileWarnings,
			linkErrors: linkErrors,
			linkWarnings: linkWarnings
		});
	}

	showFile(name: string) {
		const id = this.state.sources.findIndex(source => source.name == name);
		if (id >= 0) {
			this.setState({fileId: id});
		}
	}

	getProgram(): Program | null {
		this.parse();
		return this.parser.program;
	}

	refresh() {
		this.cm.refresh();
	}

	render() {
		const currentFile = this.state.sources[this.state.fileId];
		const cmOption = {
			mode: currentFile.language,
			theme: "neat",
			styleActiveLine: true,
			lineNumbers: true,
			gutters: ["CodeMirror-lint-markers"],
			lint: this.lintOptions,
			indentUnit: 4
		};
		const fileErrors = this.state.fileErrors[this.state.fileId] || [];
		const fileWarnings = this.state.fileWarnings[this.state.fileId] || [];

		const className = classNames(this.props.className, {
			"state-inactive": !this.props.active
		});
		return (
			<div className={className}>
				ファイルを開く: <input type="file" onChange={this.importChange} multiple/><br/>
				<div>
					{this.state.sources.map((source, id) =>
						<EditorTab
							key={id}
							id={id}
							name={source.name}
							active={id == this.state.fileId}
							closable={this.state.sources.length != 1}
							hasError={(this.state.fileErrors[id] || []).length != 0}
							hasWarning={(this.state.fileWarnings[id] || []).length != 0}
							onClick={this.selectTab}
							onClose={this.closeTab}
							onRename={this.renameFile}
						/>
					)}
					<span className="editor-tab" onClick={this.newTab}>+</span>
				</div>

				<CodeMirrorComponent
					value={this.state.sources[this.state.fileId].source}
					option={cmOption}
					markers={this.props.markers.filter(marker => marker.file == currentFile.name)}
					onChange={this.editorChange}
					ref={(el => this.cm = el!)}
				/>
				<EditorStatusBar
					file={this.state.sources[this.state.fileId]}
					changeLanguage={this.changeLanguage}
				/>
				<p className="errors">
					{fileErrors.map(error =>
						error.token == null ? [error.message, <br/>] : null
					)}
					{this.state.linkErrors.map(error =>
						[error.message, <br/>]
					)}
				</p>
				<p className="warnings">
					{fileWarnings.map(error =>
						error.token == null ? [error.message, <br/>]: null
					)}
					{this.state.linkWarnings.map(error =>
						[error.message, <br/>]
					)}
				</p>
			</div>
		);
	}
}

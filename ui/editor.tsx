import React = require("react");
import CodeMirror = require("codemirror");
import CodeMirrorComponent, {MarkerInfo} from "./codemirror-component";

import "codemirror/theme/neat.css";

import "codemirror/addon/selection/active-line";
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/lint.css";

import "../codemirror/mode/2003fasm/2003fasm";

import CachedCompiler, {Program, SourceFile} from "./cached-compiler";
import EditorTab from "./editor-tab";

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
}

interface EditorState {
	fileId: number;
	sources: SourceFile[];
	parseErrors: string;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
	private cm: CodeMirrorComponent;
	private cmOption: CodeMirror.EditorConfiguration;
	private parser: CachedCompiler;

	constructor(props) {
		super(props);

		this.cmOption = {
			mode: "2003fasm",
			theme: "neat",
			styleActiveLine: true,
			lineNumbers: true,
			// gutters: ["CodeMirror-lint-markers"],
			lint: {
				getAnnotations: (newSource) => {
					const sources = this.state.sources.slice(0);
					sources[this.state.fileId] = Object.assign({}, sources[this.state.fileId], {
						source: newSource
					});
					this.parse(sources);

					// console.log(p.tokens.map(t => t.toString()));
					// asm.load(source);
					// const errors = asm.errors.map(parseErrorToLintMarker("error"));
					// const warnings = asm.warnings.map(parseErrorToLintMarker("warning"));
					// return errors.concat(warnings);
					//
					// function parseErrorToLintMarker(severity) {
					// 	return error => ({
					// 		message: error.message,
					// 		severity: severity,
					// 		from: CodeMirror.Pos(error.token.lineNumber, error.token.columnNumber),
					// 		to: CodeMirror.Pos(error.token.lineNumber, error.token.columnNumber + error.token.text.length)
					// 	});
					// }
					return [];
				},
				async: false,
				hasGutters: true
			}
		};
		this.parser = new CachedCompiler();

		this.state = {
			fileId: 0,
			sources: [{name: DEFAULT_ASM_NAME, source:DEFAULT_ASM}],
			parseErrors: ""
		};

		this.editorChange = this.editorChange.bind(this);
		this.importChange = this.importChange.bind(this);
		this.newTab = this.newTab.bind(this);
		this.selectTab = this.selectTab.bind(this);
		this.closeTab = this.closeTab.bind(this);
		this.renameFile = this.renameFile.bind(this);
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
					return {sources: [...state.sources, {name: name, source: source}]};
				});
			});
			reader.readAsText(file);
		}
	}

	private newTab() {
		this.setState((state: EditorState) => {
			const name = this.uniqueFileName(state.sources.length, "untitled", state.sources);
			return {sources: [...state.sources, {name: name, source: ""}]};
		});
	}

	private selectTab(id: number) {
		this.setState(() => ({fileId: id}));
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
			sources[id].name = this.uniqueFileName(id, name, sources);
			return {sources};
		});
	}

	private uniqueFileName(id: number, name: string, sources: SourceFile[]) {
		let appendNumber = 1;
		while (true) {
			const newName = name + (appendNumber == 1 ? "" : "_" + appendNumber);
			if (sources.every((source: SourceFile, _id: number) =>
				_id == id || source.name != newName)
			) {
				return newName;
			}
			appendNumber++;
		}
	}

	private parse(sources: SourceFile[]): Program | null {
		const program = this.parser.compile(sources);
		this.setState({parseErrors: this.parser.getErrors().join(", ")});
		return program;
	}

	showFile(name: string) {
		const id = this.state.sources.findIndex(source => source.name == name);
		if (id >= 0) {
			this.setState({fileId: id});
		}
	}

	getProgram(): Program | null {
		return this.parse(this.state.sources);
	}

	refresh() {
		this.cm.refresh();
	}

	render() {
		const currentFileName = this.state.sources[this.state.fileId].name;

		return (
			<div className={this.props.className || ""}>
				ファイルを開く: <input type="file" onChange={this.importChange} multiple/><br/>
				<div>
					{this.state.sources.map((source, id) =>
						<EditorTab
							key={id}
							id={id}
							name={source.name}
							active={id == this.state.fileId}
							closable={this.state.sources.length != 1}
							onClick={this.selectTab}
							onClose={this.closeTab}
							onRename={this.renameFile}
						/>
					)}
					<span className="editor-tab" onClick={this.newTab}>+</span>
				</div>

				<CodeMirrorComponent
					value={this.state.sources[this.state.fileId].source}
					option={this.cmOption}
					markers={this.props.markers.filter(marker => marker.file == currentFileName)}
					onChange={this.editorChange}
					ref={(el => this.cm = el!)}
				/>
				<p className="errors">{this.state.parseErrors}</p>
			</div>
		);
	}
}

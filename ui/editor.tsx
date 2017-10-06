import React = require("react");
import CodeMirror = require("codemirror");
import CodeMirrorComponent, {MarkerInfo} from "./codemirror-component";

import "codemirror/theme/neat.css";

import "codemirror/addon/selection/active-line";
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/lint.css";

import "../codemirror/mode/2003fasm/2003fasm";

import {fullParse} from "../2003fasm/parse";
import {linker, Program} from "../2003fasm/linker";
import {ParseError} from "../2003fasm/types";

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

export {MarkerInfo};

interface EditorProps {
	markers: MarkerInfo[]
}

interface EditorState {
	source: string;
	// parsedSource: string;
	// parsedProgram: Program | null;
	parseErrors: string;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
	private cm: CodeMirrorComponent;
	private cmOption: CodeMirror.EditorConfiguration;
	private parsedSource: string;
	private parsedProgram: Program | null;

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
					this.parse(newSource);

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

		this.state = {
			source: DEFAULT_ASM,
			parseErrors: ""
		};

		this.sourceChange = this.sourceChange.bind(this);
		this.importChange = this.importChange.bind(this);
	}

	private sourceChange(editor: CodeMirror.Editor) {
		this.setState({source: editor.getValue()});
	}

	private importChange(e: React.ChangeEvent<HTMLInputElement>) {
		for (const file of Array.from(e.target.files!)) {
			const reader = new FileReader();
			reader.addEventListener("load", e => {
				let contents = (e.target as FileReader).result;
				this.setState({source: contents});
			});
			reader.readAsText(file);
		}
	}

	getProgram(): Program | null {
		this.parse(this.state.source);
		return this.parsedProgram;
	}

	private parse(newSource) {
		if (newSource == this.parsedSource) {
			return;
		}

		try {
			const program = linker([fullParse(newSource)]);
			this.parsedSource = newSource;
			this.parsedProgram = program;
			this.setState({parseErrors: ""});
		} catch (e) {
			if (e instanceof ParseError) {
				this.parsedSource = newSource;
				this.parsedProgram = null;
				this.setState({parseErrors: e.message});
				return;
			}
			throw e;
		}
	}

	refresh() {
		this.cm.refresh();
	}

	render() {
		return (
			<div>
				ファイルから読み込む: <input type="file" onChange={this.importChange}/>
				<CodeMirrorComponent
					value={this.state.source}
					option={this.cmOption}
					markers={this.props.markers}
					onChange={this.sourceChange}
					ref={(el => this.cm = el!)}
				/>

				<p className="errors">{this.state.parseErrors}</p>
			</div>
		);
	}
}

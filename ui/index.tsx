import React from "react";
import ReactDOM from "react-dom";

import Editor, {MarkerInfoM} from "./editor";
import HardwareState from "./hardware-state";
import "./style.css";

import {Hardware} from "../2003f/execute";
import {Token} from "../2003f/types";
import {TextLanguage} from "../i18n/text";
import {UIText} from "../i18n/ui-text";

document.addEventListener("DOMContentLoaded", function () {
	ReactDOM.render(<App/>, document.getElementById("app-root")!);
});


interface AppState {
	language: TextLanguage;
	liparxe: boolean;
	// machine: Hardware;
	// timeOutHandler: number | null;
	executing: boolean;
	pausing: boolean;
	tickInterval: number;
	execSpeed: number;
}

class App extends React.Component<{}, AppState> {
	private editor!: Editor;
	private machine: Hardware = new Hardware();
	private timeOutHandler: number | null = null;

	constructor(props: {}) {
		super(props);

		this.state = {
			language: "ja",
			liparxe: false,
			executing: false,
			pausing: false,
			tickInterval: 20,
			execSpeed: Math.floor(Math.log(1000 / 20) * 100 + 0.5),
		};

		this.liparxeChange = this.liparxeChange.bind(this);
		this.execute = this.execute.bind(this);
		this.executeTick = this.executeTick.bind(this);
		this.pause = this.pause.bind(this);
		this.stop = this.stop.bind(this);
		this.step = this.step.bind(this);
		this.changeSpeed = this.changeSpeed.bind(this);
	}


	componentDidUpdate(_: any, prevState: Readonly<AppState>): void {
		if (prevState.liparxe != this.state.liparxe) {
			this.editor.refresh();
		}
	}

	componentWillUnmount(): void {
		this.clearTimeout();
	}

	private liparxeChange(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({liparxe: e.target.checked});
	}

	private start(): boolean {
		const program = this.editor.getProgram();
		if (program == null) {
			return false;
		}
		this.machine = new Hardware();
		this.machine.load(program);
		const continuing = this.machine.execOneStep(true);
		// this.forceUpdate();
		this.setState({executing: continuing});
		return continuing;
	}

	private clearTimeout() {
		if (this.timeOutHandler != null) {
			clearTimeout(this.timeOutHandler);
			this.timeOutHandler = null;
		}
	}

	private execute() {
		this.clearTimeout();
		if (!this.state.executing) {
			if (!this.start()) {
				return;
			}
		}
		this.timeOutHandler = setTimeout(this.executeTick, this.state.tickInterval);
		this.setState({pausing: false});
	}

	private executeTick() {
		this.timeOutHandler = null;
		const continuing = this.execOneStep();
		if (continuing) {
			this.timeOutHandler = setTimeout(this.executeTick, this.state.tickInterval);
		} else {
			this.setState({executing: false, pausing: false});
		}
	}

	private execOneStep() {
		const continuing = this.machine.execOneStep();
		this.forceUpdate();
		return continuing;
	}

	private pause() {
		this.clearTimeout();
		this.setState({pausing: true});
	}

	private stop() {
		this.clearTimeout();
		this.setState({executing: false, pausing: false});
	}

	private step() {
		if (!this.state.executing) {
			if (!this.start()) {
				return;
			}
			this.setState({pausing: true});
		} else {
			const continuing = this.execOneStep();
			if (!continuing) {
				this.setState({executing: false, pausing: false});
			}
		}
		const nxToken = this.getCurrentNXToken();
		if (nxToken != null) {
			this.editor.showFile(nxToken.file);
		}
	}

	private changeSpeed(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({
			tickInterval: 1000 / Math.exp(e.target.valueAsNumber / 100),
			execSpeed: e.target.valueAsNumber
		});
	}

	private getCurrentNXToken(): Token | null {
		if (this.machine.program == null) {
			return null;
		}
		const inst = this.machine.program.readInstruction(this.machine.cpu.nx);
		if (inst != null && inst.token) {
			return inst.token;
		}
		return null;
	}

	render() {
		const markers: MarkerInfoM[] = [];
		if (this.state.executing) {
			const nxToken = this.getCurrentNXToken();
			if (nxToken != null) {
				markers.push({
					file: nxToken.file,
					from: {line: nxToken.row, ch: nxToken.column},
					to: {line: nxToken.row, ch: nxToken.column + nxToken.text.length},
					options: {className: "CodeMirror-pointer-nx"}
				});
			}
		}

		return (
			<div className={this.state.liparxe ? "liparxe" : ""}>
				<h2>
					{UIText.title.get(this.state.language)}
				</h2>
				<p>
					<label>
						<input type="checkbox"
						checked={this.state.liparxe}
						onChange={this.liparxeChange}/>
						{UIText.show_in_liparxe.get(this.state.language)}
					</label>
				</p>

				<div className="contents">
					<Editor
						language={this.state.language}
						className="editor-pain"
						ref={el => this.editor = el!}
						markers={markers}
						active={!this.state.executing}
					/>

					<div className="interpreter-pain">
						<button
							onClick={this.execute}
							disabled={this.state.executing && !this.state.pausing}
						>{(!this.state.executing ? UIText.execute : this.state.pausing ? UIText.resume : UIText.executing).get(this.state.language)}
						</button>

						<button
							onClick={this.step}
							disabled={this.state.executing && !this.state.pausing}
						>{(this.state.executing ? UIText.execute_step : UIText.begin_step_execution).get(this.state.language)}</button>

						{" | "}

						<button
							onClick={this.pause}
							disabled={!this.state.executing || this.state.pausing}
						>{UIText.pause.get(this.state.language)}</button>

						<button
							onClick={this.stop}
							disabled={!this.state.executing}
						>{UIText.end.get(this.state.language)}</button>

						<br/>

						{UIText.execution_speed.get(this.state.language)}: <input
							type="range" min="70" max="600" step="1"
							value={this.state.execSpeed} onChange={this.changeSpeed}
						/>

						<HardwareState
							language={this.state.language}
							machine={this.machine}
							active={this.state.executing}
						/>
					</div>
				</div>
			</div>
		);
	}
}

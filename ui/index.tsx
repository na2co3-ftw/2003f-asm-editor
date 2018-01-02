import React = require("react");
import ReactDOM = require("react-dom");

import Editor, {MarkerInfoM} from "./editor";
import HardwareState from "./hardware-state";

import {Hardware} from "../2003f/execute";
import {RuntimeError, Token} from "../2003f/types";

const TICK_TIME = 50;

document.addEventListener("DOMContentLoaded", function () {
	ReactDOM.render(<App/>, document.getElementById("root")!);
});

function Header() {
	return (
		<div>
			<h2>
				<span className="lineparine">2003f'd lkurftless</span> Editor
			</h2>
			<p>
				<a href="https://github.com/na2co3-ftw/2003f-asm-editor" target="_blank">view on github</a>
			</p>
			<p>
				<a href="http://jurliyuuri.com/OS/" target="_blank">悠里世界のOSのエミュレータ作ろうぜという計画</a>
			</p>
		</div>
	);
}


interface AppState {
	liparxe: boolean;
	// machine: Hardware;
	// timeOutHandler: number | null;
	executing: boolean;
	pausing: boolean;
	runtimeErrors: string;
}

class App extends React.Component<{}, AppState> {
	private editor: Editor;
	private machine: Hardware = new Hardware();
	private timeOutHandler: number | null = null;

	constructor(props) {
		super(props);

		this.state = {
			liparxe: false,
			executing: false,
			pausing: false,
			runtimeErrors: ""
		};

		this.liparxeChange = this.liparxeChange.bind(this);
		this.execute = this.execute.bind(this);
		this.executeTick = this.executeTick.bind(this);
		this.pause = this.pause.bind(this);
		this.stop = this.stop.bind(this);
		this.step = this.step.bind(this);
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
		this.machine.execOneStep(true);
		// this.forceUpdate();
		this.setState({executing: true, runtimeErrors: ""});
		return true;
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
		this.timeOutHandler = setTimeout(this.executeTick, TICK_TIME);
		this.setState({pausing: false});
	}

	private executeTick() {
		this.timeOutHandler = null;
		const continuing = this.execOneStep();
		if (continuing) {
			this.timeOutHandler = setTimeout(this.executeTick, TICK_TIME);
		} else {
			this.setState({executing: false, pausing: false});
		}
	}

	private execOneStep() {
		let continuing = false;
		let errors = "";
		try {
			continuing = this.machine.execOneStep();
		} catch (e) {
			if (e instanceof RuntimeError) {
				continuing = false;
				errors = e.message;
			}
		}
		//this.forceUpdate();
		this.setState({runtimeErrors: errors});
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

	private getCurrentNXToken(): Token | null {
		const inst = this.machine.program.readNX(this.machine.cpu.nx);
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
				<Header/>
				<p>
					<label>
						<input type="checkbox"
						checked={this.state.liparxe}
						onChange={this.liparxeChange}/>
						リパーシェで表示する
					</label>
				</p>

				<div className="contents">
					<Editor
						className="editor-pain"
						ref={el => this.editor = el!}
						markers={markers}
					/>

					<div className="interpreter-pain">
						<button
							onClick={this.execute}
							disabled={this.state.executing && !this.state.pausing}
						>{!this.state.executing ? "実行" : this.state.pausing ? "再開" : "実行中"}
						</button>

						<button
							onClick={this.step}
							disabled={this.state.executing && !this.state.pausing}
						>{this.state.executing ? "ステップ実行" : "ステップ実行開始"}</button>

						{" | "}

						<button
							onClick={this.pause}
							disabled={!this.state.executing || this.state.pausing}
						>一時停止</button>

						<button
							onClick={this.stop}
							disabled={!this.state.executing}
						>終了</button>

						<p className="errors">{this.state.runtimeErrors}</p>

						<HardwareState machine={this.machine} executing={this.state.executing}/>
					</div>
				</div>
			</div>
		);
	}
}

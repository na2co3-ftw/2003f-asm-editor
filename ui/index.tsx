import React = require("react");
import ReactDOM = require("react-dom");

import Editor, {MarkerInfo} from "./editor";
import HardwareState from "./hardware-state";

import {Hardware} from "../2003fasm/execute";

const TICK_TIME = 50;

document.addEventListener("DOMContentLoaded", function () {
	ReactDOM.render(<App/>, document.getElementById("root")!);
});

function Header() {
	return (
		<div>
			<h2>
				<span className="lineparine">2003'd ferlesyl</span> Asm Editor
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
	machine: Hardware;
	// timeOutHandler: number | null;
	executing: boolean;
	pausing: boolean;
}

class App extends React.Component<{}, AppState> {
	private editor: Editor;
	private timeOutHandler: number | null = null;

	constructor(props) {
		super(props);

		this.state = {
			liparxe: false,
			machine: new Hardware(),
			executing: false,
			pausing: false
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

	private start() {
		const program = this.editor.getProgram();
		if (program == null) {
			return;
		}
		let machine = new Hardware();
		machine.load(program);
		this.setState({machine, executing: true});
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
			this.start();
		}
		this.timeOutHandler = setTimeout(this.executeTick, TICK_TIME);
		this.setState({pausing: false});
	}

	private executeTick() {
		this.timeOutHandler = null;
		let machine = this.state.machine;
		const continuing = machine.execOne();
		this.setState({machine});
		if (continuing) {
			this.timeOutHandler = setTimeout(this.executeTick, TICK_TIME);
		} else {
			this.setState({executing: false, pausing: false});
		}
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
			this.start();
			this.setState({pausing: true});
		} else {
			let machine = this.state.machine;
			machine.execOne();
			this.setState({machine});
		}
	}

	render() {
		const markers: MarkerInfo[] = [];
		if (this.state.executing) {
			const _inst = this.state.machine.program.readNX(this.state.machine.cpu.nx);
			if (_inst != null) {
				const [_, inst] = _inst;
				if (inst.token != null) {
					markers.push({
						from: {line: inst.token.row, ch: inst.token.column},
						to: {line: inst.token.row, ch: inst.token.column + inst.token.text.length},
						options: {className: "CodeMirror-pointer-nx"}
					});
				}
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

				<Editor
					ref={el => this.editor = el!}
					markers={markers}
				/>

				<button
					onClick={this.execute}
					disabled={this.state.executing && !this.state.pausing}
				>実行</button>

				<button
					onClick={this.pause}
					disabled={!this.state.executing || this.state.pausing}
				>中断</button>

				<button
					onClick={this.stop}
					disabled={!this.state.executing}
				>終了</button>

				{" | "}

				<button
					onClick={this.step}
					disabled={this.state.executing && !this.state.pausing}
				>ステップ実行</button>

				<HardwareState machine={this.state.machine}/>
			</div>
		);
	}
}

import React = require("react");
import classNames = require("classnames");

import {Hardware} from "../2003f/execute";
import {SECTION_SIZE} from "../2003f/memory";

const SECTION_LENGTH = 1 << SECTION_SIZE;

interface HardwareStateProps{
	machine: Hardware;
	active: boolean;
}

interface HardwareStateState {
	hex: boolean;
	byte: boolean;
}

export default class HardwareState extends React.Component<HardwareStateProps, HardwareStateState> {
	constructor(props: HardwareStateProps) {
		super(props);

		this.state = {
			hex: true,
			byte: false,
		};

		this.hexChanged = this.hexChanged.bind(this);
		this.unitChanged = this.unitChanged.bind(this);
	}

	private hexChanged(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({hex: e.target.checked});
	}

	private unitChanged(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({byte: e.target.value == "1"});
	}

	render() {
		const machine: Hardware = this.props.machine;

		let memoryNodes: React.ReactNode[] = [];
		let notFirstLine = false;
		let prevSection = -2;
		const sections = machine.memory.usingSections.slice(0);
		const f5Section = machine.cpu.f5 >>> SECTION_SIZE;
		if (sections.indexOf(f5Section) < 0) {
			sections.push(f5Section);
			sections.sort((a, b) => a - b);
		}
		for (const section of sections) {
			if (notFirstLine) {
				memoryNodes.push(<br/>);
			}
			memoryNodes.push(
				<MemorySection
					key={section}
					section={section}
					hex={this.state.hex}
					byte={this.state.byte}
					memory={machine.memory.data}
					f5={machine.cpu.f5}
					separator={notFirstLine && prevSection + 1 != section}
				/>
			);
			prevSection = section;
			notFirstLine = true;
		}

		return (
			<div>
				<form>
					<label>
						<input type="checkbox"
							   checked={this.state.hex}
							   onChange={this.hexChanged}
						/>
						16進数で表示する
					</label>
					<label>
						<input
							type="radio" name="unit" value="1"
							checked={this.state.byte}
							onChange={this.unitChanged}
						/>
						8ビット
					</label>
					<label>
						<input
							type="radio" name="unit" value="4"
							checked={!this.state.byte}
							onChange={this.unitChanged}
						/>
						32ビット
					</label>
				</form>
				<div className={!this.props.active ? "state-inactive": ""}>
					<p className="monospace">
						Registers:<br/>
						<span className="lineparine">
							f0 = <span id="out-f0">{this.showInt32Pad(machine.cpu.f0)}</span><br/>
							f1 = <span id="out-f1">{this.showInt32Pad(machine.cpu.f1)}</span><br/>
							f2 = <span id="out-f2">{this.showInt32Pad(machine.cpu.f2)}</span><br/>
							f3 = <span id="out-f3">{this.showInt32Pad(machine.cpu.f3)}</span><br/>
							f5 = <span id="out-f5">{this.showInt32Pad(machine.cpu.f5)}</span><br/>
							nx = <span id="out-nx">{this.showInt32Pad(machine.cpu.nx)}</span><br/>
							xx = <span id="out-xx">{this.showInt32Pad(machine.cpu.xx)}</span><br/>
							flag = <span id="out-flag">{machine.cpu.flag ? "1" : "0"}</span>
						</span>
					</p>
					<p className="monospace">
						Memory:<br/>
						<span className="lineparine">{memoryNodes}</span>
					</p>
					<p className="monospace">
						Logs:<br/>
						<span className="lineparine">
							{machine.log.join("\n")}
						</span>
					</p>
				</div>
			</div>
		);
	}

	private showInt32Pad(number: number) {
		return showInt32Pad(number, this.state.hex);
	}
}

interface MemorySectionProps{
	section: number,
	memory: {[address: number]: number}
	hex: boolean,
	byte: boolean,
	f5: number,
	separator: boolean
}

const MemorySection: React.SFC<MemorySectionProps> = (props) => {
	const unit = props.byte ? 1 : 4;
	let memoryHTML = "";
	let inF5 = false;
	let address = props.section << SECTION_SIZE;
	memoryHTML += showInt32Pad(address, props.hex);
	memoryHTML += ":";
	for (let i = 0; i < SECTION_LENGTH; i += unit) {
		memoryHTML += " ";
		if (address == props.f5) {
			memoryHTML += '<span class="out-memory-pointer f5">';
			inF5 = true;
		}

		if (props.byte) {
			if (props.memory.hasOwnProperty(address)) {
				memoryHTML += showInt8Pad(props.memory[address], props.hex);
			} else {
				memoryHTML += props.hex ? "--" : "---";
			}
		} else {
			let complete = true;
			let patial = false;
			for (let i = 0; i < 4; i++) {
				if (props.memory.hasOwnProperty(address + i)) {
					patial = true;
				} else {
					complete = false;
				}
			}
			if (complete) {
				const a = props.memory[address];
				const b = props.memory[address + 1];
				const c = props.memory[address + 2];
				const d = props.memory[address + 3];
				memoryHTML += showInt32Pad(compose(a, b, c, d), props.hex);
			} else if (patial) {
				memoryHTML += props.hex ? "********" : "**********";
			} else {
				memoryHTML += props.hex ? "--------" : "----------";
			}
		}

		if (inF5) {
			if (address == ((props.f5 + 4 - unit) | 0)) {
				memoryHTML += '</span>';
				inF5 = false;
			}
		}

		address = (address + unit)|0;
	}
	if (inF5) {
		memoryHTML += '</span>';
	}
	memoryHTML += "<br>";

	const className = classNames("out-memory-section", {
		separator: props.separator
	});
	return (
		<span
			className={className}
			dangerouslySetInnerHTML={{__html: memoryHTML}}
		/>
	);
};

function showInt32Pad(number: number, hex: boolean = false): string {
	const length = hex ? 8 : 10;
	let str = (number >>> 0).toString(hex ? 16 : 10);
	while (str.length < length) {
		str = "0" + str;
	}
	return str;
}

function showInt8Pad(number: number, hex: boolean = false): string {
	const length = hex ? 2 : 3;
	let str = number.toString(hex ? 16 : 10);
	while (str.length < length) {
		str = "0" + str;
	}
	return str;
}

function compose(a: number, b: number, c: number, d: number): number {
	return (a << 24) + (b << 16) + (c << 8) + d;
}

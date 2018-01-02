import React = require("react");

import {Hardware} from "../2003f/execute";
import {SECTION_SIZE} from "../2003f/memory";
import {ReactNode} from "react";
const SECTION_LENGTH = 1 << SECTION_SIZE;

interface HardwareStateProps{
	machine: Hardware;
	executing: boolean;
}

interface HardwareStateState {
	hex: boolean;
}

export default class HardwareState extends React.Component<HardwareStateProps, HardwareStateState> {
	constructor(props) {
		super(props);

		this.state = {
			hex: true
		};

		this.hexChanged = this.hexChanged.bind(this);
	}

	private hexChanged(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({hex: e.target.checked});
	}

	render() {
		const machine: Hardware = this.props.machine;

		let memoryNodes: ReactNode[] = [];
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
				<p>
					<label>
						<input type="checkbox"
							   checked={this.state.hex}
							   onChange={this.hexChanged}
						/>
						16進数で表示する
					</label>
				</p>
				<div className={!this.props.executing ? "out-not-executing": ""}>
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
	f5: number,
	separator: boolean
}

const MemorySection: React.SFC<MemorySectionProps> = (props) => {
	let memoryHTML = "";
	let inF5 = false;
	let address = props.section << SECTION_SIZE;
	memoryHTML += showInt32Pad(address, props.hex);
	memoryHTML += ":";
	for (let i = 0; i < SECTION_LENGTH; i++) {
		memoryHTML += " ";
		if (address == props.f5) {
			memoryHTML += '<span class="out-memory-pointer f5">';
			inF5 = true;
		}
		if (props.memory.hasOwnProperty(address)) {
			memoryHTML += showInt8Pad(props.memory[address], props.hex);
		} else {
			memoryHTML += props.hex ? "--" : "---";
		}
		if (inF5) {
			if (address == ((props.f5 + 3) | 0)) {
				memoryHTML += '</span>';
				inF5 = false;
			}
		}

		address = (address + 1)|0;
	}
	if (inF5) {
		memoryHTML += '</span>';
	}
	memoryHTML += "<br>";

	return (
		<span
			className={props.separator ? "out-memory-section separator" : "out-memory-section"}
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

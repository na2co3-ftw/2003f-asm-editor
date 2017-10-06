import React = require("react");

import {Hardware} from "../2003fasm/execute";
import {SECTION_SIZE} from "../2003fasm/memory";
const SECTION_LENGTH = 1 << SECTION_SIZE;

interface HardwareStateProps{
	machine: Hardware;
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

		let memoryHTML = "";
		let inF5 = false;
		for (const section of machine.memory.usingSections) {
			let address = section << SECTION_SIZE;
			memoryHTML += this.showInt32Pad(address);
			memoryHTML += ":";
			for (let i = 0; i < SECTION_LENGTH; i++) {
				memoryHTML += " ";
				if (address == machine.cpu.f5 || (i == 0 && inF5)) {
					memoryHTML += '<span class="out-memory-pointer f5">';
					inF5 = true;
				}
				if (machine.memory.data.hasOwnProperty(address)) {
					memoryHTML += this.showInt8Pad(machine.memory.data[address]);
				} else {
					memoryHTML += this.state.hex ? "--" : "---";
				}
				if (inF5) {
					if (address == ((machine.cpu.f5 + 3) | 0)) {
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
					<span className="lineparine" dangerouslySetInnerHTML={{__html: memoryHTML}}/>
				</p>
				<p className="monospace">
					Logs:<br/>
					<span className="lineparine">
						{machine.log.join("\n")}
					</span>
				</p>
			</div>
		);
	}

	private showInt32Pad(number: number) {
		return showInt32Pad(number, this.state.hex);
	}

	private showInt8Pad(number: number) {
		return showInt8Pad(number, this.state.hex);
	}
}

function showInt32(number: number, hex: boolean = false): string {
	number = number < 0 ? number + 0x100000000 : number;
	return number.toString(hex ? 16 : 10);
}

function showInt32Pad(number: number, hex: boolean = false): string {
	const length = hex ? 8 : 10;
	let str = showInt32(number, hex);
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

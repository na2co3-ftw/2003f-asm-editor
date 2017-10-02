import CodeMirror from "./codemirror/lib/codemirror";
import "./codemirror/lib/codemirror.css";

import "./codemirror/theme/neat.css";

import "./codemirror/addon/selection/active-line";
import "./codemirror/addon/lint/lint";
import "./codemirror/addon/lint/lint.css";

import "./codemirror/mode/2003fasm/2003fasm";
import {fullParse} from "./2003fasm/parse";
import {linker} from "./2003fasm/linker";
import {Hardware} from "./2003fasm/execute";
import {SECTION_SIZE} from "./2003fasm/memory";
const SECTION_LENGTH = 1 << SECTION_SIZE;

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

document.addEventListener("DOMContentLoaded", function () {
	let source;
	let program;
	let parseErrors = "";
	let machine = new Hardware();
	let hex = true;
	let tickTime = 50;
	let timeOutHundler = -1;
	let executable = false;
	let executing = false;
	let pausing = false;
	let nxPointerMarker = null;

	let editor = CodeMirror(document.getElementById("editor"), {
		value: DEFAULT_ASM,
		mode: "2003fasm",
		theme: "neat",
		styleActiveLine: true,
		lineNumbers: true,
		// gutters: [* "CodeMirror-lint-markers"],
		lint: function (newSource) {
			parse(newSource);

			// console.log(p.tokens.map(t => t.toString()));
			// asm.load(source);
			// const errors = asm.errors.map(parseErrorToLintMarker("error"));
			// const warnings = asm.warnings.map(parseErrorToLintMarker("warning"));
			// return errors.concat(warnings);
		}
	});

	function parse(newSource) {
		if (newSource == source) {
			parseErrors = "";
			executable = true;
			return;
		}
		try {
			const persed = fullParse(newSource);
			program = linker([persed]);
			source = newSource;
			parseErrors = "";
			executable = true;
		} catch (e) {
			parseErrors = e.message;
			executable = false;
		}
		update();
	}

	// function parseErrorToLintMarker(severity) {
	// 	return error => ({
	// 		message: error.message,
	// 		severity: severity,
	// 		from: CodeMirror.Pos(error.token.lineNumber, error.token.columnNumber),
	// 		to: CodeMirror.Pos(error.token.lineNumber, error.token.columnNumber + error.token.text.length)
	// 	});
	// }

	document.getElementById("execute").addEventListener("click", () => {
		if (!executing) {
			parse(editor.getValue());
			if (!executable) {
				return;
			}
			machine = new Hardware();
			machine.load(program);
			executing = true;
		}
		pausing = false;
		update();
		timeOutHundler = setTimeout(exec, tickTime);
	});

	document.getElementById("pause").addEventListener("click", () => {
		if (timeOutHundler >= 0) {
			clearTimeout(timeOutHundler);
			timeOutHundler = -1;
		}
		pausing = true;
		update();
	});

	document.getElementById("stop").addEventListener("click", () => {
		if (timeOutHundler >= 0) {
			clearTimeout(timeOutHundler);
			timeOutHundler = -1;
		}
		executing = false;
		update();
	});

	document.getElementById("step").addEventListener("click", () => {
		if (!executing) {
			parse(editor.getValue());
			if (!executable) {
				return;
			}
			machine = new Hardware();
			machine.load(program);
			executing = true;
			pausing = true;
		} else {
			machine.execOne();
		}
		update();
	});

	document.getElementById("import").addEventListener("change", e => {
		for (const file of e.target.files) {
			const reader = new FileReader();
			reader.addEventListener("load", e => {
				let contents = e.target.result;
				editor.setValue(contents);
			});
			reader.readAsText(file);
		}
	});

	document.getElementById("out-ishex").addEventListener("change", function () {
		console.log(this.checked);
		hex = this.checked;
		update();
	});

	function exec() {
		timeOutHundler = -1;
		const continuing = machine.execOne();
		update();
		if (continuing) {
			timeOutHundler = setTimeout(exec, tickTime);
		} else {
			executing = false;
			update();
		}
	}

	function update() {
		document.getElementById("parse-errors").innerText = parseErrors;

		if (nxPointerMarker != null) {
			nxPointerMarker.clear();
		}
		if (executing) {
			const tat = machine.program.tentativeAddresTable;
			if (tat.hasOwnProperty(machine.cpu.nx)) {
				const [_, inst] = tat[machine.cpu.nx];
				if (inst.token != null) {
					nxPointerMarker = editor.markText(
						CodeMirror.Pos(inst.token.row, inst.token.column),
						CodeMirror.Pos(inst.token.row, inst.token.column + inst.token.text.length),
						{className: "CodeMirror-pointer-nx"}
					);
					console.dir(nxPointerMarker);
				}
			}
		}

		document.getElementById("out-f0").innerText = showInt32Pad(machine.cpu.f0, hex);
		document.getElementById("out-f1").innerText = showInt32Pad(machine.cpu.f1, hex);
		document.getElementById("out-f2").innerText = showInt32Pad(machine.cpu.f2, hex);
		document.getElementById("out-f3").innerText = showInt32Pad(machine.cpu.f3, hex);
		document.getElementById("out-f5").innerText = showInt32Pad(machine.cpu.f5, hex);
		document.getElementById("out-nx").innerText = showInt32Pad(machine.cpu.nx, hex);
		document.getElementById("out-xx").innerText = showInt32Pad(machine.cpu.xx, hex);
		document.getElementById("out-flag").innerText = machine.cpu.flag ? "1" : "0";

		let memory = "";
		let inF5 = false;
		for (const section of machine.memory.usingSections) {
			let address = section << SECTION_SIZE;
			memory += showInt32Pad(address, hex);
			memory += ":";
			for (let i = 0; i < SECTION_LENGTH; i++) {
				memory += " ";
				if (address == machine.cpu.f5 || (i == 0 && inF5)) {
					memory += '<span class="out-memory-pointer f5">';
					inF5 = true;
				}
				if (machine.memory.data.hasOwnProperty(address)) {
					memory += showInt8Pad(machine.memory.data[address], hex);
				} else {
					memory += hex ? "--" : "---";
				}
				if (inF5) {
					if (address == (machine.cpu.f5 + 3) | 0) {
						memory += '</span>';
						inF5 = false;
					}
				}

				address = (address + 1)|0;
			}
			if (inF5) {
				memory += '</span>';
			}
			memory += "<br>";
		}
		document.getElementById("out-memory").innerHTML = memory;
		document.getElementById("out-log").innerText = machine.log.join("\n");

		document.getElementById("execute").disabled = executing && !pausing;
		document.getElementById("pause").disabled = !executing || pausing;
		document.getElementById("stop").disabled = !executing;
		document.getElementById("step").disabled = executing && !pausing;
	}

	document.getElementById("use-liparxe").addEventListener("change", function () {
		if (this.checked) {
			document.body.classList.add("liparxe");
		} else {
			document.body.classList.remove("liparxe");
		}
	});

	update();
});

function showInt32(number, hex) {
	number = number < 0 ? number + 0x100000000 : number;
	return number.toString(hex ? 16 : 10);
}

function showInt32Pad(number, hex) {
	const length = hex ? 8 : 10;
	let str = showInt32(number, hex);
	while (str.length < length) {
		str = "0" + str;
	}
	return str;
}

function showInt8Pad(number, hex) {
	const length = hex ? 2 : 3;
	let str = number.toString(hex ? 16 : 10);
	while (str.length < length) {
		str = "0" + str;
	}
	return str;
}

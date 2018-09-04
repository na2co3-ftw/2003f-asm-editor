import * as CodeMirror from "codemirror";
import "codemirror/addon/mode/simple";

const MNEMONICS = [
	"k[rR]z", "malk[rR]z", "inj", "k[rR]z(?:16|8)[ci]",
	"ata", "nta", "lat", "latsna",
	"ada", "ekc", "dal", "nac",
	"dto", "d[rR]o", "dtosna",
	"fi",
	"fen",
	"zali", "ycax", "fenx", "dosn"
];

const COMPARES = [
	"xtlo", "xylo", "clo", "xolo", "llo", "niv",
	"xtlonys", "xylonys", "xolonys", "llonys"
];

const REGISTERS = [
	"f0", "f1", "f2", "f3", "f5", "xx"
];

const DIRECTIVES = [
	"'c'i", "'i'c",
	"l'", "nll", "cers",
	"kue", "xok"
];

const BUILTINFUNCTIONS = [
	"3126834864"
];

CodeMirror.defineSimpleMode("ata2003lk", {
	start: [
		{regex: new RegExp(`(${MNEMONICS.join("|")})(?![\\w'_-])`), token: "keyword"},
		{regex: new RegExp(`(${COMPARES.join("|")})(?![\\w'_-])`), token: "builtin"},
		{regex: new RegExp(`(${REGISTERS.join("|")})(?![\\w'_-])`), token: "variable"},
		{regex: new RegExp(`(${DIRECTIVES.join("|")})(?![\\w'_-])`), token: "special"},
		{regex: new RegExp(`(${BUILTINFUNCTIONS.join("|")})(?![\\w'_-])`), token: "builtin"},
		{regex: /lar(?![\w'_-])/, token: "keyword", indent: true},
		{regex: /ral(?![\w'_-])/, token: "keyword", dedent: true},
		{regex: /s(?=\s*@)/, token: "builtin"},
		{regex: /\d+(?![\w'_-])/, token: "number"},
		{regex: /[@+]/, token: "operator"},
		{regex: /;/, token: "comment", next: "comment"},
		{regex: /[^\sFRVXa-z0-9'_-]/, token: "error" },
		{regex: /[^\s;]+/, token: null}
	],
	comment: [
		{regex: /.*?;/, token: "comment", next: "start"},
		{regex: /.*/, token: "comment"}
	],
	meta: {
		lineComment: ";",
		electricChars: "ral"
	}
});

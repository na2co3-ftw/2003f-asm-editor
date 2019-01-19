import * as CodeMirror from "codemirror";
import "codemirror/addon/mode/simple";

const OPERATORS = [
	"xtlo", "xylo", "clo", "niv", "llo", "xolo",
	"xtlonys", "xylonys", "llonys", "xolonys",
	"ada", "ekc", "dal",
	"dto", "dtosna", "d[rR]o",
	"lat", "latsna",
	"sna", "nac"
];

const KEYWORDS = [
	"kue", "xok",
	"anax", "el", "eksa", "fi", "fal", "dosnud",
	"cersva"
];

const SUPPORTS = [
	"fasal"
];

CodeMirror.defineSimpleMode("tinka_new", {
	start: [
		{regex: new RegExp(`(${OPERATORS.join("|")})(?![\\w'_]|-(?!-))`), token: "keyword"},
		{regex: new RegExp(`(${KEYWORDS.join("|")})(?![\\w'_]|-(?!-))`), token: "special"},
		{regex: /rinyv(?![\w'_]|-(?!-))/, token: "special", indent: true},
		{regex: /situv(?![\w'_]|-(?!-))/, token: "special", dedent: true},
		{regex: new RegExp(`(${SUPPORTS.join("|")})(?![\\w'_]|-(?!-))`), token: "builtin"},
		{regex: /\d+(?![\w'_]|-(?!-))/, token: "number"},
		{regex: /[+|#:]/, token: "operator"},
		{regex: /--.*/, token: "comment"},
		{regex: /([^\s-]|-(?!-))+/, token: null}
	],
	meta: {
		lineComment: "--",
		electricChars: "situv"
	}
});

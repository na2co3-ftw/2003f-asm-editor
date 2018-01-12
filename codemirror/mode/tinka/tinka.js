import * as CodeMirror from "codemirror";
import "codemirror/addon/mode/simple";

const OPERATORS = [
	"k[rR]z",
	"ata", "nta", "lat", "latsna",
	"kak", "ada", "ekc", "nac", "dal",
	"dto", "d[rR]o", "dtosna"
];

const COMPARES = [
	"xtlo", "xylo", "clo", "niv", "llo", "xolo",
	"xtlonys", "xylonys", "llonys", "xolonys"
];

const KEYWORDS = [
	"kue", "xok", "anax",
	"fi", "fal",
	"cersva", "dosnud", "fenxeo", "el"
];

const SUPPORTS = [
	"'3126834864", "_fasal"
];

CodeMirror.defineSimpleMode("tinka", {
	start: [
		{regex: new RegExp(`(${OPERATORS.join("|")})(?![\\w'_]|-(?!-))`), token: "keyword"},
		{regex: new RegExp(`(${COMPARES.join("|")})(?![\\w'_]|-(?!-))`), token: "builtin"},
		{regex: new RegExp(`(${KEYWORDS.join("|")})(?![\\w'_]|-(?!-))`), token: "special"},
		{regex: /rinyv(?![\w'_]|-(?!-))/, token: "special", indent: true},
		{regex: /situv(?![\w'_]|-(?!-))/, token: "special", dedent: true},
		{regex: new RegExp(`(${SUPPORTS.join("|")})(?![\\w'_]|-(?!-))`), token: "builtin"},
		{regex: /\d+(?![\w'_]|-(?!-))/, token: "number"},
		{regex: /@/, token: "operator"},
		{regex: /--.*/, token: "comment"},
		{regex: /([^\s-]|-(?!-))+/, token: null}
	],
	meta: {
		lineComment: "--",
		electricChars: "situv"
	}
});

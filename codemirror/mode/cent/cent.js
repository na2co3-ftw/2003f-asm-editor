import * as CodeMirror from "codemirror";
import "codemirror/addon/mode/simple";

const OPERATORS = [
	"ata", "nta", "lat", "latsna",
	"kak", "ada", "ekc", "nac", "dal",
	"dto", "dtosna", "d[rR]o",
	"xtlo", "xylo", "clo", "niv", "llo", "xolo",
	"xtlonys", "xylonys", "llonys", "xolonys",
	"k[rR]z", "ach", "roft", "ycax", "pielyn", "kinfit"
];

const KEYWORDS = [
	"fal", "laf",
	"fi", "ol", "if",
	"cecio", "oicec",
	"xok"
];

CodeMirror.defineSimpleMode("cent", {
	start: [
		{regex: new RegExp(`(${OPERATORS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "keyword"},
		{regex: new RegExp(`(${KEYWORDS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "special"},
		{regex: /</, token: "special", indent: true},
		{regex: />/, token: "special", dedent: true},
		{regex: /\d+(?![^\s'<>]|'(?!-))/, token: "number"},
		{regex: /'-/, token: "comment", next: "comment"},
		{regex: /([^\s'<>]|'(?!-))+/, token: null}
	],
	comment: [
		{regex: /.*?-'/, token: "comment", next: "start"},
		{regex: /.*/, token: "comment"}
	],
	meta: {
		blockCommentStart: "'-",
		blockCommentEnd: "-'",
		electricChars: ">"
	}
});

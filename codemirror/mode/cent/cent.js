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

const KEYWORDS = ["xok"];

const OPEN_KEYWORDS = ["fal", "fi", "cecio"];

const CLOSE_KEYWORDS = ["laf", "if", "oicec"];

const DELIMITER_KEYWORDS = ["ol"];

CodeMirror.defineSimpleMode("cent", {
	start: [
		{regex: new RegExp(`(${OPERATORS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "keyword"},
		{regex: new RegExp(`(${KEYWORDS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "special"},
		{regex: new RegExp(`(${OPEN_KEYWORDS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "special", indent: true},
		{regex: new RegExp(`(${CLOSE_KEYWORDS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "special", dedent: true},
		{regex: new RegExp(`(${DELIMITER_KEYWORDS.join("|")})(?![^\\s'<>]|'(?!-))`), token: "special", indent: true, dedent: true},
		{regex: /[<>]/, token: "special"},
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
		electricInput: new RegExp(`^\\s*(${[...CLOSE_KEYWORDS, ...DELIMITER_KEYWORDS].join("|")})$`)
	}
});

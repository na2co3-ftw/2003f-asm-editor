(function(mod) {
	if (typeof exports == "object" && typeof module == "object") {
		require("../../addon/mode/simple");
		mod(require("../../lib/codemirror"));
	} else if (typeof define == "function" && define.amd) {
		define(["../../lib/codemirror", "../../addon/mode/simple"], mod);
	} else {
		mod(CodeMirror);
	}
})(function(CodeMirror) {
	"use strict";

	const MNEMONICS = [
		"krz", "malkrz", "inj",
		"ata", "nta",
		"ada", "ekc", "dal", "nac",
		"dto", "dro",
		"fi",
		"fen"
	];

	const CONDITIONS = [
		"xtlo", "xylo", "clo", "xolo", "llo", "niv",
		"xtlonys", "xylonys", "xolonys", "llonys"
	];

	const REGISTERS = [
		"f0", "f1", "f2", "f3", "f5", "xx"
	];

	const DIRECTIVES = [
		"'c'i", "'i'c",
		"l'", "nll"
	];

	const BUILTINFUNCTIONS = [
		"3126834864"
	];

	CodeMirror.defineSimpleMode("2003fasm", {
		start: [
			{regex: new RegExp(`(${MNEMONICS.join("|")})(?![\\w'_-])`), token: "keyword"},
			{regex: new RegExp(`(${CONDITIONS.join("|")})(?![\\w'_-])`), token: "builtin"},
			{regex: new RegExp(`(${REGISTERS.join("|")})(?![\\w'_-])`), token: "variable"},
			{regex: new RegExp(`(${DIRECTIVES.join("|")})(?![\\w'_-])`), token: "special"},
			{regex: new RegExp(`(${BUILTINFUNCTIONS.join("|")})(?![\\w'_-])`), token: "builtin"},
			{regex: /\d+(?![\w'_-])/, token: "number"},
			{regex: /[@+]/, token: "operator"},
			{regex: /;.*/, token: "comment"},
			{regex: /[^\spFftcxkqhRzmnrljwbVvdsgXiyuoea0-9'_-]/, token: "error" },
			{regex: /\S+/, token: null}
		],
		meta: {
			lineComment: ";"
		}
	});
});

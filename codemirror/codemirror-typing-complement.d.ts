import * as CodeMirror from "codemirror";

declare module "codemirror" {
	interface Editor extends Doc {
	}

	interface EditorConfiguration {
		// codemirror/addon/selection/active-line
		styleActiveLine?: boolean;
	}
}

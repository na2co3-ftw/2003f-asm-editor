import * as CodeMirror from "codemirror";

declare module "codemirror" {
	interface Editor extends Doc {
		// codemirror/addon/lint/lint
		performLint(): void
	}

	interface EditorConfiguration {
		// codemirror/addon/selection/active-line
		styleActiveLine?: boolean;
	}

	interface LintStateOptions {
		// codemirror/addon/lint/lint
		delay: number
	}
}

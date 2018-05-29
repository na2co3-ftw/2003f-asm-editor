import React = require("react");

import {isTranspilableToAsm, Language, LANGUAGES, SourceFile} from "./cached-compiler";

interface EditorStatusBarProps {
	file: SourceFile;
	changeLanguage: (language: Language) => void
	transpileFile: () => void
}

export default class EditorStatusBar extends React.PureComponent<EditorStatusBarProps> {
	constructor(props: EditorStatusBarProps) {
		super(props);
		this.onLanguageRadioClicked = this.onLanguageRadioClicked.bind(this);
	}

	private onLanguageRadioClicked(e: React.ChangeEvent<HTMLInputElement>) {
		this.props.changeLanguage(e.target.value as Language);
	}

	render() {
		return (
			<div
				className="editor-status-bar"
			>
				{LANGUAGES.map(language =>
					<label className={this.props.file.language == language ? "active" : ""}>
						<input
							type="radio"
							name="language"
							value={language}
							checked={this.props.file.language == language}
							onChange={this.onLanguageRadioClicked}
						/>{language + " "}
					</label>
				)}
				<button
					disabled={!isTranspilableToAsm(this.props.file.language)}
					onClick={this.props.transpileFile}
				>トランスパイル</button>
			</div>
		);
	}
}

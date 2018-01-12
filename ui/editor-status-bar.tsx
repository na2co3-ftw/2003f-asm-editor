import React = require("react");

import {SourceFile} from "./cached-compiler";

interface EditorStatusBarProps {
	file: SourceFile;
	changeLanguage: () => void
}

export default class EditorStatusBar extends React.PureComponent<EditorStatusBarProps> {
	render() {
		return (
			<div
				className="editor-status-bar"
				onClick={this.props.changeLanguage}
			>
				<span style={{fontSize: "70%"}}>クリックで言語を変更</span>
				{": " + this.props.file.language}
			</div>
		);
	}
}

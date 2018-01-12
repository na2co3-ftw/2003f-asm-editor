import React = require("react");
import classNames = require("classnames");

interface EditorTabProps {
	id: number;
	name: string;
	active: boolean;
	closable: boolean;
	hasError: boolean;
	hasWarning: boolean
	onClick: (id: number) => void;
	onClose: (id: number) => void;
	onRename: (id: number, name: string) => void;
}

interface EditorTabState {
	renaming: boolean;
	renamingName: string;
}

export default class EditorTab extends React.PureComponent<EditorTabProps, EditorTabState> {
	constructor(props: EditorTabProps) {
		super(props);

		this.state = {renaming: false, renamingName: ""};

		this.onClick = this.onClick.bind(this);
		this.onCloseClick = this.onCloseClick.bind(this);
		this.onNameChange = this.onNameChange.bind(this);
		this.onNameKeyDown = this.onNameKeyDown.bind(this);
		// this.onNameFocus = this.onNameFocus.bind(this);
		this.onNameBlur = this.onNameBlur.bind(this);
	}

	private onClick() {
		if (this.props.active) {
			this.setState({renaming: true, renamingName: this.props.name});
		} else {
			this.props.onClick(this.props.id);
		}
	}

	private onCloseClick(e: React.MouseEvent<HTMLButtonElement>) {
		this.props.onClose(this.props.id);
		e.stopPropagation();
	}

	private onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({renamingName: e.target.value});
	}

	private onNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.keyCode == 13) { // enter
			this.renameCommit();
		} else if (e.keyCode == 27) { // escape
			this.renameCancel();
		}
	}

	private onNameFocus(e: React.FocusEvent<HTMLInputElement>) {
		(e.target as HTMLInputElement).select();
	}

	private onNameBlur(e: React.FocusEvent<HTMLInputElement>) {
		this.renameCommit();
	}

	private renameCommit() {
		this.setState({renaming: false});
		this.props.onRename(this.props.id, this.state.renamingName);
	}

	private renameCancel() {
		this.setState({renaming: false});
	}

	render() {
		let className = classNames("editor-tab", {
			active: this.props.active,
			error: this.props.hasError,
			warning: !this.props.hasError && this.props.hasWarning
		});
		return (
			<span className={className} onClick={this.onClick}>
				{this.state.renaming ?
					<input
						type="text"
						value={this.state.renamingName}
						onChange={this.onNameChange}
						onKeyDown={this.onNameKeyDown}
						onFocus={this.onNameFocus}
						onBlur={this.onNameBlur}
						autoFocus={true}
					/> :
					this.props.name
				}
				{this.props.closable ?
					<span className="editor-tab-close" onClick={this.onCloseClick}>×</span> :
					null
				}
			</span>
		);
	}
}

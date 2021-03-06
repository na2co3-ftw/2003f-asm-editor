/// <reference path="../codemirror/codemirror-typing-complement.d.ts" />

import React from "react";

import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";

import isEqual from "lodash.isequal";

export interface MarkerInfo {
	from: CodeMirror.Position,
	to: CodeMirror.Position,
	options?: CodeMirror.TextMarkerOptions
}

interface CodeMirrorProps {
	value?: string;
	option?: CodeMirror.EditorConfiguration;
	onChange?: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => void;
	onDragOver?: (event: DragEvent) => void;
	onDrop?: (event: DragEvent) => void;
	markers?: MarkerInfo[];
}

export default class CodeMirrorComponent extends React.Component<CodeMirrorProps> {
	private el!: HTMLElement;
	private editor!: CodeMirror.Editor;
	private acceptEvents = false;
	private textMarkers: CodeMirror.TextMarker[] = [];

	constructor(props: CodeMirrorProps) {
		super(props);

		this.onChange = this.onChange.bind(this);
		this.onDragOver = this.onDragOver.bind(this);
		this.onDrop = this.onDrop.bind(this);
	}

	private onChange(instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) {
		if (this.acceptEvents && this.props.onChange) {
			this.props.onChange(instance, change);
		}
	}

	private onDragOver(instance: CodeMirror.Editor, event: Event) {
		if (this.props.onDragOver) {
			this.props.onDragOver(event as DragEvent);
		}
	}

	private onDrop(instance: CodeMirror.Editor, event: Event) {
		if (this.props.onDrop) {
			this.props.onDrop(event as DragEvent);
		}
	}

	componentDidMount(): void {
		this.editor = CodeMirror(this.el, this.props.option);

		if (this.props.value) {
			this.editor.setValue(this.props.value);
		}
		this.editor.on("change", this.onChange);
		this.editor.on("dragover", this.onDragOver);
		this.editor.on("drop", this.onDrop);

		this.acceptEvents = true;
	}

	componentWillReceiveProps(nextProps: CodeMirrorProps) {
		let valueChanged = false;
		this.acceptEvents = false;

		if (typeof nextProps.value != "undefined" && this.editor.getValue() != nextProps.value) {
			const cursor = this.editor.getCursor();
			const lastLine = this.editor.lastLine();
			const lastCh = this.editor.getLine(lastLine).length;
			this.editor.replaceRange(
				nextProps.value,
				{line: 0, ch: 0},
				{line: lastLine, ch: lastCh}
			);
			this.editor.setCursor(cursor);
			valueChanged = true;
		}

		if (nextProps.option) {
			for (let key of Object.keys(nextProps.option)) {
				if (this.props.option &&
					isEqual((this.props.option as any)[key], (nextProps.option as any)[key])) {
					continue;
				}
				this.editor.setOption(key, (nextProps.option as any)[key]);
			}
		}

		if (nextProps.markers) {
			this.setMarkers(nextProps.markers, valueChanged);
		} else {
			this.setMarkers([]);
		}

		this.acceptEvents = true;
	}

	private setMarkers(markers: MarkerInfo[], forceUpdate: boolean = false) {
		for (let i = 0; i < markers.length; i++) {
			if (this.props.markers && this.props.markers[i]) {
				if (isEqual(this.props.markers[i], markers[i]) && !forceUpdate) {
					continue;
				} else {
					this.textMarkers[i].clear();
				}
			}
			this.textMarkers[i] = this.editor.markText(markers[i].from, markers[i].to, markers[i].options);
		}
		if (this.props.markers) {
			for (let i = markers.length; i < this.props.markers.length; i++) {
				this.textMarkers[i].clear();
			}
		}
		this.textMarkers.length = markers.length;
	}

	refresh() {
		this.editor.refresh();
	}

	performLint() {
		this.editor.performLint();
	}

	render() {
		return (
			<div ref={(el) => this.el = el!}/>
		);
	}
}

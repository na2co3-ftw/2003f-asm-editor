import {ParamText, SimpleText} from "./text";

export namespace LinkerText {
	export const multiple_main_files = new SimpleText({
		"ja": "Multiple main files"
	});

	export const no_main_files = new SimpleText({
		"ja": "No main files"
	});

	export const duplicated_global_label = ParamText.create({
		"ja": label => `Different files export the same label '${label}'`
	});

	export const undefined_external_label = ParamText.create({
		"ja": label => `'${label}' is not defined in any other file`
	});

	export const too_large_file = ParamText.create({
		"ja": fileName => `Size of '${fileName}' is exceeds the limit`
	});
}

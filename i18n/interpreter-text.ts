import {ParamText, SimpleText} from "./text";

export namespace InterpreterText {
	export const invalid_nx_address = ParamText.create<number>({
		"ja": nx => "nx has an invalid address " + nx
	});

	export const undefined_label = ParamText.create({
		"ja": label => `Undefined label '${label}'`
	});

	export const f5_is_not_preserved = ParamText.create<{
		expected: number;
		actual: number;
	}>({
		"ja": ({expected, actual}) => `f5 register was not preserved after the call. It should be in ${expected} but is actually in ${actual}`
	});

	export const too_large_shift_amount = ParamText.create<number>({
		"ja": amount => `Shift amount ${amount} is larger than 63`
	});

	export const read_memory_uninitialized = new SimpleText({
		"ja": "Read undefined memory"
	});

	export const write_memory_not_aligned = ParamText.create<number>({
		"ja": address => `Write memory by not aligned address ${address}`
	});

	export const read_memory_not_aligned = ParamText.create<number>({
		"ja": address => `Read memory by not aligned address ${address}`
	});
}

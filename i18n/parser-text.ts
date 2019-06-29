import {ParamText, SimpleText} from "./text";

export namespace ParserText {
	// common
	export const expected = ParamText.create({
		"ja": token => `'${token}' expected`
	});

	export const not_executable = ParamText.create({
		"ja": token => `'${token}' is not executable`
	});

	export const already_defined = ParamText.create({
		"ja": token => `'${token}' is already defined`
	});

	export const undefined = ParamText.create({
		"ja": token => `'${token}' is not defined`
	});

	export const unused = ParamText.create({
		"ja": token => `'${token}' is defined but not used`
	});

	// 2003lk
	export const undefined_behavior = new SimpleText({
		"ja": "Undefined behavior"
	});

	export const instruction_expected = new SimpleText({
		"ja": "Instruction expected"
	});

	export const operand_expected = new SimpleText({
		"ja": "Operand expected"
	});

	export const invalid_operand = new SimpleText({
		"ja": "Invalid operand"
	});

	export const invalid_operand_to_write = new SimpleText({
		"ja": "Invalid operand to write value"
	});

	export const invalid_displacement = new SimpleText({
		"ja": "Invalid displacement"
	});

	export const value_expected = new SimpleText({
		"ja": "Value expected"
	});

	export const invalid_value = new SimpleText({
		"ja": "Invalid value"
	});

	export const label_name_expected = new SimpleText({
		"ja": "Label name expected"
	});

	export const invalid_label_name = new SimpleText({
		"ja": "Invalid label name"
	});

	export const deprecated_label_name = new SimpleText({
		"ja": "Deprecated label name"
	});

	export const compare_keyword_expected = new SimpleText({
		"ja": "Compare keyword expected"
	});

	export const operand_order_should_be_specified = new SimpleText({
		"ja": "Operand oder should be specified before any instruction"
	});

	export const malkrz_should_follow_fi = new SimpleText({
		"ja": "'malkrz' should follow 'fi'"
	});

	export const malkrz_should_not_be_labeled = new SimpleText({
		"ja": "'malkrz' should not be labeled"
	});

	export const fi_should_be_followed_by_malkrz = new SimpleText({
		"ja": "'fi' should be followed by 'malkrz'"
	});

	export const l_should_be_directly_preceded_by_an_instruction = new SimpleText({
		"ja": "l' should be directly preceded by an instruction"
	});

	export const nll_should_be_directly_followed_by_an_instruction = new SimpleText({
		"ja": "'nll' should be directly followed by an instruction"
	});
}

type InterpolatableValue = string | number | (string | number)[]

const leadingWhitespace = /^\s+/gm

export function stripLeading(
	strings: TemplateStringsArray,
	...values: InterpolatableValue[]
): string {
	// TODO: Use String.raw({raw: strings.map(...)}, ...values)?
	return strings
		.flatMap((value, index) => {
			let replaced = value.replaceAll(leadingWhitespace, '')
			return index < values.length ? [replaced, values[index]] : replaced
		})
		.join('')
}

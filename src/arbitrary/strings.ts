export const Escape = '\\'

export function escapeUnescaped(s: string, specials: string[]): string {
	const escapeIsSpecial = specials.includes(Escape)
	let escaped = false
	let result = ''
	for (const codePoint of s) {
		if (escaped) {
			if (escapeIsSpecial && codePoint !== Escape) {
				// If the previous code point was an escape and escape is special then we need to insert an
				// escape.
				result += Escape
			}
			escaped = false
		} else {
			if (codePoint === Escape) {
				escaped = true
			} else if (specials.includes(codePoint)) {
				// If the previous code point was not an escape and the current code point is special then
				// we need to insert an escape.
				result += Escape
			}
		}
		result += codePoint
	}
	if (escaped && escapeIsSpecial) {
		// If the last code point was an escape and escape is special then we need to add a final
		// escape.
		result += Escape
	}
	return result
}

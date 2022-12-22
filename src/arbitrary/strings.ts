import { interpretHexCodeEscape, interpretUnicodeEscape } from './unicode'

export const Escape = '\\'

const SpecialSubstitutions: Record<string, string> = {
	'0': '\0',
	n: '\n',
	r: '\r',
	v: '\v',
	t: '\t',
	b: '\b',
	f: '\f'
}

// TODO: Make specials a function argument.
export function escapeUnescaped(s: string, specials: string[]): string {
	const escapeIsSpecial = specials.includes(Escape)
	let escaped = false
	let result = ''
	for (const codePoint of s) {
		if (escaped) {
			if (escapeIsSpecial && codePoint !== Escape) {
				// If the previous code point was an escape and the current one is not an escape and escape is special then we
				// have found an unescaped escape and need to insert another escape.
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

// TODO: Rename to unescape.
// TODO: Take escapes as a function argument.
export function replaceEscapes(s: string): string {
	let result = ''
	let codePointsIndex = 0
	let codeUnitsIndex = 0
	const codePoints = Array.from(s)
	while (codePointsIndex < codePoints.length) {
		const current = codePoints[codePointsIndex]
		if (current === Escape) {
			const next = codePoints[codePointsIndex + 1]
			switch (next) {
				case undefined:
					codePointsIndex++
					codeUnitsIndex++
					break
				case '0':
				case 'n':
				case 'r':
				case 'v':
				case 't':
				case 'b':
				case 'f':
					result += SpecialSubstitutions[next]
					codePointsIndex += 2
					codeUnitsIndex += 2
					break
				case 'u': {
					const interpreted = interpretUnicodeEscape(s, codeUnitsIndex)
					if (interpreted !== undefined) {
						result += interpreted.codePoint
						codePointsIndex += [...interpreted.match].length
						codeUnitsIndex += interpreted.match.length
						break
					} else {
						throw new SyntaxError('Invalid Unicode escape sequence')
					}
				}
				case 'x': {
					const interpreted = interpretHexCodeEscape(s, codeUnitsIndex)
					if (interpreted !== undefined) {
						result += interpreted.codePoint
						codePointsIndex += [...interpreted.match].length
						codeUnitsIndex += interpreted.match.length
						break
					} else {
						throw new SyntaxError('Invalid hexadecimal escape sequence')
					}
				}
				// Let the default handle these.
				//case "'":
				//case '"':
				//case '\\':
				default:
					// Invalid escape sequences get removed (except for unicode escape sequences).
					result += next
					codePointsIndex += 2
					codeUnitsIndex += 1 + next.length
					break
			}
		} else {
			result += current
			codePointsIndex++
			codeUnitsIndex += current.length
		}
	}
	return result
}

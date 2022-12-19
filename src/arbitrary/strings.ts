export const Escape = '\\'

export const SpecialSubstitutions: Record<string, string> = {
	'0': '\0',
	n: '\n',
	r: '\r',
	v: '\v',
	t: '\t',
	b: '\b',
	f: '\f'
}

const UnicodeBasicEscape = /\\u([0-9A-Fa-f]{4})/uy
const UnicodeFullEscape = /\\u\{([0-9A-Fa-f]{1,6})\}/uy
const UnicodeLatinEscape = /\\x([0-9A-Fa-f]{2})/uy

// TODO: Make specials a function argument.
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

function isHighSurrogate(code: number): boolean {
	return 0xd800 <= code && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
	return 0xdc00 <= code && code <= 0xdfff
}

function fromSurrogatePair(high: number, low: number): string {
	return String.fromCodePoint(((high - 0xd800) << 10) + (low - 0xdc00) + 0x010000)
}

interface UnicodeMatch {
	code: number
	matchedCodePoints: number
	matchedCodeUnits: number
}

function matchUnicode(regexp: RegExp, s: string, codeUnitsIndex: number): UnicodeMatch | undefined {
	regexp.lastIndex = codeUnitsIndex
	const match = regexp.exec(s)
	if (match !== null) {
		const code = Number.parseInt(match[1], 16)
		const codePointLength = [...match[0]].length
		const codeUnitLength = match[0].length
		return { code, matchedCodePoints: codePointLength, matchedCodeUnits: codeUnitLength }
	} else {
		return
	}
}

interface ParseResult {
	codePoint: string
	parsedCodePoints: number
	parsedCodeUnits: number
}

function parseUnicodeBasicEscape(s: string, codeUnitsIndex: number): ParseResult | undefined {
	const high = matchUnicode(UnicodeBasicEscape, s, codeUnitsIndex)
	if (high !== undefined) {
		if (isHighSurrogate(high.code)) {
			const low = matchUnicode(UnicodeBasicEscape, s, codeUnitsIndex + high.matchedCodeUnits)
			if (low !== undefined) {
				if (isLowSurrogate(low.code)) {
					return {
						codePoint: fromSurrogatePair(high.code, low.code),
						parsedCodePoints: high.matchedCodePoints + low.matchedCodePoints,
						parsedCodeUnits: high.matchedCodeUnits + low.matchedCodeUnits
					}
				}
			}
		}
		return {
			codePoint: String.fromCodePoint(high.code),
			parsedCodePoints: high.matchedCodePoints,
			parsedCodeUnits: high.matchedCodeUnits
		}
	} else {
		return
	}
}

function parseUnicodeFullEscape(s: string, codeUnitsIndex: number): ParseResult | undefined {
	const match = matchUnicode(UnicodeFullEscape, s, codeUnitsIndex)
	if (match !== undefined) {
		return {
			codePoint: String.fromCodePoint(match.code),
			parsedCodePoints: match.matchedCodePoints,
			parsedCodeUnits: match.matchedCodeUnits
		}
	} else {
		return
	}
}

function parseUnicodeNonLatinEscape(s: string, codeUnitsIndex: number): ParseResult | undefined {
	const basic = parseUnicodeBasicEscape(s, codeUnitsIndex)
	if (basic !== undefined) return basic
	const full = parseUnicodeFullEscape(s, codeUnitsIndex)
	if (full !== undefined) return full
	return
}

function parseUnicodeLatinEscape(s: string, codeUnitsIndex: number): ParseResult | undefined {
	const match = matchUnicode(UnicodeLatinEscape, s, codeUnitsIndex)
	if (match !== undefined) {
		return {
			codePoint: String.fromCodePoint(match.code),
			parsedCodePoints: match.matchedCodePoints,
			parsedCodeUnits: match.matchedCodeUnits
		}
	} else {
		return
	}
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
					const parsed = parseUnicodeNonLatinEscape(s, codeUnitsIndex)
					if (parsed !== undefined) {
						result += parsed.codePoint
						codePointsIndex += parsed.parsedCodePoints
						codeUnitsIndex += parsed.parsedCodeUnits
						break
					} else {
						throw new SyntaxError('Invalid Unicode escape sequence')
					}
				}
				case 'x': {
					const parsed = parseUnicodeLatinEscape(s, codeUnitsIndex)
					if (parsed !== undefined) {
						result += parsed.codePoint
						codePointsIndex += parsed.parsedCodePoints
						codeUnitsIndex += parsed.parsedCodeUnits
						break
					} else {
						throw new SyntaxError('Invalid Unicode escape sequence')
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

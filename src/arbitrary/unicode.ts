// TODO: Test these exports.

const UnicodeShortEscape = /\\u([0-9a-fA-F]{4})/y
const UnicodeLongEscape = /\\u\{([0-9a-fA-F]{1,6})\}/y
const HexEscape = /\\x([0-9a-fA-F]{2})/y

interface EscapeMatch {
	match: string
	codePoint: number
}

/**
 * Parses a code point from a hexadecimal string to an integer.
 */
export function parseCodePoint(hexDigits: string): number {
	return Number.parseInt(hexDigits, 16)
}

function matchEscape(regexp: RegExp, str: string, position: number): EscapeMatch | undefined {
	regexp.lastIndex = position
	const match = regexp.exec(str)
	if (match !== null) {
		const codePoint = parseCodePoint(match[1])
		return { match: match[0], codePoint: codePoint }
	} else {
		return
	}
}

function matchUnicodeEscape(str: string, position: number): EscapeMatch | undefined {
	return (
		matchEscape(UnicodeShortEscape, str, position) || matchEscape(UnicodeLongEscape, str, position)
	)
}

/**
 * Tests if a code point is a high surrogate.
 *
 * @param codePoint the code point to test
 * @returns `true` iff the code point is a high surrogate
 */
export function isHighSurrogate(codePoint: number): boolean {
	return 0xd800 <= codePoint && codePoint <= 0xdbff
}

/**
 * Tests if a code point is a low surrogate.
 *
 * @param codePoint the code point to test
 * @returns `true` iff the code point is a low surrogate
 */
export function isLowSurrogate(codePoint: number): boolean {
	return 0xdc00 <= codePoint && codePoint <= 0xdfff
}

/**
 * Creates the code point formed by a surrogate pair.
 *
 * @param high the high surrogate
 * @param low the low surrogate
 * @returns the code point of the surrogate pair if the surrogates are a valid surrogate pair,
 *   otherwise it returns the surrogate pairs as code points of the same values
 */
export function fromSurrogatePair(high: number, low: number): string {
	if (isHighSurrogate(high) && isLowSurrogate(low)) {
		return String.fromCodePoint(((high - 0xd800) << 10) + (low - 0xdc00) + 0x010000)
	} else {
		return String.fromCodePoint(high, low)
	}
}

/**
 * The interpreted escape sequence(s).
 */
export interface InterpretedEscape {
	/**
	 * The code units that were matched as part of the interpreted escape sequence(s).
	 */
	match: string
	/**
	 * The resulting code point.
	 */
	codePoint: string
}

/**
 * Interprets the Unicode escape sequence(s) in `str` at the given `position`.
 *
 * If there is no Unicode escape sequence at the given position then return `undefined`.
 *
 * An escape sequence for a code point that is not a high surrogate or a low surrogate is interpreted as that value.
 *
 * An escape sequence for a code point `high` is a high surrogate, followed by an escape sequence for a code point `low`
 * that is a low surrogate, is a surrogate pair and is interpreted as a code point with the value
 * `(high - 0xD800) × 0x400 + (low - 0xDC00) + 0x10000`.
 *
 * An escape sequence for a code point that is a high surrogate or low surrogate, but is not part of a surrogate pair,
 * is interpreted as that value.
 *
 * Syntax:
 *
 * ```
 * UnicodeEscapeSequence ::
 *       u Hex4Digits
 *       u{ CodePoint }
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences
 * @see https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#prod-UnicodeEscapeSequence
 * @param str the string to interpret
 * @param position the index within `str` to match at. defaults to `0`.
 * @returns the interpreted escape sequence(s) or `undefined` if there is no Unicode escape
 *   sequence at `position`.
 */
export function interpretUnicodeEscape(
	str: string,
	position: number = 0
): InterpretedEscape | undefined {
	const high = matchUnicodeEscape(str, position)
	if (high !== undefined) {
		if (isHighSurrogate(high.codePoint)) {
			const low = matchUnicodeEscape(str, position + high.match.length)
			if (low !== undefined && isLowSurrogate(low.codePoint)) {
				return {
					match: high.match + low.match,
					codePoint: fromSurrogatePair(high.codePoint, low.codePoint)
				}
			}
		}
		return {
			match: high.match,
			codePoint: String.fromCodePoint(high.codePoint)
		}
	} else {
		return
	}
}

/**
 * Interprets the Unicode Basic Multilingual Plane (BMP) escape sequence, aka hexadecimal escape
 * sequence in `str` at the given `position`.
 *
 * Syntax:
 *
 * ```
 * HexEscapeSequence ::
 *       x HexDigit HexDigit
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences
 * @see https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#prod-HexEscapeSequence
 * @param str the string to match
 * @param position the index within `str` to match at. defaults to `0`.
 * @returns the interpreted escape sequence(s) or `undefined` if there is no hexadecimal escape
 *   sequence at `position`.
 */
export function interpretHexCodeEscape(
	str: string,
	position: number = 0
): InterpretedEscape | undefined {
	const match = matchEscape(HexEscape, str, position)
	if (match !== undefined) {
		return {
			match: match.match,
			codePoint: String.fromCodePoint(match.codePoint)
		}
	} else {
		return
	}
}

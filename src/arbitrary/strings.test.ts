import { describe, expect, it } from 'vitest'
import fc, { Arbitrary } from 'fast-check'
import { Escape, escapeUnescaped, replaceEscapes } from './strings'
import { constantFromOrElse } from './constantFromOrElse'
import { fromSurrogatePair, isHighSurrogate, isLowSurrogate, parseCodePoint } from './unicode'

function specialString(specials: string[]): Arbitrary<string> {
	return fc.stringOf(
		fc.oneof(
			{ withCrossShrink: true },
			{ arbitrary: fc.char16bits(), weight: 3 },
			{ arbitrary: constantFromOrElse(specials, ''), weight: 1 },
			{ arbitrary: fc.constantFrom('\\'), weight: 1 }
		)
	)
}

const stringWithSpecials: Arbitrary<[string, string[]]> = fc
	.array(fc.string16bits())
	.chain((specials) => specialString(specials).map((s) => [s, specials]))

const constantEscapes = [
	String.raw`\0`,
	String.raw`\'`,
	String.raw`\"`,
	String.raw`\\`,
	String.raw`\n`,
	String.raw`\r`,
	String.raw`\v`,
	String.raw`\t`,
	String.raw`\b`,
	String.raw`\f`
]

const unicodeShortEscape: Arbitrary<string> = fc
	.hexaString({ minLength: 4, maxLength: 4 })
	.map((s) => `\\u${s}`)

function fullUnicodeCodePoints(): Arbitrary<number> {
	return fc.integer({ min: 0, max: 0x10ffff })
}

// TODO: Sometimes pad this out with 0.
const unicodeLongEscape: Arbitrary<string> = fullUnicodeCodePoints().map(
	(code: Number) => `\\u{${code.toString(16)}}`
)

const hexEscape: Arbitrary<string> = fc
	.hexaString({ minLength: 2, maxLength: 2 })
	.map((s) => `\\x{${s}}`)

const escapes: Arbitrary<string> = fc.stringOf(
	fc.oneof(
		{ withCrossShrink: true },
		{ arbitrary: fc.constantFrom(...constantEscapes), weight: constantEscapes.length },
		unicodeShortEscape,
		unicodeLongEscape,
		hexEscape
	)
)

const UnicodeEscapePrefix = /\\u/g
// noinspection RegExpRedundantEscape
const UnicodeEscape = /\\u(([0-9A-Fa-f]{4})|(\{([0-9A-Fa-f]{1,6})\}))/g

const HexEscapePrefix = /\\x/g
const HexEscape = /\\x([0-9A-Fa-f]{2})/g

function countMatches(s: string, pattern: RegExp): number {
	return (s.match(pattern) || []).length
}

function validUnicodeEscapes(s: string): boolean {
	return (
		countMatches(s, UnicodeEscapePrefix) === countMatches(s, UnicodeEscape) &&
		countMatches(s, HexEscapePrefix) === countMatches(s, HexEscape)
	)
}

const escapedString: Arbitrary<string> = fc
	.stringOf(
		fc.oneof(
			{ withCrossShrink: true },
			{ arbitrary: fc.char16bits(), weight: 3 },
			escapes,
			fc.constantFrom('\\')
		)
	)
	.filter(validUnicodeEscapes)

/**
 * Asserts that all special code points are proceeded by an odd number of escape characters, i.e.
 * they are all escaped.
 *
 * @param escaped the escaped string to check
 * @param specials the special code points that must be escaped
 */
function expectSpecialsToBeEscaped(escaped: string, specials: string[]) {
	const escapeIsSpecial = specials.includes(Escape)
	const escapedCodePoints = Array.from(escaped)
	for (let i = 0; i < escapedCodePoints.length; i++) {
		const currentCodePoint = escapedCodePoints[i]
		if (specials.includes(currentCodePoint)) {
			let j = i - 1
			let preceedingEscapeCount = 0
			while (j >= 0) {
				const previousCodePoint = escapedCodePoints[j]
				if (previousCodePoint === '\\') {
					preceedingEscapeCount++
				} else {
					break
				}
				j--
			}
			if (escapeIsSpecial && currentCodePoint === Escape && preceedingEscapeCount === 0) {
				const nextCodePoint = escapedCodePoints[i + 1]
				expect(specials).toContain(nextCodePoint)
			} else {
				expect(preceedingEscapeCount % 2).toBe(1)
			}
		}
	}
}

/**
 * Asserts that the only difference between the original and escaped string are non-sequential
 * inserts of the escape which proceed a special code point.
 *
 * @param original the original string that was escaped
 * @param escaped the escaped string to check
 * @param specials the special code points that must be escaped
 */
function expectToBeOriginalWithAddedEscapes(original: string, escaped: string, specials: string[]) {
	const escapeIsSpecial = specials.includes(Escape)
	const originalCodePoints = Array.from(original)
	const escapedCodePoints = Array.from(escaped)
	let escapedIndex = 0
	let originalIndex = 0
	while (escapedIndex < escapedCodePoints.length && originalIndex < originalCodePoints.length) {
		const escapedCodePoint = escapedCodePoints[escapedIndex]
		const originalCodePoint = originalCodePoints[originalIndex]
		if (escapeIsSpecial && originalCodePoint === Escape) {
			expect(escapedCodePoint).toBe('\\')
			const nextEscapedCodePoint = escapedCodePoints[escapedIndex + 1]
			expect(nextEscapedCodePoint).toBe('\\')
			originalIndex++
			if (originalCodePoints[originalIndex] === Escape) {
				// Escape was already escaped in the original so skip that.
				originalIndex++
			}
			escapedIndex += 2
		} else if (escapedCodePoint === originalCodePoint) {
			originalIndex++
			escapedIndex++
		} else {
			expect(escapedCodePoint).toBe('\\')
			expect(specials).toContain(originalCodePoint)
			escapedIndex++
		}
	}
	if (escapeIsSpecial && escapedIndex === escapedCodePoints.length - 1) {
		expect(escapedCodePoints[escapedIndex] === Escape)
	} else {
		expect(escapedIndex).toBe(escapedCodePoints.length)
	}
	expect(originalIndex).toBe(originalCodePoints.length)
}

/**
 * This works by ensuring that all special code points are escaped and that the only difference
 * between the original and escaped are non-sequential escape inserts that proceed a special code
 * point.
 */
describe('escapeUnescaped', () => {
	it('unescaped escape is escaped', () => {
		const original = '\\'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\')
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('leading unescaped escape is escaped', () => {
		const original = '\\a'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\a')
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('escaped escape is not escaped again', () => {
		const original = '\\\\'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\')
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('unescaped quote is escaped', () => {
		const original = "'"
		const specials = ["'"]
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe("\\'")
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('multiple unescaped quotes are escaped', () => {
		const original = "\\\\'"
		const specials = ["'"]
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe("\\\\\\'")
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('every code point is escaped', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([s, specials]) => {
				const escaped = escapeUnescaped(s, specials)
				expectSpecialsToBeEscaped(escaped, specials)
			})
		)
	})
	it('only adds escape characters before specials', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([original, specials]) => {
				const escaped = escapeUnescaped(original, specials)
				expectToBeOriginalWithAddedEscapes(original, escaped, specials)
			})
		)
	})
	it('escaping something once is the same as twice', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([original, specials]) => {
				const once = escapeUnescaped(original, specials)
				const twice = escapeUnescaped(once, specials)
				return once === twice
			})
		)
	})
})

// TODO: Can we get away without duplicating this?
const SpecialSubstitutions: Record<string, string> = {
	'0': '\0',
	n: '\n',
	r: '\r',
	v: '\v',
	t: '\t',
	b: '\b',
	f: '\f'
}

function parseUnicodeEscape(
	codePoints: string[],
	index: number,
	checkSurrogatePair: boolean = true
): { substitution: string; nextIndex: number; codePoint?: number } | undefined {
	function parseMaybeNextSurrogate(codePoint: number, index: number) {
		if (checkSurrogatePair && isHighSurrogate(codePoint) && codePoints[index] === Escape) {
			const nextIndex = index + 1
			const result = parseUnicodeEscape(codePoints, nextIndex, false)
			if (result?.codePoint !== undefined && isLowSurrogate(result.codePoint)) {
				const substitution = fromSurrogatePair(codePoint, result.codePoint)
				return { substitution, nextIndex: result.nextIndex }
			}
		}
		const substitution = String.fromCodePoint(codePoint)
		return { substitution, nextIndex: index, codePoint }
	}

	const firstCodePoint = codePoints[index]
	if (firstCodePoint === 'u') {
		const secondIndex = index + 1
		const secondCodePoint = codePoints[secondIndex]
		if (secondCodePoint === '{') {
			const afterOpeningBraceIndex = secondIndex + 1
			const closingBraceIndex = codePoints.indexOf('}', afterOpeningBraceIndex)
			expect(closingBraceIndex).toBeDefined()
			const digitCount = closingBraceIndex - afterOpeningBraceIndex
			expect(digitCount).toBeGreaterThanOrEqual(1)
			expect(digitCount).toBeLessThanOrEqual(6)
			const digits = codePoints.slice(afterOpeningBraceIndex, closingBraceIndex).join('')
			const codePoint = parseCodePoint(digits)
			const afterClosingBraceIndex = closingBraceIndex + 1
			return parseMaybeNextSurrogate(codePoint, afterClosingBraceIndex)
		} else {
			const digits = codePoints.slice(index + 1, index + 5).join('')
			expect(digits).toHaveLength(4)
			const codePoint = parseCodePoint(digits)
			const nextIndex = index + 5
			return parseMaybeNextSurrogate(codePoint, nextIndex)
		}
	} else {
		return
	}
}

function parseEscape(
	originalCodePoints: string[],
	index: number
): { substitution: string; nextIndex: number } {
	const nextOriginalCodePoint = originalCodePoints[index]
	const substitution = SpecialSubstitutions[nextOriginalCodePoint]
	if (substitution !== undefined) {
		return { substitution, nextIndex: index + 1 }
	} else {
		const result = parseUnicodeEscape(originalCodePoints, index)
		if (result !== undefined) {
			return result
		} else if (nextOriginalCodePoint === 'x') {
			const digits = originalCodePoints.slice(index + 1, index + 3).join('')
			const codePoint = parseCodePoint(digits)
			const substitution = String.fromCodePoint(codePoint)
			return { substitution, nextIndex: index + 3 }
		} else {
			return { substitution: nextOriginalCodePoint, nextIndex: index + 1 }
		}
	}
}

/**
 * Asserts that every escape sequence is substituted with its corresponding replacement and that the
 * only difference between the original and replaced are those substitutions.
 *
 * @param original the original string that was replaced
 * @param replaced the replaced string to check
 */
function expectToBeOriginalReplaced(original: string, replaced: string) {
	const originalCodePoints = Array.from(original)
	const replacedCodePoints = Array.from(replaced)
	let replacedIndex = 0
	let originalIndex = 0
	while (replacedIndex < replacedCodePoints.length && originalIndex < originalCodePoints.length) {
		const replacedCodePoint = replacedCodePoints[replacedIndex]
		const originalCodePoint = originalCodePoints[originalIndex]
		if (originalCodePoint === Escape) {
			const result = parseEscape(originalCodePoints, originalIndex + 1)
			expect(replacedCodePoint).toBe(result.substitution)
			originalIndex = result.nextIndex
			replacedIndex++
		} else {
			expect(replacedCodePoint).toBe(originalCodePoint)
			originalIndex++
			replacedIndex++
		}
	}
	if (originalIndex === originalCodePoints.length - 1) {
		expect(originalCodePoints[originalIndex]).toBe(Escape)
		expect(replacedIndex).toBe(replacedCodePoints.length)
	} else {
		expect(originalIndex).toBe(originalCodePoints.length)
		expect(replacedIndex).toBe(replacedCodePoints.length)
	}
}

/**
 * This works by ensuring that every escape sequence is substituted with its corresponding
 * replacement and that the only difference between the original and replaced are those
 * substitutions.
 */
describe('replaceEscapes', () => {
	it('empty is empty', () => {
		const original = ''
		const replaced = replaceEscapes(original)
		expect(replaced).toBe(original)
		expectToBeOriginalReplaced(original, replaced)
	})
	it('escaped specials are replaced', () => {
		Object.entries(SpecialSubstitutions).forEach(([special, substitution]) => {
			const original = `\\${special}`
			const replaced = replaceEscapes(original)
			expect(replaced).toBe(substitution)
			expectToBeOriginalReplaced(original, replaced)
		})
	})
	it('unescaped escape is removed', () => {
		const original = '\\'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('escaped escape is replaced', () => {
		const original = '\\\\'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\\')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('escaped non-escapable is unescaped', () => {
		const original = '\\a'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('a')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('short unicode escape is replaced', () => {
		const original = '\\u0000'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\0')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('unicode with short unicode escape is replaced', () => {
		const original = '𐀀\\u0000'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('𐀀\0')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('invalid short unicode escape throws', () => {
		const original = '\\u001'
		expect(() => replaceEscapes(original)).toThrowError(
			new SyntaxError('Invalid Unicode escape sequence')
		)
	})
	it('partial long unicode escape is replaced', () => {
		const original = '\\u{0}'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\0')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('unicode long escape is replaced', () => {
		const original = '\\u{000000}'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\0')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('invalid long unicode escape throws', () => {
		const original = '\\u{1234567}'
		expect(() => replaceEscapes(original)).toThrowError(
			new SyntaxError('Invalid Unicode escape sequence')
		)
	})
	it('hex escape is replaced', () => {
		const original = '\\x00'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\0')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('invalid hex escape throws', () => {
		const original = '\\x1'
		expect(() => replaceEscapes(original)).toThrowError(
			new SyntaxError('Invalid hexadecimal escape sequence')
		)
	})
	it('basic surrogate pair is replaced', () => {
		const original = '\\ud83d\\udca9'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('💩')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('full surrogate pair is replaced', () => {
		const original = '\\u{d83d}\\u{dca9}'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('💩')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('isolated high surrogate is replaced', () => {
		const original = '\\ud83d\\u{d8}'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\ud83d\u{d8}')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('isolated low surrogate is replaced', () => {
		const original = '\\u{d8}\\udca9'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('\u{d8}\udca9')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('replaces every escape', () => {
		fc.assert(
			fc.property(escapedString, (original) => {
				const replaced = replaceEscapes(original)
				expectToBeOriginalReplaced(original, replaced)
			})
		)
	})
})

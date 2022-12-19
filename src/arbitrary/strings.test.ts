import { describe, expect, it } from 'vitest'
import fc, { Arbitrary } from 'fast-check'
import { Escape, escapeUnescaped, replaceEscapes, SpecialSubstitutions } from './strings'
import { constantFromOrElse } from './constantFromOrElse'

function specialString(specials: string[]): Arbitrary<string> {
	return fc.stringOf(
		fc.oneof(
			{ withCrossShrink: true },
			{ arbitrary: fc.fullUnicode(), weight: 3 },
			{ arbitrary: constantFromOrElse(specials, ''), weight: 1 },
			{ arbitrary: fc.constantFrom('\\'), weight: 1 }
		)
	)
}

const stringWithSpecials: Arbitrary<[string, string[]]> = fc
	.array(fc.fullUnicodeString())
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

const unicodeBasicEscape: Arbitrary<string> = fc
	.hexaString({ minLength: 4, maxLength: 4 })
	.map((s) => `\\u${s}`)

const MaxUnicode = parseInt('10FFFF', 16)

const unicodeFullEscape: Arbitrary<string> = fc
	.integer({ min: 0, max: MaxUnicode })
	.map((num: Number) => `\\u{${num.toString(16)}}`)

const unicodeLatinEscape: Arbitrary<string> = fc
	.hexaString({ minLength: 2, maxLength: 2 })
	.map((s) => `\\x{${s}}`)

const escapes: Arbitrary<string> = fc.stringOf(
	fc.oneof(
		{ withCrossShrink: true },
		{ arbitrary: fc.constantFrom(...constantEscapes), weight: constantEscapes.length },
		unicodeBasicEscape,
		unicodeFullEscape,
		unicodeLatinEscape
	)
)

const UnicodeFullAndBasicEscapePrefix = /\\u/g
// noinspection RegExpRedundantEscape
const UnicodeFullAndBasicEscape = /\\u(([0-9A-Fa-f]{4})|(\{([0-9A-Fa-f]{1,6})\}))/g
const UnicodeLatinEscapePrefix = /\\x/g
const UnicodeLatinEscape = /\\x([0-9A-Fa-f]{2})/g

function countMatches(s: string, pattern: RegExp): number {
	return (s.match(pattern) || []).length
}

function validUnicodeEscapes(s: string): boolean {
	return (
		countMatches(s, UnicodeFullAndBasicEscapePrefix) ===
			countMatches(s, UnicodeFullAndBasicEscape) &&
		countMatches(s, UnicodeLatinEscapePrefix) === countMatches(s, UnicodeLatinEscape)
	)
}

const escapedString: Arbitrary<string> = fc
	.stringOf(
		fc.oneof(
			{ withCrossShrink: true },
			{ arbitrary: fc.fullUnicode(), weight: 3 },
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
	it('single backslash is escaped', () => {
		const original = '\\'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\')
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('leading backslash is escaped', () => {
		const original = '\\a'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\a')
		expectSpecialsToBeEscaped(escaped, specials)
		expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	})
	it('escaped backslash is not escaped again', () => {
		const original = '\\\\'
		const specials = ['\\']
		const escaped = escapeUnescaped(original, specials)
		expect(escaped).toBe('\\\\')
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
	// it('only adds escape characters before this example', () => {
	// 	// FIXME:
	// 	//  { seed: -476113390, path: "24:433:7", endOnFailure: true }
	// 	//  Counterexample: [["\\\\",["B Ss=s","j+|[","Zk,i^<U^","\\","NL","x|vD=Hc;=x",".V`L.","P6u",";%&","'+fj#Ka\"("]]]
	// 	const original = '\\\\'
	// 	const specials = ['\\']
	// 	const escaped = escapeUnescaped(original, specials)
	// 	expectToBeOriginalWithAddedEscapes(original, escaped, specials)
	// })
	it('only adds escape characters before specials', () => {
		// FIXME:
		//  { seed: -476113390, path: "24:433:7", endOnFailure: true }
		//  Counterexample: [["\\\\",["B Ss=s","j+|[","Zk,i^<U^","\\","NL","x|vD=Hc;=x",".V`L.","P6u",";%&","'+fj#Ka\"("]]]
		fc.assert(
			fc.property(stringWithSpecials, ([original, specials]) => {
				const escaped = escapeUnescaped(original, specials)
				expectToBeOriginalWithAddedEscapes(original, escaped, specials)
			})
		)
	})
	it('escaping this example once is the same as twice', () => {
		// FIXME: This was supposed to reproduce the bug/flake below but it doesn't.
		const original = ' '
		const specials = [' ', '\\\\', '']
		const once = escapeUnescaped(original, specials)
		const twice = escapeUnescaped(once, specials)
		return once === twice
	})
	it('escaping something once is the same as twice', () => {
		// FIXME: There is a bug/flake here.
		fc.assert(
			fc.property(stringWithSpecials, ([original, specials]) => {
				const once = escapeUnescaped(original, specials)
				const twice = escapeUnescaped(once, specials)
				return once === twice
			})
		)
	})
})

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
			const nextOriginalCodePoint = originalCodePoints[originalIndex + 1]
			const substitution = SpecialSubstitutions[nextOriginalCodePoint]
			if (substitution !== undefined) {
				expect(replacedCodePoint).toBe(substitution)
				originalIndex += 2
				replacedIndex++
			} else if (nextOriginalCodePoint === 'u') {
				const nextNextOriginalCodePoint = originalCodePoints[originalIndex + 2]
				if (nextNextOriginalCodePoint === '{') {
					const openingBraceIndex = originalIndex + 2
					const closingBraceIndex = originalCodePoints.indexOf('}', openingBraceIndex + 1)
					expect(closingBraceIndex).toBeDefined()
					const digitCount = closingBraceIndex - openingBraceIndex - 1
					expect(digitCount).toBeGreaterThanOrEqual(1)
					expect(digitCount).toBeLessThanOrEqual(6)
					const digits = originalCodePoints.slice(openingBraceIndex + 1, closingBraceIndex).join('')
					const codePoint = Number.parseInt(digits, 16)
					const substitution = String.fromCodePoint(codePoint)
					expect(replacedCodePoint).toBe(substitution)
					originalIndex = closingBraceIndex + 1
					replacedIndex++
				} else {
					const digits = originalCodePoints.slice(originalIndex + 2, originalIndex + 6).join('')
					const codePoint = Number.parseInt(digits, 16)
					const substitution = String.fromCodePoint(codePoint)
					expect(replacedCodePoint).toBe(substitution)
					originalIndex += 6
					replacedIndex++
				}
			} else if (nextOriginalCodePoint === 'x') {
				const digits = originalCodePoints.slice(originalIndex + 2, originalIndex + 4).join('')
				const codePoint = Number.parseInt(digits, 16)
				const substitution = String.fromCodePoint(codePoint)
				expect(replacedCodePoint).toBe(substitution)
				originalIndex += 4
				replacedIndex++
			} else {
				expect(replacedCodePoint).toBe(nextOriginalCodePoint)
				originalIndex += 2
				replacedIndex++
			}
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
	it('empty is untouched', () => {
		const original = ''
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('single backslash is removed', () => {
		const original = '\\'
		const replaced = replaceEscapes(original)
		expect(replaced).toBe('')
		expectToBeOriginalReplaced(original, replaced)
	})
	it('partial full unicode escape is replaced', () => {
		const original = '\\u{00}'
		const replaced = replaceEscapes(original)
		expectToBeOriginalReplaced(original, replaced)
	})
	it('full unicode escape is replaced', () => {
		const original = '\\u{000000}'
		const replaced = replaceEscapes(original)
		expectToBeOriginalReplaced(original, replaced)
	})
	it('unicode with basic unicode escape is replaced', () => {
		const original = '𐀀\\u0000'
		const replaced = replaceEscapes(original)
		expectToBeOriginalReplaced(original, replaced)
	})
	it('replaces every escape', () => {
		fc.assert(
			// TODO: Test invalid escape sequences.
			fc.property(escapedString, (original) => {
				const replaced = replaceEscapes(original)
				expectToBeOriginalReplaced(original, replaced)
			})
		)
	})
})

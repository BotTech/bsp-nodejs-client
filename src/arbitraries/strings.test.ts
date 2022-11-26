import { describe, expect, it } from 'vitest'
import fc, { Arbitrary } from 'fast-check'
import { Escape, escapeUnescaped } from './strings'
import { constantFromOrElse } from './constantFromOrElse'

const stringWithSpecials: Arbitrary<[string, string[]]> = fc
	.array(fc.string())
	.chain((specials) =>
		fc
			.stringOf(
				fc.oneof(
					{ withCrossShrink: true },
					{ arbitrary: fc.char(), weight: 3 },
					{ arbitrary: constantFromOrElse(specials, ''), weight: 1 },
					{ arbitrary: fc.constantFrom('\\'), weight: 1 }
				)
			)
			.map((s) => [s, specials])
	)

function expectToBeEscaped(s: string, specials: string[]) {
	const escapeIsSpecial = specials.includes(Escape)
	const escaped = escapeUnescaped(s, specials)
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

describe('escapeUnescaped', () => {
	it('only adds escape characters before code points to be escaped', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([s, specials]) => {
				const escaped = escapeUnescaped(s, specials)
				const originalCodePoints = Array.from(s)
				const escapedCodePoints = Array.from(escaped)
				let escapedIndex = 0
				let originalIndex = 0
				while (
					escapedIndex < escapedCodePoints.length &&
					originalIndex < originalCodePoints.length
				) {
					const escapedCodePoint = escapedCodePoints[escapedIndex]
					const originalCodePoint = originalCodePoints[originalIndex]
					if (escapedCodePoint === originalCodePoint) {
						originalIndex++
						escapedIndex++
					} else {
						expect(escapedCodePoint).toBe('\\')
						expect(specials).toContain(originalCodePoint)
						escapedIndex++
					}
				}
				expect(escapedIndex).toBe(escapedCodePoints.length)
				expect(originalIndex).toBe(originalCodePoints.length)
			})
		)
	})
	it('single backslash is escaped', () => {
		expectToBeEscaped('\\', ['\\'])
	})
	it('leading backslash is escaped', () => {
		expectToBeEscaped('\\a', ['\\'])
	})
	it('every code point is escaped', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([s, specials]) => {
				expectToBeEscaped(s, specials)
			})
		)
	})
	it('escaping something once is the same as twice', () => {
		fc.assert(
			fc.property(stringWithSpecials, ([s, specials]) => {
				const once = escapeUnescaped(s, specials)
				const twice = escapeUnescaped(once, specials)
				return once === twice
			})
		)
	})
})

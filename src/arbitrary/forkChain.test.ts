import { describe, expect, it, vi } from 'vitest'
import fc, { Random } from 'fast-check'
import { forkChain } from './forkChain'
import prand from 'pure-rand'

describe('forkChain', () => {
	it.skipIf(process.env.PROPERTY_BASED_TESTS === 'off')(
		'returns the generated values from the given generators',
		() => {
			fc.assert(
				fc.property(fc.double(), (seed) => {
					const bias = undefined
					const generator = prand.mersenne(seed)
					const expectedRandom = new Random(generator)
					const actualRandom = new Random(generator)
					const arbA = fc.anything()
					const arbAValue = arbA.generate(expectedRandom, bias).value
					const arbB = fc.anything()
					const arbBValue = arbB.generate(expectedRandom, bias).value
					const resultArb = forkChain(arbA, () => arbB)
					const resultValue = resultArb.generate(actualRandom, bias).value
					expect(resultValue).toEqual([arbAValue, arbBValue])
				})
			)
		}
	)
	it.skipIf(process.env.PROPERTY_BASED_TESTS === 'off')(
		'calls the chainer with the value from the first generator',
		() => {
			fc.assert(
				fc.property(fc.double(), (seed) => {
					const bias = undefined
					const generator = prand.mersenne(seed)
					const actualRandom = new Random(generator)
					const arbA = fc.anything()
					const arbB = fc.anything()
					const chainer = vi.fn((_: unknown) => arbB)
					const resultArb = forkChain(arbA, chainer)
					resultArb.generate(actualRandom, bias).value
					expect(chainer).toHaveBeenCalledOnce()
				})
			)
		}
	)
})

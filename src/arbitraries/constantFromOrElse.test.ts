import { describe, expect, it } from 'vitest'
import fc, { Arbitrary } from 'fast-check'
import { constantFromOrElse } from './constantFromOrElse'

function forkChain<A, B>(arbA: Arbitrary<A>, chainer: (a: A) => Arbitrary<B>): Arbitrary<[A, B]> {
	return arbA.chain((a) => chainer(a).map((b) => [a, b]))
}

describe('constantFromOrElse', () => {
	it('uses orElse when values is empty', () => {
		fc.assert(
			fc.property(
				forkChain(fc.anything(), (thing) => constantFromOrElse([], thing)),
				([thing, constant]) => {
					expect(constant).toBe(thing)
				}
			)
		)
	})
	it('values when they are non-empty', () => {
		fc.assert(
			fc.property(
				forkChain(
					fc.tuple(fc.array(fc.anything(), { minLength: 1 }), fc.anything()),
					([things, thing]) => constantFromOrElse(things, thing)
				),
				([[things], constant]) => {
					expect(things).toContain(constant)
				}
			)
		)
	})
})

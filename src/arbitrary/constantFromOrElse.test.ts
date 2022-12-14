import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { constantFromOrElse } from './constantFromOrElse'
import { forkChain } from './forkChain'

describe('constantFromOrElse', () => {
	it.skipIf(process.env.PROPERTY_BASED_TESTS === 'off')('uses orElse when values is empty', () => {
		fc.assert(
			fc.property(
				forkChain(fc.anything(), (thing) => constantFromOrElse([], thing)),
				([thing, constant]) => {
					expect(constant).toBe(thing)
				}
			)
		)
	})
	it.skipIf(process.env.PROPERTY_BASED_TESTS === 'off')('values when they are non-empty', () => {
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

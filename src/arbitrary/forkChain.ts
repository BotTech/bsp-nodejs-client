import { Arbitrary } from 'fast-check'

export function forkChain<A, B>(
	arbA: Arbitrary<A>,
	chainer: (a: A) => Arbitrary<B>
): Arbitrary<[A, B]> {
	return arbA.chain((a) => chainer(a).map((b) => [a, b]))
}

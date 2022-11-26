import fc from 'fast-check'
import { Arbitrary } from 'fast-check'

export function constantFromOrElse<A>(values: A[], orElse: A): Arbitrary<A> {
	return values.length === 0 ? fc.constant(orElse) : fc.constantFrom(...values)
}

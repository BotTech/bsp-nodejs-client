import { describe, expect, it } from 'vitest';
import { discover } from './discover';

describe('discover', () => {
	it('finds connection details in workspace', () => {
		expect(discover(__dirname)).toBe({});
	});
});

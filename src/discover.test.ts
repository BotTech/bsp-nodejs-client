import { beforeEach, describe, expect, it, vi } from 'vitest';

import connectionDetails from './test-data/connection-details';

vi.mock('fs');
vi.mock('fs/promises');

describe('discoverConnectionDetails', () => {
	beforeEach(() => {
		// We have to use dynamic imports and reset the module between each test
		// in order to get a new volume for each test.
		vi.resetModules();
	});

	it('finds connection details in workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover');
		const result = await discoverConnectionDetails('/workspace');
		expect(result).toStrictEqual([connectionDetails]);
	});

	it('finds connection details in parent workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover');
		const result = await discoverConnectionDetails('/parent/workspace');
		expect(result).toStrictEqual([connectionDetails]);
	});

	it('finds nothing in empty workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover');
		const result = await discoverConnectionDetails('/empty');
		expect(result).to.be.empty;
	});

	it('finds nothing in missing workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover');
		const result = await discoverConnectionDetails('/missing');
		expect(result).to.be.empty;
	});

	it('finds nothing if details are invalid', async () => {
		const { discoverConnectionDetails } = await import('./discover');
		const result = await discoverConnectionDetails('/invalid');
		expect(result).to.be.empty;
	});
});

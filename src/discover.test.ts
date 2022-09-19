import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import processActual from 'process'

import createPromisesApi from 'memfs/lib/promises'
import { NestedDirectoryJSON } from 'memfs/lib/volume'
import { DirectoryJSON, Volume } from 'memfs'

import connectionDetails from './test-data/connection-details'
const connectionDetailsString = JSON.stringify(connectionDetails)
const bspDir: DirectoryJSON = {
	'sbt.json': connectionDetailsString
}

vi.mock('fs/promises', () => {
	return {
		default: createPromisesApi(Volume.fromNestedJSON({}))
	}
})

describe('discoverConnectionDetails', () => {
	beforeEach(() => {
		// We have to use dynamic imports and reset the module between each test
		// in order to get a new volume for each test.
		vi.resetModules()
	})

	afterEach(() => {
		// Anything mocked with doMock seems to also need to be explicitly unmocked.
		vi.doUnmock('fs/promises')
		vi.doUnmock('process')
	})

	it('finds connection details in working directory', async () => {
		vi.doMock('fs/promises', () => {
			const json: NestedDirectoryJSON = {}
			json[__dirname] = {
				'.bsp': bspDir
			}
			return {
				default: createPromisesApi(Volume.fromNestedJSON(json))
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails()

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds connection details in workspace', async () => {
		vi.doMock('fs/promises', () => {
			return {
				default: createPromisesApi(
					Volume.fromNestedJSON({
						'/workspace': {
							'.bsp': bspDir
						}
					})
				)
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/workspace')

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds connection details in parent workspace', async () => {
		vi.doMock('fs/promises', () => {
			return {
				default: createPromisesApi(
					Volume.fromNestedJSON({
						'/parent': {
							'.bsp': bspDir,
							workspace: {}
						}
					})
				)
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/parent/workspace')

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds nothing in an empty workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/empty')

		expect(result).to.be.empty
	})

	it('finds nothing in a missing workspace', async () => {
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/missing')

		expect(result).to.be.empty
	})

	it('finds nothing if workspace details are invalid', async () => {
		vi.doMock('fs/promises', () => {
			return {
				default: createPromisesApi(
					Volume.fromNestedJSON({
						'/workspace': {
							'.bsp': {
								borked: '{}'
							}
						}
					})
				)
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/invalid')

		// TODO: Assert that there is some kind of warning here.
		expect(result).to.be.empty
	})

	it('finds connection details in local app data on Windows', async () => {
		vi.doMock('process', async () => {
			const actual = await vi.importActual<typeof processActual>('process')
			return {
				default: {
					...actual,
					platform: 'win32',
					env: {
						LOCALAPPDATA: 'todo'
					}
				} as typeof processActual
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/invalid')

		expect(result).to.be.empty
	})
})

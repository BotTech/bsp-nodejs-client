import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import processActual from 'process'
import path from 'path'

import { NestedDirectoryJSON } from '@bottech/memfs/lib/types/volume'

import sampleConnectionDetails from './test-data/connection-details'
import { BspConnectionDetails } from './bsp'

type Process = typeof processActual

function generateConnectionDetails() {
	return { ...sampleConnectionDetails, random: Math.random() }
}

function bspDir(details: BspConnectionDetails) {
	return {
		'sbt.json': JSON.stringify(details)
	}
}

// Make sure to prefix this with node: otherwise vitest thinks we are trying to mock the external
// process module.
const PROCESS_PATH = 'node:process'

function mockProcess(mock: Partial<Process>) {
	vi.doMock(PROCESS_PATH, async () => {
		const actual = await vi.importActual<Process>('process')
		return {
			default: {
				...actual,
				...mock
			} as Process
		}
	})
}

const PATH_PATH = 'path'

function mockPath(platformPath: typeof path) {
	vi.doMock(PATH_PATH, () => {
		return {
			...platformPath,
			default: platformPath
		}
	})
}

const FS_PROMISES_PATH = 'fs/promises'

function mockFs(json: NestedDirectoryJSON) {
	// We need to do this as a dynamic import so that it picks up things from
	// other mocks such as the platform.
	vi.doMock(FS_PROMISES_PATH, async () => {
		// NOTE: Inline this dependency in vitest config otherwise transitive dependencies will not work.
		const { Volume } = await import('@bottech/memfs')
		// FIXME: How do we get it to find these types?
		// @ts-ignore
		const createPromisesApi = (await import('@bottech/memfs/promises')).default
		return {
			default: createPromisesApi(Volume.fromNestedJSON(json))
		}
	})
}

describe('discoverConnectionDetails', () => {
	beforeEach(() => {
		// We have to use dynamic imports and reset the module between each test
		// in order to get a new volume for each test.
		vi.resetModules()
	})

	afterEach(() => {
		// Anything mocked with doMock seems to also need to be explicitly unmocked.
		vi.doUnmock(PROCESS_PATH)
		vi.doUnmock(PATH_PATH)
		vi.doUnmock(FS_PROMISES_PATH)
	})

	it('finds connection details in working directory', async () => {
		const connectionDetails = generateConnectionDetails()
		mockFs({
			[__dirname]: {
				'.bsp': bspDir(connectionDetails)
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails()

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds connection details in workspace', async () => {
		const connectionDetails = generateConnectionDetails()
		mockFs({
			'/workspace': {
				'.bsp': bspDir(connectionDetails)
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/workspace')

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds connection details in parent workspace', async () => {
		const connectionDetails = generateConnectionDetails()
		mockFs({
			'/parent': {
				'.bsp': bspDir(connectionDetails),
				workspace: {}
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/parent/workspace')

		expect(result).toStrictEqual([connectionDetails])
	})

	it('finds nothing in an empty workspace', async () => {
		mockFs({})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/empty')

		expect(result).to.be.empty
	})

	it('finds nothing in a missing workspace', async () => {
		mockFs({})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/missing')

		expect(result).to.be.empty
	})

	it('finds nothing if workspace details are invalid', async () => {
		mockFs({
			'/workspace': {
				'.bsp': {
					borked: '{}'
				}
			}
		})
		const { discoverConnectionDetails } = await import('./discover')

		const result = await discoverConnectionDetails('/invalid')

		// TODO: Assert that there is some kind of warning here.
		expect(result).to.be.empty
	})

	describe('win32', () => {
		beforeEach(() => {
			mockProcess({ platform: 'win32' })
			mockPath(path.win32)
		})

		it('finds connection details in LOCALAPPDATA on Windows', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'win32',
				env: {
					LOCALAPPDATA: 'C:\\Users\\jason\\AppData\\Local'
				}
			})
			mockFs({
				'/Users': {
					jason: {
						AppData: {
							Local: {
								bsp: bspDir(connectionDetails)
							}
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in PROGRAMDATA on Windows', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'win32',
				env: {
					PROGRAMDATA: 'C:\\ProgramData'
				}
			})
			mockFs({
				'/ProgramData': {
					bsp: bspDir(connectionDetails)
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})
	})

	describe('darwin', () => {
		beforeEach(() => {
			mockProcess({ platform: 'darwin' })
			mockPath(path.posix)
		})

		it('finds connection details in XDG_DATA_HOME on Mac', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'darwin',
				env: {
					XDG_DATA_HOME: '/Users/jason/Library'
				}
			})
			mockFs({
				'/Users': {
					jason: {
						Library: {
							bsp: bspDir(connectionDetails)
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in $HOME/.local/share on Mac', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'darwin',
				env: {
					HOME: '/Users/jason'
				}
			})
			mockFs({
				'/Users': {
					jason: {
						'.local': {
							share: {
								bsp: bspDir(connectionDetails)
							}
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in $HOME/Library/Application Support on Mac', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'darwin',
				env: {
					HOME: '/Users/jason'
				}
			})
			mockFs({
				'/Users': {
					jason: {
						Library: {
							'Application Support': {
								bsp: bspDir(connectionDetails)
							}
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in XDG_DATA_DIRS on Mac', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'darwin',
				env: {
					XDG_DATA_DIRS: '/usr/share:/Volumes/data'
				}
			})
			mockFs({
				'/Volumes': {
					data: {
						bsp: bspDir(connectionDetails)
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in /Library/Application Support on Mac', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'darwin'
			})
			mockFs({
				'/Library': {
					'Application Support': {
						bsp: bspDir(connectionDetails)
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})
	})

	describe('linux', () => {
		beforeEach(() => {
			mockProcess({ platform: 'linux' })
			mockPath(path.posix)
		})

		it('finds connection details in XDG_DATA_HOME on Linux', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'linux',
				env: {
					XDG_DATA_HOME: '/home/jason/data'
				}
			})
			mockFs({
				'/home': {
					jason: {
						data: {
							bsp: bspDir(connectionDetails)
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in $HOME/.local/share on Linux', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'linux',
				env: {
					HOME: '/home/jason'
				}
			})
			mockFs({
				'/home': {
					jason: {
						'.local': {
							share: {
								bsp: bspDir(connectionDetails)
							}
						}
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})

		it('finds connection details in XDG_DATA_DIRS on Linux', async () => {
			const connectionDetails = generateConnectionDetails()
			mockProcess({
				platform: 'linux',
				env: {
					XDG_DATA_DIRS: '/usr/share:/media/data'
				}
			})
			mockFs({
				'/media': {
					data: {
						bsp: bspDir(connectionDetails)
					}
				}
			})
			const { discoverConnectionDetails } = await import('./discover')

			const result = await discoverConnectionDetails()

			expect(result).toStrictEqual([connectionDetails])
		})
	})
})

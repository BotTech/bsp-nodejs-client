import { BspConnectionDetails } from './bsp'
import fs from 'fs/promises'
import path from 'path'
import Ajv from 'ajv/dist/jtd'
import BspConnectionDetailsSchema from './schema/bsp-connection-details.jtd.json'
import process from 'process'
import { pino } from 'pino'
import { stripLeading as sl } from './strings'

const logger = pino({ name: 'discover' })

const ajv = new Ajv()
const parseBspConnectionDetails = ajv.compileParser<BspConnectionDetails>(
	BspConnectionDetailsSchema
)

async function parseFile(file: string): Promise<BspConnectionDetails | undefined> {
	return fs.readFile(file, { encoding: 'utf-8' }).then((contents) => {
		const result = parseBspConnectionDetails(contents)
		if (result === undefined) {
			logger.warn(
				{ file },
				sl`Failed to parse BSP connection details: %s
				   This must adhere to the JSON Type Definition in https://github.com/BotTech/bsp-nodejs-client/blob/main/src/schema/bsp-connection-details.jtd.json.`,
				parseBspConnectionDetails.message
			)
		} else {
			logger.debug({ file, result }, 'Parsed BSP connection details.')
		}
		return result
	})
}

async function parseFiles(files: string[]): Promise<BspConnectionDetails[]> {
	return Promise.all(
		files.flatMap((file) =>
			parseFile(file).then((details) => (details === undefined ? [] : [details]))
		)
	).then((details) => details.flat())
}

async function searchBspDir(dir: string): Promise<BspConnectionDetails[]> {
	logger.debug({ dir }, `Searching for BSP connection details`)
	return fs.readdir(dir).then(
		(files) => parseFiles(files.map((file) => path.resolve(dir, file))),
		(error) => {
			if (error.code === 'ENOENT') {
				return []
			}
			throw error
		}
	)
}

async function discoverWorkspaceConnectionDetails(
	baseDir: string
): Promise<BspConnectionDetails[]> {
	const bspDir = path.resolve(baseDir, '.bsp')
	const details = await searchBspDir(bspDir)
	if (details.length > 0) {
		return details
	}
	// We didn't find any so try and search in parent directories in case the
	// workspace is a subproject.
	const parentDir = path.dirname(baseDir)
	// TODO: Check that this works on Windows.
	if (path.basename(parentDir) === '') {
		return []
	}
	return discoverWorkspaceConnectionDetails(parentDir)
}

function isNonEmpty(env?: string): env is string {
	return env !== undefined && env !== ''
}

async function discoverUserConnectionDetails(): Promise<BspConnectionDetails[]> {
	let userDirs = []
	if (process.platform === 'win32') {
		const localAppDataDir = process.env.LOCALAPPDATA
		if (isNonEmpty(localAppDataDir)) {
			userDirs.push(localAppDataDir)
		} else {
			logger.debug('LOCALAPPDATA is not set or is empty.')
		}
	} else {
		// See https://specifications.freedesktop.org/basedir-spec/basedir-spec-0.6.html
		const xdgDataHome = process.env.XDG_DATA_HOME
		const home = process.env.HOME
		if (isNonEmpty(xdgDataHome)) {
			userDirs.push(xdgDataHome)
		} else {
			logger.debug('XDG_DATA_HOME is not set or is empty.')
			if (isNonEmpty(home)) {
				userDirs.push(path.resolve(home, '.local/share'))
				if (process.platform === 'darwin') {
					userDirs.push(path.resolve(home, 'Library/Application Support'))
				}
			} else {
				logger.debug('HOME is not set or is empty.')
			}
		}
	}
	const bspDirs = userDirs.map((dir) => path.resolve(dir, 'bsp'))
	return Promise.all(bspDirs.map(searchBspDir)).then((x) => x.flat())
}

async function discoverSystemConnectionDetails(): Promise<BspConnectionDetails[]> {
	let systemDirs = []
	if (process.platform === 'win32') {
		const programDataDir = process.env.PROGRAMDATA
		if (isNonEmpty(programDataDir)) {
			systemDirs.push(programDataDir)
		} else {
			logger.debug('PROGRAMDATA is not set or is empty.')
		}
	} else {
		// See https://specifications.freedesktop.org/basedir-spec/basedir-spec-0.6.html
		const xdgDataDirs = process.env.XDG_DATA_DIRS
		if (isNonEmpty(xdgDataDirs)) {
			const dirs = xdgDataDirs.split(':').filter((x) => x !== '')
			systemDirs.push(...dirs)
		} else {
			logger.debug('XDG_DATA_DIRS is not set or is empty.')
			systemDirs.push('/usr/local/share', '/usr/share')
		}
		if (process.platform === 'darwin') {
			systemDirs.push('/Library/Application Support')
		}
	}
	const bspDirs = systemDirs.map((dir) => path.resolve(dir, 'bsp'))
	return Promise.all(bspDirs.map(searchBspDir)).then((x) => x.flat())
}

// https://build-server-protocol.github.io/docs/server-discovery.html#default-locations-for-bsp-connection-files
export async function discoverConnectionDetails(
	workspace?: string
): Promise<BspConnectionDetails[]> {
	const workspaceDir = path.resolve(workspace ?? __dirname)
	const workspaceDetails = await discoverWorkspaceConnectionDetails(workspaceDir)
	if (workspaceDetails.length > 0) {
		return workspaceDetails
	}
	const userDetails = await discoverUserConnectionDetails()
	if (userDetails.length > 0) {
		return userDetails
	}
	return discoverSystemConnectionDetails()
}

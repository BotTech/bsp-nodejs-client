import { BspConnectionDetails } from './bsp'
import fs from 'fs/promises'
import path from 'path'
import Ajv from 'ajv/dist/jtd'
import BspConnectionDetailsSchema from './schema/bsp-connection-details.jtd.json'
import process from 'process'

const ajv = new Ajv()
const parseBspConnectionDetails = ajv.compileParser<BspConnectionDetails>(
	BspConnectionDetailsSchema
)

async function parseFile(file: string): Promise<BspConnectionDetails | undefined> {
	return fs.readFile(file, { encoding: 'utf-8' }).then((contents) => {
		const result = parseBspConnectionDetails(contents)
		if (result === undefined) {
			// TODO: Use a logger?
			console.warn(
				`Failed to parse BSP connection details from '${file}': ${parseBspConnectionDetails.message}`
			)
			console.warn(
				'This must adhere to the JSON Type Definition in https://github.com/BotTech/bsp-nodejs-client/blob/main/src/schema/bsp-connection-details.jtd.json'
			)
			console.warn(
				'If there is something going wrong or you want to ignore this warning then please raise an issue and provide the file.'
			)
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
		}
	} else {
		// See https://specifications.freedesktop.org/basedir-spec/basedir-spec-0.6.html
		const xdgDataHome = process.env.XDG_DATA_HOME
		const home = process.env.HOME
		if (isNonEmpty(xdgDataHome)) {
			userDirs.push(xdgDataHome)
		} else if (isNonEmpty(home)) {
			userDirs.push(path.resolve(home, '.local/share'))
			if (process.platform === 'darwin') {
				userDirs.push(path.resolve(home, 'Library/Application Support'))
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
		}
	} else {
		// See https://specifications.freedesktop.org/basedir-spec/basedir-spec-0.6.html
		const xdgDataDirs = process.env.XDG_DATA_DIRS
		if (isNonEmpty(xdgDataDirs)) {
			const dirs = xdgDataDirs.split(':').filter((x) => x !== '')
			systemDirs.push(...dirs)
		} else {
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

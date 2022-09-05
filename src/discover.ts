import { BspConnectionDetails } from './bsp';
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv/dist/jtd';
import BspConnectionDetailsSchema from './schema/bsp-connection-details.jtd.json';

const ajv = new Ajv();
const parseBspConnectionDetails = ajv.compileParser<BspConnectionDetails>(
	BspConnectionDetailsSchema
);

async function parseFile(
	file: string
): Promise<BspConnectionDetails | undefined> {
	return fs.readFile(file, { encoding: 'utf-8' }).then((contents) => {
		const result = parseBspConnectionDetails(contents);
		if (result === undefined) {
			// TODO: Use a logger?
			console.warn(
				`Failed to parse BSP connection details from '${file}': ${parseBspConnectionDetails.message}`
			);
			console.warn(
				'This must adhere to the JSON Type Definition in https://github.com/BotTech/bsp-nodejs-client/blob/main/src/schema/bsp-connection-details.jtd.json'
			);
			console.warn(
				'If there is something going wrong or you want to ignore this warning then please raise an issue and provide the file.'
			);
		}
		return result;
	});
}

async function parseFiles(files: string[]): Promise<BspConnectionDetails[]> {
	return Promise.all(
		files.flatMap((file) =>
			parseFile(file).then((details) =>
				details === undefined ? [] : [details]
			)
		)
	).then((x) => x.flat());
}

export async function discover(
	workspace?: string
): Promise<BspConnectionDetails[]> {
	const baseDir = path.resolve(workspace ?? __dirname);
	const bspDir = path.resolve(baseDir, '.bsp');
	return fs.readdir(bspDir).then(
		(files) => parseFiles(files.map((file) => path.resolve(bspDir, file))),
		(error) => {
			if (error.code === 'ENOENT') {
				const parentDir = path.dirname(baseDir);
				return path.basename(parentDir) === '' ? [] : discover(parentDir);
			}
			throw error;
		}
	);
}

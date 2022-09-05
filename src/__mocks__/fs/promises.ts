import { DirectoryJSON, Volume } from 'memfs';
import createPromisesApi from 'memfs/lib/promises';
import { NestedDirectoryJSON } from 'memfs/lib/volume';

// TODO: Deduplicate this with ../fs.ts.

import connectionDetails from '../../test-data/connection-details';

const connectionDetailsString: string = JSON.stringify(connectionDetails);

const bspDir: DirectoryJSON = {
	'sbt.json': connectionDetailsString,
};

const json: NestedDirectoryJSON = {
	'/parent': {
		'.bsp': bspDir,
		workspace: {},
	},
	'/workspace': {
		'.bsp': bspDir,
	},
	'/empty': {},
	'/invalid': {
		'.bsp': {
			borked: '{}',
		},
	},
};

const fs = createPromisesApi(Volume.fromNestedJSON(json));

export default fs;

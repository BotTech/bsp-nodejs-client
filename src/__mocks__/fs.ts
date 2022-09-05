import { createFsFromVolume, Volume } from 'memfs';
import { NestedDirectoryJSON } from 'memfs/lib/volume';

import connectionDetails from '../test-data/connection-details';

const connectionDetailsString: string = JSON.stringify(connectionDetails);

const bspDir: NestedDirectoryJSON = {
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

const fs = createFsFromVolume(Volume.fromNestedJSON(json));

export default fs;

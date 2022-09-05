import { BspConnectionDetails } from '../bsp';

const connectionDetails: BspConnectionDetails = {
	name: 'sbt',
	version: '1.7.1',
	bspVersion: '2.0.0-M5',
	languages: ['scala'],
	argv: [
		'java',
		'-Xms100m',
		'-Xmx100m',
		'-classpath',
		'/share/sbt/bin/sbt-launch.jar',
		'-Dsbt.script=/bin/sbt',
		'xsbt.boot.Boot',
		'-bsp',
	],
};

export default connectionDetails;

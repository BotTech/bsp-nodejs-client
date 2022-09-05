export interface BspConnectionDetails {
	/** The name of the build tool. */
	name: string;
	/** The version of the build tool. */
	version: string;
	/** The bsp version of the build tool. */
	bspVersion: string;
	/** A collection of languages supported by this BSP server. */
	languages: string[];
	/** Command arguments runnable via system processes to start a BSP server */
	argv: string[];
}

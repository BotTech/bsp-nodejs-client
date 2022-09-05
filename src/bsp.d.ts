export interface BspConnectionDetails {
	/** The name of the build tool. */
	name: String;
	/** The version of the build tool. */
	version: String;
	/** The bsp version of the build tool. */
	bspVersion: String;
	/** A collection of languages supported by this BSP server. */
	languages: String[];
	/** Command arguments runnable via system processes to start a BSP server */
	argv: String[];
}

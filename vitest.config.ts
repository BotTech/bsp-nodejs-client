import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	root: resolve(__dirname, 'src'),
	test: {
		deps: {
			inline: ['@bottech/memfs']
		}
		// Disable when debugging. Can we do this via a CLI option?
		//testTimeout: 0
	}
})

import { readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function cleanBuildOutput(): Plugin {
  return {
    name: 'innvyra-clean-build-output',
    apply: 'build',
    async configResolved({ root, build }) {
      if (!build.write || build.emptyOutDir === false) return
      const output = path.resolve(root, build.outDir)
      if (output !== path.resolve(root, 'dist') && build.emptyOutDir !== true) return

      let resolved: string
      try {
        resolved = await realpath(output)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
      const workspace = await realpath(path.resolve(__dirname, '..'))
      const relative = path.relative(workspace, resolved)
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Build cleanup requires an output directory inside the workspace.')
      }
      if (path.relative(output, resolved) || path.relative(root, resolved) === '') {
        throw new Error('Build output must be a real directory separate from the project root.')
      }
      // Keep deployment metadata, as Vite does when it empties an output directory.
      const entries = await readdir(resolved)
      await Promise.all(entries
        .filter((name) => name !== '.git')
        .map((name) => rm(path.join(resolved, name), { recursive: true, force: true })))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cleanBuildOutput()],
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('@tanstack')) return 'vendor-query';
          }
        },
      },
    },
  },
})

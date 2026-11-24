import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const visualWithoutWorker: Plugin = {
  name: 'visual-without-worker',
  configureServer(server) { server.middlewares.use('/api/visual', unavailable) },
  configurePreviewServer(server) { server.middlewares.use('/api/visual', unavailable) },
}
function unavailable(_request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  response.setHeader('content-type', 'application/json')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify({ state: 'disabled', candidates: [] }))
}

export default defineConfig({
  plugins: [react(), tailwindcss(), visualWithoutWorker],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.{ts,tsx}'] },
})

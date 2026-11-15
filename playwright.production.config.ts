import { defineConfig } from '@playwright/test'
import config from './playwright.config'
export default defineConfig({ ...config, use: { ...config.use, baseURL: 'http://127.0.0.1:44174' }, webServer: { command: 'node node_modules/wrangler/bin/wrangler.js dev --local --ip 127.0.0.1 --port 44174', url: 'http://127.0.0.1:44174', reuseExistingServer: false, timeout: 60000 } })

import { defineConfig } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 1,
  timeout: 30000,
  expect: {
    timeout: 8000,
  },
  outputDir: `test-results${process.env.E2E_SLOT || ''}`,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `playwright-report${process.env.E2E_SLOT || ''}` }],
  ],
  globalSetup: path.resolve(__dirname, 'scripts/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, 'scripts/global-teardown.ts'),
  use: {
    baseURL: `http://127.0.0.1:${5273 + Number(process.env.E2E_SLOT || 0)}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
});

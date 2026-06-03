const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8010',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'python server/app.py --host 127.0.0.1 --port 8010',
    url: 'http://127.0.0.1:8010/api/health',
    env: {
      RESTAURANT_DB_PATH: 'server/.playwright-test.db'
    },
    reuseExistingServer: false,
    timeout: 15_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});

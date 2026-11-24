import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// BASE_URL, TEST_USERNAME and TEST_PASSWORD live in the gitignored env file, not in specs
dotenv.config({ path: '.env/.demo.env' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000, // Measured: QA-101 runs 22–30s on the shared demo and timed out at 30s on chromium and webkit
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com',
    browserName: 'chromium',
    // Headed locally so a run can be watched; CI runners have no display
    headless: !!process.env.CI,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // API specs hit the shared demo through one signed-in session per worker; running a
    // file fully parallel would split it across workers and sign in once per worker
    { name: 'api', testMatch: /API\/.*\.spec\.ts/, fullyParallel: false },
    { name: 'chromium', testMatch: /UI\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // { name: 'firefox', testMatch: /UI\/.*\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', testMatch: /UI\/.*\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
  ],
});

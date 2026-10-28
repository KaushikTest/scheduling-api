import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    expect: { timeout: 5000 },
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 2,
    outputDir: 'test-results',
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 1000 },
        locale: 'en-GB',
        timezoneId: 'Asia/Kolkata',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    // No external baseURL or reused webServer: every test starts its own demo.
});

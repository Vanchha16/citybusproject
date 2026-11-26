import { defineConfig, devices } from '@playwright/test';

// The tests start their OWN API + web server on separate ports with the clock
// fixed at 09:00 Phnom Penh time, so results don't depend on when you run them
// and your `npm run dev` servers are left alone. They use your installed Edge.
const API_PORT = 8797;
const WEB_PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'en-US',
    timezoneId: 'Asia/Phnom_Penh',
    trace: 'retain-on-failure',
  },
  projects: [
    // Android-size phone and a desktop, on your installed Edge (Chromium).
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'msedge' } },
    { name: 'desktop', use: { channel: 'msedge', viewport: { width: 1440, height: 900 } } },
    // iPhone on WebKit, the engine behind Safari (`npx playwright install webkit` once).
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      command: 'node src/index.js',
      cwd: '../server',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), DEMO_CLOCK: '09:00', ANTHROPIC_API_KEY: '', CITYBUS_DATA: 'sample', WALK_ROUTER_URL: '' },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
  ],
});

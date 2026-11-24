// The guided pitch demo, driven like a presentation clicker (arrow keys).
import { test, expect } from '@playwright/test';
import { routeOptions, strings } from './helpers.js';

const en = strings('en');
const km = strings('km');

test('guided demo runs start to finish with the keyboard, and Back replays correctly', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('citybus.lang', 'en'));
  await page.goto('/?demo');
  const bar = page.locator('[data-demo-bar]'); // its label changes language mid-demo
  const caption = (i, s = en) => expect(bar).toContainText(s.demo.steps[i]);
  const next = async () => { await page.keyboard.press('ArrowRight'); };

  // Take control like a presenter: pause auto-play and jump to the first step.
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: en.demo.pause }).click();
  await page.keyboard.press('Home');
  await caption(0);
  await expect(bar).toContainText('1/9');

  await next(); // 2: pick the airport
  await caption(1);
  await expect(page.getByRole('heading', { name: en.linesHere('Techo International Airport') })).toBeVisible();

  await next(); // 3: only airport lines on the map
  await caption(2);
  await expect.poll(() => page.locator('.leaflet-overlay-pane path[stroke-opacity="0.85"]').count()).toBe(2);

  await next(); // 4: best route, step by step
  await caption(3);
  await expect(page.getByText(en.nextBus)).toBeVisible();

  // Back to 3 and forward again: the route list comes back, then the steps.
  await page.keyboard.press('ArrowLeft');
  await caption(2);
  await expect(routeOptions(page).first()).toBeVisible();
  await next();
  await expect(page.getByText(en.nextBus)).toBeVisible();

  await next(); // 5: alert
  await caption(4);
  await expect(page.getByRole('button', { name: en.alertOn })).toHaveAttribute('aria-pressed', 'true');

  await next(); // 6: walk to the stop, map follows
  await caption(5);
  await expect(page.locator('main').getByText(en.following)).toBeVisible();
  await expect(page.getByText(en.nextBus)).toBeVisible({ timeout: 12_000 }); // route stays open while walking
  // Reaching the stop shows the next buses there, with the passenger's bus first.
  const atStop = page.locator('section[aria-labelledby="atstop-h"]');
  await expect(atStop.locator('[data-your-bus]')).toBeVisible({ timeout: 12_000 });

  await next(); // 7: Khmer
  await caption(6, km);
  await expect(page.locator('html')).toHaveAttribute('lang', 'km');

  await next(); // 8: ask in Khmer
  await caption(7, km);
  await expect(page.getByText(/ខ្សែឡានក្រុងដែលទៅដល់/)).toBeVisible();

  await next(); // 9: thank you
  await caption(8, km);
  await next(); // finishes the demo
  await expect(bar).toHaveCount(0);
});

test('Escape exits the demo; Settings starts it again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('citybus.lang', 'en'));
  await page.goto('/?demo');
  const bar = page.locator('[data-demo-bar]'); // its label changes language mid-demo
  await expect(bar).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: en.nav.settings }).click();
  await page.getByRole('button', { name: new RegExp(en.demo.start) }).click();
  await expect(bar).toContainText(en.demo.steps[0]);
});

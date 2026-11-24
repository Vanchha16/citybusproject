// End-to-end passenger journeys, run on a phone and a desktop screen.
import { test, expect } from '@playwright/test';
import { isPhone, nav, openHome, routeOptions, searchDestination, strings } from './helpers.js';

test.describe('home', () => {
  test('shows search, quick destinations, services and live status', async ({ page }) => {
    const s = await openHome(page);
    await expect(page.getByRole('button', { name: s.whereTo })).toBeVisible();
    await expect(page.getByRole('button', { name: /Techo International Airport/ }).first()).toBeVisible();
    for (const tile of [s.tileCity, s.tileAirport, s.tileNearby]) {
      await expect(page.getByRole('button', { name: tile })).toBeVisible();
    }
    const running = await page.getByText(/buses on the road/).innerText();
    expect(Number(running.match(/\d+/)[0])).toBeGreaterThan(10);
  });

  test('live map card shows moving buses and opens the full map', async ({ page }, info) => {
    test.skip(!isPhone(info), 'the card is only on phones; desktop always shows the full map');
    const s = await openHome(page);
    await expect(page.locator('.preview-bus').first()).toBeAttached();
    await page.getByRole('button', { name: s.openMap }).click();
    await expect(page.getByPlaceholder(s.whereTo)).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });
});

test.describe('finding a route', () => {
  test('keyboard: type, arrow down, Enter picks a suggestion', async ({ page }) => {
    const s = await openHome(page);
    await page.getByRole('button', { name: s.whereTo }).click();
    const to = page.getByPlaceholder(s.whereTo);
    await expect(to).toBeFocused();
    await to.fill('russian');
    await expect(page.getByRole('listbox')).toBeVisible();
    await to.press('ArrowDown');
    await to.press('ArrowUp');
    await to.press('Enter');
    await expect(page.getByRole('heading', { name: s.linesHere('Russian Market (Toul Tom Poung)') })).toBeVisible();
  });

  test('airport: only airport buses are shown, every route ends on one', async ({ page }) => {
    const s = await openHome(page);
    await searchDestination(page, s, 'airport', 'Techo International Airport');
    const card = page.locator('section[aria-labelledby="lines-h"]');
    await expect(card.getByRole('listitem')).toHaveCount(2);
    await expect(card).toContainText('AEB');
    await expect(card).toContainText('AX2');

    // Map: only the two airport lines stay strong; the others fade.
    await expect.poll(() => page.locator('.leaflet-overlay-pane path[stroke-opacity="0.85"]').count()).toBe(2);

    const options = routeOptions(page);
    await expect(options.first()).toBeVisible();
    for (let i = 0; i < await options.count(); i++) {
      const lastLine = await options.nth(i).locator('[data-line]').last().getAttribute('data-line');
      expect(['AEB', 'AX2']).toContain(lastLine);
    }
    await expect(options.first()).toContainText(s.tag.recommended);
  });

  test('route steps show the next bus and the alert turns on and off', async ({ page }) => {
    const s = await openHome(page);
    await searchDestination(page, s, 'airport', 'Techo International Airport');
    await routeOptions(page).first().click();
    await expect(page.getByText(s.nextBus)).toBeVisible();
    await expect(page.getByText(s.arriveAt('Techo International Airport'))).toBeVisible();

    const alertBtn = page.getByRole('button', { name: s.notifyWhenNear });
    await alertBtn.click();
    await expect(page.getByRole('button', { name: s.alertOn })).toHaveAttribute('aria-pressed', 'true');
    const banner = page.locator('[role="status"][aria-live="polite"]');
    await expect(banner).toContainText(/AEB|AX2/);
    await banner.getByRole('button', { name: s.stopWatching }).click();
    await expect(banner).toHaveCount(0);

    await page.getByRole('button', { name: s.back }).click();
    await expect(routeOptions(page).first()).toBeVisible();
  });

  test('swap start and destination, then clear', async ({ page }) => {
    const s = await openHome(page);
    await searchDestination(page, s, 'royal palace', 'Royal Palace');
    await page.getByRole('button', { name: s.swap }).click();
    await expect(page.getByPlaceholder(s.from)).toHaveValue('Royal Palace');
    await expect(page.getByRole('heading', { name: s.linesHere(s.myLocation) })).toBeVisible();
    await page.getByRole('button', { name: s.clear }).last().click();
    await expect(page.getByRole('heading', { name: s.popular })).toBeVisible();
  });

  test('home airport tile goes straight to airport routes', async ({ page }) => {
    const s = await openHome(page);
    await page.getByRole('button', { name: s.tileAirport }).click();
    await expect(page.getByRole('heading', { name: s.linesHere('Techo International Airport') })).toBeVisible();
  });
});

test.describe('ask in Khmer or English', () => {
  for (const [lang, question, expected] of [
    ['en', 'How do I get to the Russian Market?', /Bus lines that go to Russian Market/],
    ['km', 'ពីផ្សារធំថ្មី ទៅព្រលានយន្តហោះ', /ខ្សែឡានក្រុងដែលទៅដល់/],
  ]) {
    test(`answers a ${lang === 'en' ? 'English' : 'Khmer'} question with a route`, async ({ page }) => {
      const s = await openHome(page, lang);
      await page.getByRole('button', { name: s.askShort }).click();
      const box = page.getByRole('textbox', { name: s.ask });
      await expect(box).toBeFocused();
      await box.fill(question);
      await box.press('Enter');
      await expect(page.getByText(expected)).toBeVisible();
      await expect(routeOptions(page).first()).toBeVisible();
    });
  }
});

test.describe('other tabs', () => {
  test('lines: all seven lines, open one to see its stops', async ({ page }) => {
    const s = await openHome(page);
    await nav(page, s, 'lines').click();
    await expect(page.getByRole('heading', { name: s.allLines })).toBeVisible();
    await expect(page.locator('main, aside').getByRole('listitem').filter({ has: page.locator('span.font-bold') })).toHaveCount(7);
    await page.getByRole('button', { name: /1A/ }).click();
    await expect(page.getByText(s.lineStops)).toBeVisible();
    await expect(page.locator('section[aria-labelledby="line-h"] ol > li')).toHaveCount(9);
    await page.getByRole('button', { name: s.close }).click();
    await expect(page.getByText(s.lineStops)).toHaveCount(0);
  });

  test('nearby: stops with arrival times; set an alert and stop it from settings', async ({ page }) => {
    const s = await openHome(page);
    await nav(page, s, 'nearby').click();
    await expect(page.getByRole('heading', { name: s.nearbyTitle })).toBeVisible();
    await expect(page.getByText('Central Market').first()).toBeVisible();
    const bell = page.getByRole('button', { name: new RegExp(s.notifyWhenNear) }).first();
    await bell.click();
    await expect(bell).toHaveAttribute('aria-pressed', 'true');

    await nav(page, s, 'settings').click();
    const alertsSection = page.locator('section[aria-labelledby="alerts-h"]');
    await alertsSection.getByRole('button', { name: s.stopWatching }).click();
    await expect(alertsSection.getByText(s.noAlert)).toBeVisible();
  });

  test('settings: language switch, remembered after reload', async ({ page }) => {
    const s = await openHome(page);
    await nav(page, s, 'settings').click();
    await page.getByRole('radio', { name: 'ភាសាខ្មែរ' }).click();
    const km = strings('km');
    await expect(page.locator('html')).toHaveAttribute('lang', 'km');
    await expect(page.getByRole('heading', { name: km.settingsTitle })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: km.whereTo })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'km');
  });

  test('header flag button toggles the language', async ({ page }) => {
    const s = await openHome(page);
    await page.getByRole('button', { name: s.switchLanguage }).click();
    await expect(page.getByRole('button', { name: strings('km').whereTo })).toBeVisible();
    await page.getByRole('button', { name: strings('km').switchLanguage }).click();
    await expect(page.getByRole('button', { name: s.whereTo })).toBeVisible();
  });
});

test.describe('your location: allowed, in Phnom Penh', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 11.5640, longitude: 104.9307 } }); // Royal Palace

  test('uses the real position and finds the stops next to you', async ({ page }) => {
    const s = await openHome(page);
    await expect(page.getByText(s.fromHere(s.myLocation))).toBeVisible();
    await expect(page.getByRole('button', { name: s.tryAgain })).toHaveCount(0); // no warning when it works
    await nav(page, s, 'nearby').click();
    const firstStop = page.locator('section[aria-labelledby="nearby-page-h"] > ul > li').first();
    await expect(firstStop).toContainText('Royal Palace');
  });
});

test.describe('your location: only a rough guess (e.g. from the internet connection)', () => {
  // About 300 km away (Battambang) with ±50 km accuracy, like a computer's IP-based location.
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 13.0957, longitude: 103.2022, accuracy: 50000 } });

  test('says it is a rough guess (not "302 km away") and lets you choose the start', async ({ page }) => {
    const s = await openHome(page);
    await expect(page.getByText(s.loc.rough(50)).first()).toBeVisible();
    await expect(page.getByText(/km from Phnom Penh/)).toHaveCount(0);
    await page.getByRole('button', { name: s.chooseStart }).first().click();
    await expect(page.getByPlaceholder(s.from)).toBeFocused();
    await page.getByPlaceholder(s.from).fill('royal palace');
    await page.getByRole('option', { name: /Royal Palace/ }).first().click();
    await expect(page.getByPlaceholder(s.from)).toHaveValue('Royal Palace');
    await expect(page.getByText(s.loc.rough(50))).toHaveCount(0); // a chosen start needs no warning
  });
});

test.describe('your location: blocked', () => {
  test.use({ permissions: [] });

  test('says location is blocked and offers to try again', async ({ page }) => {
    const s = await openHome(page);
    await expect(page.getByText(s.fromHere(s.demoLocation))).toBeVisible();
    await expect(page.getByText(s.loc.denied).first()).toBeVisible();
    await expect(page.getByRole('button', { name: s.tryAgain }).first()).toBeVisible();
  });
});

test.describe('your location: far from Phnom Penh', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 13.3633, longitude: 103.8564 } }); // Siem Reap

  test('falls back to the demo location and says why', async ({ page }) => {
    const s = await openHome(page);
    await expect(page.getByText(s.fromHere(s.demoLocation))).toBeVisible();
    await expect(page.getByText(/km from Phnom Penh/).first()).toContainText(/2\d\d km/); // Siem Reap ≈ 230 km
  });
});

test.describe('bottom bar and tiles', () => {
  test('nothing sticks out of the bottom bar or overlaps the page', async ({ page }) => {
    const s = await openHome(page);
    const box = await page.evaluate(() => {
      const nav = document.querySelector('nav').getBoundingClientRect();
      const parts = [...document.querySelectorAll('nav button, nav button > span')].map((el) => el.getBoundingClientRect());
      return { navTop: nav.top, highest: Math.min(...parts.map((r) => r.top)) };
    });
    expect(box.highest, 'a bottom-bar button rises above the bar').toBeGreaterThanOrEqual(box.navTop - 0.5);
    await expect(nav(page, s, 'directions' in s.nav ? 'directions' : 'trip')).toBeVisible();
  });

  test('service tile labels fit inside their tiles', async ({ page }) => {
    await openHome(page);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('#services-h + div button')].map((b) => {
        const label = b.querySelector('span:last-child');
        const tile = b.getBoundingClientRect();
        const text = label.getBoundingClientRect();
        return { text: label.textContent, fits: text.left >= tile.left - 0.5 && text.right <= tile.right + 0.5 && label.scrollWidth <= label.clientWidth + 1 };
      }));
    for (const t of overflow) expect(t.fits, `"${t.text}" runs past its tile`).toBe(true);
  });
});

test.describe('layout fits the screen', () => {
  for (const size of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 360, height: 640 }]) {
    test(`no page scroll and the bottom bar is fully visible at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      const s = await openHome(page);
      for (const tab of ['home', 'lines', 'nearby', 'settings']) {
        await nav(page, s, tab).click();
        const { navBottom, pageHeight, pageWidth } = await page.evaluate(() => ({
          navBottom: document.querySelector('nav').getBoundingClientRect().bottom,
          pageHeight: document.documentElement.scrollHeight,
          pageWidth: document.documentElement.scrollWidth,
        }));
        expect(navBottom, `${tab}: bottom bar cut off`).toBeLessThanOrEqual(size.height + 0.5);
        expect(pageHeight, `${tab}: page scrolls vertically`).toBeLessThanOrEqual(size.height);
        expect(pageWidth, `${tab}: page scrolls sideways`).toBeLessThanOrEqual(size.width);
      }
    });
  }
});

test.describe('resilience and motion', () => {
  test('shows a clear error while the server is down and recovers by itself', async ({ page }) => {
    let down = true;
    await page.route('**/api/network', (route) => (down ? route.abort() : route.continue()));
    await page.goto('/');
    const s = strings('en');
    await expect(page.getByRole('alert')).toContainText(s.error);
    down = false;
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 12_000 });
    await expect(page.getByRole('heading', { name: s.serviceNow })).toBeVisible();
  });

  test('reduced motion: no entrance animations, everything visible at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const s = await openHome(page);
    await searchDestination(page, s, 'airport', 'Techo International Airport');
    const anim = await page.locator('.rise').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
  });

  test('destination reveal draws the airport lines on the map', async ({ page }) => {
    const s = await openHome(page);
    await searchDestination(page, s, 'airport', 'Techo International Airport');
    await expect(page.locator('path.line-draw')).toHaveCount(2);
    await expect(page.locator('.dest-drop')).toHaveCount(1);
  });
});

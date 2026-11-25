// Automated WCAG 2.1 AA checks (axe-core) on every page, in both languages and
// on phone + desktop. Covers colour contrast, names for buttons and inputs,
// ARIA use and language tags.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openHome, nav, routeOptions, searchDestination } from './helpers.js';

const pages = {
  home: async () => {},
  planner: async (page, s) => page.getByRole('button', { name: s.whereTo }).click(),
  'airport routes': async (page, s) => searchDestination(page, s, 'airport', 'Techo International Airport'),
  'route steps': async (page, s) => {
    await searchDestination(page, s, 'airport', 'Techo International Airport');
    await routeOptions(page).first().click();
    await expect(page.getByRole('button', { name: s.notifyWhenNear })).toBeVisible();
  },
  lines: async (page, s) => nav(page, s, 'lines').click(),
  'line detail': async (page, s) => {
    await nav(page, s, 'lines').click();
    await page.getByRole('button', { name: /1A/ }).click();
    await expect(page.getByText(s.lineStops)).toBeVisible();
  },
  nearby: async (page, s) => nav(page, s, 'nearby').click(),
  settings: async (page, s) => nav(page, s, 'settings').click(),
  operator: async (page, s) => {
    await page.goto('/operator');
    await expect(page.getByRole('heading', { name: s.ops.title })).toBeVisible();
    await expect(page.getByRole('heading', { name: s.ops.recent })).toBeVisible();
  },
};

async function violations(page) {
  await page.waitForTimeout(1800); // let entrance animations finish so contrast is measured at rest
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-tile-pane') // third-party map tiles
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 8).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 220)}`),
  }));
}

for (const lang of ['en', 'km']) {
  for (const [name, goTo] of Object.entries(pages)) {
    test(`a11y: ${name} (${lang})`, async ({ page }) => {
      // axe can't measure contrast on elements that are mid-animation, so scan with motion off.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const s = await openHome(page, lang);
      await goTo(page, s);
      const found = await violations(page);
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  }
}

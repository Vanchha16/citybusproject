import { expect } from '@playwright/test';
import { t } from '../src/i18n.js';

export const isPhone = (testInfo) => testInfo.project.name === 'phone';

/** UI strings for a language — tests find things by the same words passengers see. */
export const strings = (lang) => t(lang);

/** Open the app on the home page (in `lang`) and wait until the network has loaded. */
export async function openHome(page, lang = 'en') {
  // Set the starting language once per tab, so a later reload keeps whatever the user chose.
  await page.addInitScript((l) => {
    if (!sessionStorage.getItem('e2e.langSet')) {
      localStorage.setItem('citybus.lang', l);
      sessionStorage.setItem('e2e.langSet', '1');
    }
  }, lang);
  await page.goto('/');
  const s = strings(lang);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.getByRole('button', { name: s.whereTo })).toBeVisible();
  await expect(page.getByRole('heading', { name: s.serviceNow })).toBeVisible();
  return s;
}

/** The bottom bar (visible on every page except the planner on phones). */
export const nav = (page, s, key) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: s.nav[key] });

/** From home: pick a destination with the search bar, the way a passenger would. */
export async function searchDestination(page, s, query, optionEn, lang = 'en') {
  await page.getByRole('button', { name: s.whereTo }).click();
  const to = page.getByPlaceholder(s.whereTo);
  await expect(to).toBeFocused();
  await to.fill(query);
  const option = page.getByRole('option', { name: new RegExp(optionEn) }).first();
  const placeName = (await option.locator('span.block').first().innerText()).trim();
  await option.click();
  await expect(page.getByRole('heading', { name: s.linesHere(placeName) })).toBeVisible();
  return placeName;
}

/** Route option buttons in the planner. */
export const routeOptions = (page) => page.locator('section[aria-labelledby="routes-h"] ol > li > button');

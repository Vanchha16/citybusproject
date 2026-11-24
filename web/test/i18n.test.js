// Every English text has a Khmer translation (and the other way round), every
// text function returns text, and number/time formatting is right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, kmNum, clock, distance, roundMin } from '../src/i18n.js';

/** Flatten nested strings into dotted keys. */
function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

test('Khmer and English have exactly the same texts', () => {
  const en = keys(t('en')).sort();
  const km = keys(t('km')).sort();
  assert.deepEqual(km.filter((k) => !en.includes(k)), [], 'only in Khmer');
  assert.deepEqual(en.filter((k) => !km.includes(k)), [], 'missing in Khmer');
});

test('every text is non-empty in both languages, including those built from numbers', () => {
  for (const lang of ['en', 'km']) {
    const s = t(lang);
    for (const key of keys(s)) {
      const v = get(s, key);
      const out = typeof v === 'function' ? v(3, 'X') : v;
      assert.equal(typeof out, 'string', `${lang}.${key}`);
      assert.ok(out.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('Khmer texts are actually written in Khmer', () => {
  const s = t('km');
  const khmer = /[ក-៿]/;
  const allowedLatin = new Set(['switchLanguage', 'm', 'km']); // "English" label; units use Khmer below
  for (const key of keys(s)) {
    if (allowedLatin.has(key)) continue;
    const v = get(s, key);
    const out = typeof v === 'function' ? v(3, 'X') : v;
    assert.ok(khmer.test(out), `km.${key} has no Khmer: "${out}"`);
  }
});

test('Khmer numerals', () => {
  assert.equal(kmNum(2026), '២០២៦');
  assert.equal(kmNum('1.5'), '១.៥');
  assert.equal(t('km').min(12), '១២ នាទី');
});

test('clock wraps around midnight and rounds minutes', () => {
  assert.equal(clock(9 * 60 + 5), '09:05');
  assert.equal(clock(24 * 60 + 30), '00:30');
  assert.equal(clock(-30), '23:30');
  assert.equal(clock(59.6), '01:00');
});

test('distances read naturally', () => {
  assert.equal(distance(4, 'en'), '10 m');
  assert.equal(distance(347, 'en'), '350 m');
  assert.equal(distance(1234, 'en'), '1.2 km');
  assert.equal(distance(1234, 'km'), '១.២ គ.ម');
  assert.equal(roundMin(0.2), 1);
});

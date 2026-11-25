// Colour contrast for every text/background pair the UI uses (WCAG 2.1 AA:
// 4.5:1 for normal text, 3:1 for non-text marks). Runs without a browser, so a
// palette change that hurts readability fails immediately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lines } from '../../server/src/data/network.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const token = (name) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))[1];
const WHITE = '#ffffff';
const MIST = token('mist');
const INK = token('ink');

test('white text on every line badge is readable', () => {
  for (const l of lines) {
    const r = contrast(WHITE, l.color);
    assert.ok(r >= 4.5, `line ${l.code} ${l.color}: ${r.toFixed(2)}:1`);
  }
});

test('line colours are distinct from each other on the map', () => {
  const dist = (a, b) => Math.hypot(...hex(a).map((v, i) => (v - hex(b)[i]) * 255));
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const d = dist(lines[i].color, lines[j].color);
      assert.ok(d >= 60, `${lines[i].code} and ${lines[j].code} look too alike (${d.toFixed(0)})`);
    }
  }
});

test('text colours pass on white and on the grey background', () => {
  for (const [name, fg] of [['ink', INK], ['ink-soft', token('ink-soft')], ['ink-faint', token('ink-faint')]]) {
    for (const [bgName, bg] of [['white', WHITE], ['mist', MIST]]) {
      const r = contrast(fg, bg);
      assert.ok(r >= 4.5, `${name} on ${bgName}: ${r.toFixed(2)}:1`);
    }
  }
  assert.ok(contrast('#92400e', MIST) >= 4.5, 'estimated (amber-800) times on grey');
  assert.ok(contrast(INK, token('signal')) >= 4.5, 'alert banner text on yellow');
});

test('white text on the brand blues (header, buttons, Directions) is readable', () => {
  for (const name of ['brand-light', 'brand', 'brand-dark']) {
    const r = contrast(WHITE, token(name));
    assert.ok(r >= 4.5, `white on ${name} ${token(name)}: ${r.toFixed(2)}:1`);
  }
});

test('status marks are visible (non-text, 3:1)', () => {
  assert.ok(contrast('#16a34a', WHITE) >= 3, 'live dot');
  assert.ok(contrast('#dc2626', WHITE) >= 3, 'live map rec dot');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/ratelimit.js';

function fakeClock() {
  let t = 1_000_000;
  const clock = () => t;
  clock.advance = (ms) => { t += ms; };
  return clock;
}

test('flood guard: 10 questions a minute, then wait', () => {
  const clock = fakeClock();
  const lim = createLimiter(clock);
  for (let i = 0; i < 10; i++) assert.equal(lim.check('a', false).allowed, true, `question ${i + 1}`);
  const blocked = lim.check('a', false);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 60);
  assert.equal(lim.check('b', false).allowed, true, 'other people are not affected');
  clock.advance(61_000);
  assert.equal(lim.check('a', false).allowed, true, 'allowed again after a minute');
});

test('AI budget per person: 20 an hour, then free keyword answers (still allowed)', () => {
  const clock = fakeClock();
  const lim = createLimiter(clock);
  let ai = 0;
  for (let i = 0; i < 30; i++) {
    const r = lim.check('a', true);
    assert.equal(r.allowed, true);
    if (r.useAI) ai++;
    clock.advance(7_000); // ~8 a minute: under the flood guard
  }
  assert.equal(ai, 20);
  clock.advance(60 * 60_000);
  assert.equal(lim.check('a', true).useAI, true, 'AI again after an hour');
});

test('site-wide AI budget per day', () => {
  process.env.AI_PER_DAY = '5';
  try {
    const clock = fakeClock();
    const lim = createLimiter(clock);
    const used = Array.from({ length: 8 }, (_, i) => lim.check(`person-${i}`, true).useAI);
    assert.deepEqual(used, [true, true, true, true, true, false, false, false]);
  } finally {
    delete process.env.AI_PER_DAY;
  }
});

test('no AI key: never uses AI', () => {
  const lim = createLimiter(fakeClock());
  assert.equal(lim.check('a', false).useAI, false);
});

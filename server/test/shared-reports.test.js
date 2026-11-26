// Shared reports: two server copies (like two Vercel instances) see each other's
// reports through Redis, and a Redis outage never loses a report or breaks a request.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createReportStore, redisFromEnv } from '../src/reports.js';

// A fake Upstash REST endpoint: just the commands the store uses.
const lists = new Map();
let down = false;
let calls = 0;
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    calls++;
    if (down) { res.writeHead(503); return res.end(); }
    if (req.url !== '/pipeline' || req.headers.authorization !== 'Bearer secret') { res.writeHead(401); return res.end(); }
    const out = JSON.parse(body).map(([cmd, key, ...args]) => {
      const list = lists.get(key) ?? [];
      lists.set(key, list);
      if (cmd === 'LPUSH') { list.unshift(...args); return { result: list.length }; }
      if (cmd === 'LTRIM') { list.splice(Number(args[1]) + 1); return { result: 'OK' }; }
      if (cmd === 'PEXPIRE') return { result: 1 };
      if (cmd === 'LRANGE') return { result: [...list] };
      return { error: `unknown command ${cmd}` };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
});
let env;
before(async () => {
  fake.listen(0);
  await new Promise((r) => fake.once('listening', r));
  env = { UPSTASH_REDIS_REST_URL: `http://localhost:${fake.address().port}`, UPSTASH_REDIS_REST_TOKEN: 'secret' };
});
after(() => fake.close());

const report = (over = {}) => ({ kind: 'full', stopId: 'CENTRAL', lineId: 'AEB', dir: 0, tripId: 'AEB-0-540', at: 545, client: 'a', ...over });

test('no Redis settings: memory only; Vercel KV names work too', () => {
  assert.equal(redisFromEnv({}), null);
  assert.equal(createReportStore().mode, 'memory');
  assert.ok(redisFromEnv({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }));
});

test('a report sent to one copy shows up on the other', async () => {
  lists.clear();
  let now = 1_000_000;
  const clock = () => now;
  const one = createReportStore({ clock, redis: redisFromEnv(env) });
  const two = createReportStore({ clock, redis: redisFromEnv(env) });
  assert.equal(one.mode, 'shared');

  await one.add(report());
  await two.sync();
  assert.equal(two.since(546, 60).length, 1, 'copy two sees the report');
  const v = two.version;

  // Syncing again straight away does not call Redis (at most every few seconds).
  const before = calls;
  await two.sync();
  assert.equal(calls, before);

  // The same person saying the same thing on the other copy replaces it, everywhere.
  now += 5000;
  await two.add(report({ stopId: 'MONIVONG', at: 547 }));
  now += 5000;
  await one.sync();
  const seen = one.since(548, 60);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].stopId, 'MONIVONG');
  assert.ok(two.version > v);
});

test('Redis down: reports still count on this copy, and nothing throws', async () => {
  lists.clear();
  down = true;
  const store = createReportStore({ redis: redisFromEnv(env) });
  const warn = console.warn;
  const warnings = [];
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    await store.add(report({ client: 'b' }));
    await store.sync();
  } finally {
    console.warn = warn;
    down = false;
  }
  assert.equal(store.since(546, 60).length, 1);
  assert.equal(warnings.length, 2);

  // Back up: the next sync keeps the local report (merged with whatever Redis has).
  await store.sync(); // too soon after the last try: skipped
  assert.equal(store.since(546, 60).length, 1);
});

test('old reports are dropped after 3 hours', async () => {
  lists.clear();
  let now = 0;
  const store = createReportStore({ clock: () => now, redis: redisFromEnv(env) });
  await store.add(report({ client: 'c' }));
  now = 3 * 60 * 60 * 1000 + 1;
  await store.sync();
  assert.equal(store.since(546, 60).length, 0);
});

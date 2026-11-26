// Walking paths along streets: uses the foot router's path, pins the ends on the passenger
// and the stop, caches it, and falls back to a straight line when the router fails.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createWalkPaths } from '../src/walkpath.js';

let calls = 0;
let mode = 'ok';
const router = http.createServer((req, res) => {
  calls++;
  if (mode === 'down') { res.writeHead(502); return res.end('bad gateway'); }
  if (mode === 'slow') return setTimeout(() => res.end('{}'), 500);
  const m = /\/route\/v1\/foot\/([\d.]+),([\d.]+);([\d.]+),([\d.]+)/.exec(req.url);
  assert.ok(m, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (mode === 'noroute') return res.end(JSON.stringify({ code: 'NoRoute', routes: [] }));
  // An L-shaped street path: east along one street, then north.
  res.end(JSON.stringify({
    code: 'Ok',
    routes: [{ geometry: { coordinates: [[Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[2])], [Number(m[3]), Number(m[4])]] } }],
  }));
});
let url;
before(async () => {
  router.listen(0);
  await new Promise((r) => router.once('listening', r));
  url = `http://localhost:${router.address().port}`;
});
after(() => router.close());

const A = { lat: 11.5712, lng: 104.9178 };
const B = { lat: 11.5697, lng: 104.9211 };

test('follows the streets, pinned on both ends, and is cached', async () => {
  mode = 'ok';
  calls = 0;
  const walks = createWalkPaths({ router: url });
  const r = await walks.path(A, B);
  assert.equal(r.source, 'streets');
  assert.deepEqual(r.geometry[0], [A.lat, A.lng]);
  assert.deepEqual(r.geometry.at(-1), [B.lat, B.lng]);
  assert.ok(r.geometry.some(([lat, lng]) => lat === A.lat && lng === B.lng), 'the corner of the L');
  await walks.path(A, B);
  assert.equal(calls, 1, 'second time from the cache');
});

test('router down, slow, or no path: a straight line, not cached', async () => {
  for (const m of ['down', 'slow', 'noroute']) {
    mode = m;
    calls = 0;
    const walks = createWalkPaths({ router: url, timeoutMs: 200 });
    const r = await walks.path(A, B);
    assert.equal(r.source, 'straight', m);
    assert.deepEqual(r.geometry, [[A.lat, A.lng], [B.lat, B.lng]]);
    await walks.path(A, B);
    assert.equal(calls, 2, `${m}: tried again`);
  }
});

test('router off, or a walk longer than 5 km: straight line without asking', async () => {
  calls = 0;
  assert.equal((await createWalkPaths({ router: '' }).path(A, B)).source, 'straight');
  assert.equal((await createWalkPaths({ router: url }).path(A, { lat: 11.36, lng: 104.91 })).source, 'straight');
  assert.equal(calls, 0);
});

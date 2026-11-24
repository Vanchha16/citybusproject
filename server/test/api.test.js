// HTTP API tests: every endpoint, the happy path and the mistakes clients make.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DEMO_CLOCK = '09:00'; // buses in service, whatever time the tests run
process.env.ANTHROPIC_API_KEY = ''; // keyword engine: deterministic answers
const { app } = await import('../src/index.js');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};
const post = async (path, body, raw = false) => {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const CENTRAL = { lat: 11.5697, lng: 104.9211 };
const AIRPORT = { lat: 11.3629, lng: 104.9166 };

test('health', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.ai, false);
});

test('network has stops, lines with geometry, and places', async () => {
  const { body } = await get('/api/network');
  assert.ok(body.stops.length > 20);
  assert.equal(body.lines.length, 7);
  for (const l of body.lines) {
    assert.ok(l.geometry.length >= l.stops.length, `${l.code} geometry`);
    assert.equal(l.headsigns.length, 2);
  }
  assert.ok(body.places.find((p) => p.id === 'kti'));
});

test('search: English, Khmer, no duplicates, empty query', async () => {
  const en = (await get('/api/search?q=airport')).body;
  assert.equal(en[0].id, 'kti');
  assert.equal(en.filter((x) => x.name.en === 'Techo International Airport').length, 1);
  const km = (await get(`/api/search?q=${encodeURIComponent('ផ្សារទួល')}`)).body;
  assert.equal(km[0].id, 'russian-market');
  assert.deepEqual((await get('/api/search?q=')).body, []);
  assert.deepEqual((await get('/api/search?q=zzzzzz')).body, []);
});

test('plan to the airport: only airport lines, live info on the first bus', async () => {
  const q = `fromLat=${CENTRAL.lat}&fromLng=${CENTRAL.lng}&toLat=${AIRPORT.lat}&toLng=${AIRPORT.lng}`;
  const { status, body } = await get(`/api/plan?${q}`);
  assert.equal(status, 200);
  assert.deepEqual(body.servingLines.map((s) => s.lineId).sort(), ['AEB', 'AX2']);
  assert.ok(body.options.length >= 1);
  for (const o of body.options) {
    const buses = o.legs.filter((l) => l.type === 'bus');
    assert.equal(buses.at(-1).kind, 'airport');
    assert.ok(buses[0].realtime, 'first bus has a prediction');
    assert.ok(['live', 'estimated', 'timetable'].includes(buses[0].realtime.source));
  }
});

test('plan rejects missing or invalid coordinates', async () => {
  assert.equal((await get('/api/plan')).status, 400);
  assert.equal((await get('/api/plan?fromLat=abc&fromLng=1&toLat=1&toLng=1')).status, 400);
  assert.equal((await get('/api/plan?fromLat=200&fromLng=1&toLat=1&toLng=1')).status, 400);
});

test('nearby: closest stop first, each departure has an arrival with a source', async () => {
  const { body } = await get(`/api/nearby?lat=${CENTRAL.lat}&lng=${CENTRAL.lng}`);
  assert.equal(body.stops[0].stopId, 'CENTRAL');
  for (const s of body.stops) {
    for (const d of s.departures) {
      for (const a of d.arrivals) assert.ok(['live', 'estimated', 'timetable'].includes(a.source));
    }
  }
  assert.equal((await get('/api/nearby')).status, 400);
});

test('buses: fused vehicles with status and matching summary', async () => {
  const { body } = await get('/api/buses');
  assert.ok(body.buses.length > 10);
  const counts = { live: 0, estimated: 0, lost: 0, suspect: 0 };
  for (const b of body.buses) {
    counts[b.status]++;
    assert.ok(!('_truth' in b), 'simulator ground truth must not leak');
  }
  assert.deepEqual(counts, body.summary);
});

test('arrivals for an alert; bad stop/line/direction is a 400', async () => {
  const { status, body } = await get('/api/arrivals?stopId=CENTRAL&lineId=AEB&dir=0');
  assert.equal(status, 200);
  assert.ok(body.arrivals.length >= 1);
  assert.ok(body.arrivals[0].at >= body.now - 0.5);
  assert.equal((await get('/api/arrivals?stopId=NOPE&lineId=AEB&dir=0')).status, 400);
  assert.equal((await get('/api/arrivals?stopId=KTI&lineId=AEB&dir=0')).status, 400, 'last stop: no boarding');
  assert.equal((await get('/api/arrivals?stopId=CENTRAL&lineId=AEB&dir=7')).status, 400);
});

test('assistant: English trip, Khmer trip, nearby, needs location, bad input', async () => {
  const en = (await post('/api/assistant', { message: 'How do I get to the airport?', location: CENTRAL })).body;
  assert.equal(en.engine, 'keywords');
  assert.equal(en.destination.id, 'kti');
  assert.match(en.answer, /Bus lines that go to Techo International Airport: AEB, AX2/);

  const km = (await post('/api/assistant', { message: 'ពីផ្សារធំថ្មី ទៅព្រលានយន្តហោះ', location: null })).body;
  assert.equal(km.language, 'km');
  assert.equal(km.origin.id, 'central-market');
  assert.match(km.answer, /ខ្សែឡានក្រុងដែលទៅដល់/);

  const near = (await post('/api/assistant', { message: 'bus stops near me', location: CENTRAL })).body;
  assert.equal(near.intent, 'nearby');
  assert.ok(near.nearby.stops.length > 0);

  const noLoc = (await post('/api/assistant', { message: 'to the Royal Palace', location: null })).body;
  assert.equal(noLoc.plan, null);
  assert.match(noLoc.answer, /starting from/);

  assert.equal((await post('/api/assistant', { message: '   ' })).status, 400);
  const broken = await post('/api/assistant', '{not json', true);
  assert.equal(broken.status, 400);
  assert.equal(broken.body.error, 'Invalid JSON body');
});

test('ask: flooding from one person gets a 429 with Retry-After; others still get answers', async () => {
  const ask = (ip) => fetch(`${base}/api/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ message: 'to the airport', location: CENTRAL }),
  });
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await ask('203.0.113.7')).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
  const blocked = await ask('203.0.113.7');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.match((await blocked.json()).error, /Too many questions/);
  assert.equal((await ask('198.51.100.4')).status, 200);
});

test('demo clock: the network "as at" a time of day', async () => {
  const at = async (minutes) => (await fetch(`${base}/api/buses`, { headers: { 'X-Demo-Clock': String(minutes) } })).json();
  const night = await at(3 * 60);
  const morning = await at(9 * 60);
  assert.equal(night.now, 180);
  assert.equal(night.buses.length, 0, 'no buses at 3 am');
  assert.ok(morning.buses.length > 10, 'buses at 9 am');
  const bad = await (await fetch(`${base}/api/buses`, { headers: { 'X-Demo-Clock': 'nonsense' } })).json();
  assert.ok(Math.abs(bad.now - 540) < 5, 'invalid header falls back to the server clock (DEMO_CLOCK=09:00 in tests)');
});

test('unknown API path is a JSON 404', async () => {
  const { status, body } = await get('/api/nope');
  assert.equal(status, 404);
  assert.equal(body.error, 'Not found');
});

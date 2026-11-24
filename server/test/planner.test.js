import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTrip, linesServing } from '../src/planner.js';
import { nextArrival, patterns } from '../src/schedule.js';
import { gpsFeed } from '../src/simulation.js';
import { fuse, predictArrivals } from '../src/realtime.js';
import { understandWithKeywords } from '../src/assistant.js';
import { searchPlaces } from '../src/search.js';
import { places } from '../src/data/network.js';

const place = (id) => places.find((p) => p.id === id);
const AT_9AM = 9 * 60;

test('only airport lines serve Techo International Airport', () => {
  const serving = linesServing(place('kti')).map((s) => s.lineId).sort();
  assert.deepEqual(serving, ['AEB', 'AX2']);
});

test('every route to the airport ends on an airport line', () => {
  for (const from of ['royal-palace', 'central-market', 'aeon2', 'russian-market', 'rupp']) {
    const plan = planTrip(place(from), place('kti'), AT_9AM);
    assert.ok(plan.options.length > 0, `no route from ${from}`);
    for (const opt of plan.options) {
      const lastBus = opt.legs.filter((l) => l.type === 'bus').at(-1);
      assert.equal(lastBus.kind, 'airport', `${from}: ends on ${lastBus.lineId}`);
      assert.equal(lastBus.to.stopId, 'KTI');
    }
  }
});

test('route options are distinct and time moves forward', () => {
  const pairs = [['aeon2', 'royal-palace'], ['central-market', 'kti'], ['rupp', 'russian-market'], ['russey-keo', 'koh-pich']];
  const plans = pairs.map(([a, b]) => planTrip(place(a), place(b), AT_9AM));
  assert.ok(plans.some((p) => p.options.length >= 2), 'at least one trip offers alternatives');
  for (const plan of plans) {
    assert.ok(plan.options.length >= 1);
    assert.equal(new Set(plan.options.map((o) => o.id)).size, plan.options.length);
  }
  for (const opt of plans.flatMap((p) => p.options)) {
    let t = AT_9AM - 1e-9;
    for (const leg of opt.legs) {
      assert.ok(leg.departMin >= t - 1e-6, 'leg departs before previous one ends');
      assert.ok(leg.arriveMin >= leg.departMin);
      t = leg.arriveMin;
    }
    assert.ok(opt.legs.every((l) => l.type === 'bus' || l.meters >= 20), 'tiny walk legs are hidden');
  }
  for (const plan of plans) assert.ok(plan.options[0].tags.includes('recommended'));
});

test('nearby destinations suggest walking', () => {
  const plan = planTrip(place('royal-palace'), place('national-museum'), AT_9AM);
  assert.ok(plan.walkOnly);
});

test('no bus before service starts: wait until the first departure', () => {
  const p = patterns.AEB[0];
  assert.equal(nextArrival(p, 0, 4 * 60), 5 * 60 + 30);
  const late = nextArrival(p, 0, 23 * 60 + 45);
  assert.equal(late, 24 * 60 + 5 * 60 + 30);
});

test('buses report GPS during service hours only', () => {
  assert.ok(gpsFeed(AT_9AM).length > 10);
  assert.equal(gpsFeed(3 * 60).length, 0);
});

// Sample the whole morning so every GPS fault type shows up.
const samples = [];
for (let t = 7 * 60; t < 13 * 60; t += 3) {
  const feed = gpsFeed(t);
  const fused = new Map(fuse(t, feed).map((v) => [v.id, v]));
  for (const e of feed) samples.push({ t, e, v: fused.get(e.vehicleId) });
}
const metres = (a, b) => Math.hypot((a.lat - b.lat) * 110540, (a.lng - b.lng) * 109000);

test('healthy GPS: bus is live and its measured delay matches reality', () => {
  const ok = samples.filter((s) => s.e._truth.gps === 'ok' && s.v && s.e._truth.position);
  assert.ok(ok.length > 100);
  for (const { e, v } of ok) {
    assert.equal(v.status, 'live');
    assert.ok(Math.abs(v.delayMin - e._truth.lateMin) < 0.6, `delay ${v.delayMin} vs ${e._truth.lateMin}`);
  }
});

test('GPS dropout: position is estimated close to where the bus really is', () => {
  const lost = samples.filter((s) => s.v?.status === 'estimated' && s.e._truth.position);
  assert.ok(lost.length > 5, 'expected some dropouts in the morning');
  for (const { e, v } of lost) assert.ok(metres(v, e._truth.position) < 150, `${metres(v, e._truth.position)} m off`);
});

test('frozen GPS unit is flagged as suspect instead of shown as a real bus', () => {
  const frozen = samples.filter((s) => s.e._truth.gps === 'frozen' && s.v && s.e.fix.t - s.e.history.at(-1)?.t >= 0);
  const flagged = frozen.filter((s) => s.v.status === 'suspect');
  assert.ok(flagged.length > 5);
  for (const { v } of flagged) assert.ok(v.stillMin >= 5);
  // A ghost (unit still reporting after its trip ended) must always be flagged.
  for (const s of frozen.filter((x) => !x.e._truth.position)) assert.equal(s.v.status, 'suspect');
});

test('arrival predictions are in order and use live data when available', () => {
  const p = patterns.L01[0];
  const sources = new Set();
  for (let t = 8 * 60; t < 11 * 60; t += 5) {
    const arr = predictArrivals(p, 4, t, fuse(t), 3);
    assert.equal(arr.length, 3);
    for (let i = 1; i < arr.length; i++) assert.ok(arr[i].at >= arr[i - 1].at);
    for (const a of arr) { assert.ok(a.at >= t - 0.5); sources.add(a.source); }
    // At the first stop the next bus hasn't left yet, so only the timetable can say.
    assert.equal(predictArrivals(p, 0, t, fuse(t), 1)[0].source, 'timetable');
  }
  assert.ok(sources.has('live'));
});

test('keyword parser understands English and Khmer requests', () => {
  assert.equal(understandWithKeywords('How do I get to the airport?').destination_place_id, 'kti');
  const both = understandWithKeywords('I am near AEON Sen Sok, how can I go to the Royal Palace?');
  assert.equal(both.origin_place_id, 'aeon2');
  assert.equal(both.destination_place_id, 'royal-palace');
  const km = understandWithKeywords('ពីផ្សារធំថ្មី ទៅព្រលានយន្តហោះ');
  assert.equal(km.language, 'km');
  assert.equal(km.origin_place_id, 'central-market');
  assert.equal(km.destination_place_id, 'kti');
  assert.equal(understandWithKeywords('bus stops near me').intent, 'nearby');
});

test('search finds places in Khmer and English', () => {
  assert.equal(searchPlaces('airport')[0].id, 'kti');
  assert.equal(searchPlaces('ផ្សារទួល')[0].id, 'russian-market');
  assert.equal(searchPlaces('aeon sen')[0].id, 'aeon2');
});

// Passenger reports: validation, and how "here", "didn't come" and "full" change what
// everyone else sees (bus positions, arrival times, the operator view).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = '';
process.env.REPORTS_PER_10_MIN = '12';
const { app } = await import('../src/index.js');
const { patterns } = await import('../src/schedule.js');
const { reports } = await import('../src/reports.js');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => reports.clear());

let clientNo = 0;
const newClient = () => `10.0.0.${++clientNo}`;
const headers = (clock, client) => ({ 'X-Demo-Clock': String(clock), 'X-Forwarded-For': client ?? newClient() });
const get = async (path, clock) => {
  const res = await fetch(base + path, { headers: headers(clock) });
  return { status: res.status, body: await res.json() };
};
const report = async (body, clock, client) => {
  const res = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers(clock, client) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const arrivals = (stopId, lineId, dir, clock) =>
  get(`/api/arrivals?stopId=${stopId}&lineId=${lineId}&dir=${dir}`, clock).then((r) => r.body.arrivals);
/** The stop this trip should have reached by `clock` going by the timetable (not the last stop). */
function stopDueNow(v, clock) {
  const p = patterns[v.lineId][v.dir];
  const dep = Number(v.id.split('-').at(-1));
  let idx = 0;
  while (idx + 1 < p.stopIds.length - 1 && dep + p.offsets[idx + 1] <= clock) idx++;
  return { stopId: p.stopIds[idx], idx, pattern: p };
}
/** Find a time in the morning when some bus matches `pred`. */
async function findBus(pred) {
  for (let clock = 480; clock <= 720; clock += 3) {
    const { body } = await get('/api/buses', clock);
    const bus = body.buses.find(pred);
    if (bus) return { bus, clock };
  }
  throw new Error('no matching bus in the simulation');
}

test('rejects reports that are not about a real bus due here now', async () => {
  const clock = 540;
  const p = patterns.AEB[0];
  const stopId = p.stopIds[1];
  const dep = p.firstDeparture + Math.floor((clock - p.firstDeparture) / p.headway) * p.headway;
  const ok = { kind: 'came', stopId, lineId: 'AEB', dir: 0, tripId: `AEB-0-${dep}` };
  assert.equal((await report({ ...ok, kind: 'boarded' }, clock)).status, 400);
  assert.equal((await report({ ...ok, stopId: 'NOPE' }, clock)).status, 400);
  assert.equal((await report({ ...ok, dir: 3 }, clock)).status, 400);
  assert.equal((await report({ ...ok, tripId: 'AEB-0-541' }, clock)).status, 400, 'not a timetabled departure');
  assert.equal((await report({ ...ok, tripId: `AX2-0-${dep}` }, clock)).status, 400, 'trip of another line');
  assert.equal((await report({ ...ok, tripId: `AEB-0-${p.firstDeparture}` }, clock)).status, 400, 'bus long gone');
  assert.equal((await report(ok, clock)).status, 201);
});

test('reporting the same thing twice replaces it; too many reports get a 429', async () => {
  const clock = 540;
  const p = patterns.AEB[0];
  const dep = p.firstDeparture + Math.floor((clock - p.firstDeparture) / p.headway) * p.headway;
  const body = { kind: 'full', stopId: p.stopIds[0], lineId: 'AEB', dir: 0, tripId: `AEB-0-${dep}` };
  const me = newClient();
  assert.equal((await report(body, clock, me)).status, 201);
  const again = await report(body, clock, me);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  for (let i = 2; i < 12; i++) await report(body, clock, me);
  const limited = await report(body, clock, me);
  assert.equal(limited.status, 429);
  assert.ok(limited.body.retryAfterSec > 0);
});

test('"the bus is here" keeps a bus with a frozen GPS unit on the map, and tells the operator', async () => {
  const { bus, clock } = await findBus((b) => b.status === 'suspect');
  const { stopId } = stopDueNow(bus, clock);
  const r = await report({ kind: 'came', stopId, lineId: bus.lineId, dir: bus.dir, tripId: bus.id }, clock);
  assert.equal(r.status, 201);

  const after = (await get('/api/buses', clock)).body.buses.find((b) => b.id === bus.id);
  assert.equal(after.status, 'estimated');
  assert.equal(after.confirmedBy, 'passenger');
  assert.equal(after.gpsFault, true);
  assert.equal(after.reports.seen.stopId, stopId);

  const ops = (await get('/api/reports', clock)).body;
  assert.equal(ops.counts.came, 1);
  assert.equal(ops.tracking.byPassengers, 1);
  assert.ok(ops.issues.some((i) => i.type === 'gps-frozen' && i.tripId === bus.id));
  assert.equal(ops.reports[0].kind, 'came');
  assert.equal(ops.reports[0].busNo, bus.busNo);
});

test('a sighting re-places a bus whose GPS dropped out', async () => {
  const { bus, clock } = await findBus((b) => b.status === 'estimated' || b.status === 'lost');
  const { stopId } = stopDueNow(bus, clock);
  await report({ kind: 'came', stopId, lineId: bus.lineId, dir: bus.dir, tripId: bus.id }, clock);
  const after = (await get('/api/buses', clock)).body.buses.find((b) => b.id === bus.id);
  assert.equal(after.confirmedBy, 'passenger');
  assert.equal(after.gpsFault, false);
});

test('two people saying a bus did not come drop it from arrival times; one does not', async () => {
  const clock = 540;
  const p = patterns.AEB[0];
  const idx = 2;
  const stopId = p.stopIds[idx];
  const before = await arrivals(stopId, 'AEB', 0, clock);
  const target = before.find((a) => a.source === 'timetable');
  assert.ok(target?.tripId, 'arrivals carry a trip id');
  const body = { kind: 'missed', stopId, lineId: 'AEB', dir: 0, tripId: target.tripId };

  await report(body, clock);
  const once = await arrivals(stopId, 'AEB', 0, clock);
  assert.equal(once.find((a) => a.tripId === target.tripId)?.reports?.missed, 1, 'one report: shown, not dropped');

  await report(body, clock);
  const twice = await arrivals(stopId, 'AEB', 0, clock);
  assert.equal(twice.find((a) => a.tripId === target.tripId), undefined, 'two reports: dropped');

  const ops = (await get('/api/reports', clock)).body;
  const issue = ops.issues.find((i) => i.type === 'no-show' && i.tripId === target.tripId);
  assert.equal(issue.count, 2);
  assert.equal(issue.gps, 'none');
});

test('"too full" follows the bus to the stops further along, and shows up as crowding', async () => {
  // A live bus with at least two stops still to go where you can get on.
  const { bus, clock } = await findBus((b) => {
    if (b.status !== 'live' || b.lineId !== 'L01') return false;
    const ids = patterns[b.lineId][b.dir].stopIds;
    return ids.indexOf(b.nextStopId) <= ids.length - 3;
  });
  const { stopId, pattern } = stopDueNow(bus, clock);
  await report({ kind: 'full', stopId, lineId: bus.lineId, dir: bus.dir, tripId: bus.id }, clock);
  const later = pattern.stopIds[pattern.stopIds.indexOf(bus.nextStopId) + 1];
  const next = (await arrivals(later, bus.lineId, bus.dir, clock)).find((a) => a.tripId === bus.id);
  assert.ok(next, 'the bus is still coming to the later stop');
  assert.equal(next.reports.full, true);
  const ops = (await get('/api/reports', clock)).body;
  assert.ok(ops.issues.some((i) => i.type === 'crowded' && i.lineId === 'L01' && i.count === 1));
});

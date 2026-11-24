// Simulated timetable and live bus positions.
// Buses leave each terminal every `headwayMin` between serviceStart and
// serviceEnd. Ride times come from segment length / line speed + dwell time.
// The planner and the live map share this model, so the ETAs shown match the
// buses moving on the map.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stops, lines } from './data/network.js';
import { haversine, polylineLength, pointAlong } from './geo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHAPES_FILE = path.join(here, 'data', 'shapes.json');

export const ROAD_FACTOR = 1.3; // straight-line -> street distance when no road shape is known
export const DWELL_MIN = 0.5;
const DAY = 24 * 60;

export const stopById = new Map(stops.map((s) => [s.id, s]));
export const lineById = new Map(lines.map((l) => [l.id, l]));

/** Road geometry per line: { [lineId]: [[ [lat,lng], ... ] per segment ] } (forward direction). */
function loadShapes() {
  try {
    return JSON.parse(fs.readFileSync(SHAPES_FILE, 'utf8'));
  } catch {
    return {};
  }
}
const shapes = loadShapes();
export const hasRoadShapes = Object.keys(shapes).length > 0;

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Pre-computed timing for one direction of a line.
 * dir 0 follows `line.stops` order, dir 1 is the reverse.
 */
function buildPattern(line, dir) {
  const ids = dir === 0 ? [...line.stops] : [...line.stops].reverse();
  const fwdSegments = line.stops.slice(1).map((id, i) => {
    const shaped = shapes[line.id]?.[i];
    if (shaped && shaped.length >= 2) return shaped;
    const a = stopById.get(line.stops[i]);
    const b = stopById.get(id);
    return [[a.lat, a.lng], [b.lat, b.lng]];
  });
  const segments = dir === 0 ? fwdSegments : [...fwdSegments].reverse().map((s) => [...s].reverse());
  const mPerMin = (line.speedKmh * 1000) / 60;
  const offsets = [0];
  const segMinutes = segments.map((seg, i) => {
    const shaped = Boolean(shapes[line.id]);
    const meters = shaped ? polylineLength(seg) : haversine(stopById.get(ids[i]), stopById.get(ids[i + 1])) * ROAD_FACTOR;
    const minutes = meters / mPerMin + DWELL_MIN;
    offsets.push(offsets[i] + minutes);
    return minutes;
  });
  return {
    lineId: line.id,
    dir,
    stopIds: ids,
    segments,
    segMinutes,
    offsets,
    tripMinutes: offsets[offsets.length - 1],
    headsign: stopById.get(ids[ids.length - 1]).name,
    firstDeparture: toMin(line.serviceStart),
    lastDeparture: toMin(line.serviceEnd),
    headway: line.headwayMin,
  };
}

/** patterns[lineId][dir] */
export const patterns = Object.fromEntries(lines.map((l) => [l.id, [buildPattern(l, 0), buildPattern(l, 1)]]));

/** Every (pattern, index) pair where a bus can be boarded at this stop (not the last stop of a direction). */
export const boardingsAtStop = new Map(stops.map((s) => [s.id, []]));
for (const line of lines) {
  for (const p of patterns[line.id]) {
    p.stopIds.forEach((id, idx) => {
      if (idx < p.stopIds.length - 1) boardingsAtStop.get(id).push({ pattern: p, idx });
    });
  }
}

/**
 * Time (minutes since local midnight, may exceed 1440 for tomorrow) at which the
 * next bus of `pattern` reaches stop index `idx` at or after `t`.
 */
export function nextArrival(pattern, idx, t) {
  const offset = pattern.offsets[idx];
  for (const dayShift of [0, DAY]) {
    const tt = t - dayShift;
    const k = Math.max(0, Math.ceil((tt - offset - pattern.firstDeparture) / pattern.headway));
    const departure = pattern.firstDeparture + k * pattern.headway;
    if (departure <= pattern.lastDeparture) return departure + offset + dayShift;
  }
  return null;
}

/** Next `count` arrivals at a stop for one pattern. */
export function upcomingArrivals(pattern, idx, t, count = 3) {
  const out = [];
  let cursor = t;
  while (out.length < count) {
    const at = nextArrival(pattern, idx, cursor);
    if (at === null) break;
    out.push(at);
    cursor = at + 0.01;
  }
  return out;
}

/**
 * Where a bus is `elapsed` minutes after leaving its terminal (timetable pace).
 * Returns null before departure or after the trip ends.
 */
export function positionAt(pattern, elapsed) {
  if (elapsed < 0 || elapsed > pattern.tripMinutes) return null;
  const seg = Math.max(0, pattern.offsets.findIndex((o, i) => i > 0 && o >= elapsed) - 1);
  const frac = pattern.segMinutes[seg] ? (elapsed - pattern.offsets[seg]) / pattern.segMinutes[seg] : 0;
  const [lat, lng] = pointAlong(pattern.segments[seg], Math.min(1, Math.max(0, frac)));
  return { lat, lng, seg, nextStopId: pattern.stopIds[seg + 1] };
}

/** Scheduled departures (minutes since midnight) of a pattern whose trips overlap [from, to]. */
export function departuresBetween(pattern, from, to) {
  const out = [];
  let k = Math.max(0, Math.ceil((from - pattern.tripMinutes - pattern.firstDeparture) / pattern.headway));
  for (; ; k++) {
    const dep = pattern.firstDeparture + k * pattern.headway;
    if (dep > to || dep > pattern.lastDeparture) break;
    out.push({ dep, k });
  }
  return out;
}

/**
 * Every place along a pattern's path that a GPS point could be: roads that
 * double back (into a stop and out again) make a point match more than once.
 * Each candidate is in timetable minutes from the terminal.
 */
export function projectCandidates(pattern, point, slackM = 25) {
  const kx = Math.cos((point.lat * Math.PI) / 180) * 111320;
  const ky = 110540;
  const hits = [];
  pattern.segments.forEach((seg, s) => {
    const lens = [];
    let total = 0;
    for (let i = 1; i < seg.length; i++) {
      lens.push(Math.hypot((seg[i][1] - seg[i - 1][1]) * kx, (seg[i][0] - seg[i - 1][0]) * ky));
      total += lens[i - 1];
    }
    let walked = 0;
    for (let i = 1; i < seg.length; i++) {
      const ax = (seg[i - 1][1] - point.lng) * kx;
      const ay = (seg[i - 1][0] - point.lat) * ky;
      const bx = (seg[i][1] - point.lng) * kx;
      const by = (seg[i][0] - point.lat) * ky;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const u = len2 ? Math.min(1, Math.max(0, -(ax * (bx - ax) + ay * (by - ay)) / len2)) : 0;
      const offM = Math.hypot(ax + u * (bx - ax), ay + u * (by - ay));
      const frac = total ? (walked + u * lens[i - 1]) / total : 0;
      hits.push({ minutes: pattern.offsets[s] + frac * pattern.segMinutes[s], offM });
      walked += lens[i - 1];
    }
  });
  const bestOff = Math.min(...hits.map((h) => h.offM));
  const close = hits.filter((h) => h.offM <= bestOff + slackM).sort((a, b) => a.minutes - b.minutes);
  // Merge neighbouring hits of the same pass along the road; keep the closest of each.
  const passes = [];
  for (const h of close) {
    const last = passes.at(-1);
    if (last && h.minutes - last.end < 0.25) {
      last.end = h.minutes;
      if (h.offM < last.best.offM) last.best = h;
    } else passes.push({ end: h.minutes, best: h });
  }
  return passes.map((p) => p.best);
}

/**
 * Snap a GPS point onto a pattern's path and return how far along it is, in
 * timetable minutes from the terminal (plus the distance off the path).
 */
export function project(pattern, point) {
  const kx = Math.cos((point.lat * Math.PI) / 180) * 111320;
  const ky = 110540;
  let best = { minutes: 0, offM: Infinity };
  pattern.segments.forEach((seg, s) => {
    const lens = [];
    let total = 0;
    for (let i = 1; i < seg.length; i++) {
      const dx = (seg[i][1] - seg[i - 1][1]) * kx;
      const dy = (seg[i][0] - seg[i - 1][0]) * ky;
      lens.push(Math.hypot(dx, dy));
      total += lens[i - 1];
    }
    let walked = 0;
    for (let i = 1; i < seg.length; i++) {
      const ax = (seg[i - 1][1] - point.lng) * kx;
      const ay = (seg[i - 1][0] - point.lat) * ky;
      const bx = (seg[i][1] - point.lng) * kx;
      const by = (seg[i][0] - point.lat) * ky;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const u = len2 ? Math.min(1, Math.max(0, -(ax * (bx - ax) + ay * (by - ay)) / len2)) : 0;
      const off = Math.hypot(ax + u * (bx - ax), ay + u * (by - ay));
      if (off < best.offM) {
        const frac = total ? (walked + u * lens[i - 1]) / total : 0;
        best = { minutes: pattern.offsets[s] + frac * pattern.segMinutes[s], offM: off };
      }
      walked += lens[i - 1];
    }
  });
  return best;
}

/** Full geometry of a line (forward direction) for drawing on the map. */
export function lineGeometry(lineId) {
  const segs = patterns[lineId][0].segments;
  return segs.flatMap((s, i) => (i === 0 ? s : s.slice(1)));
}

/** Sub-geometry of a ride from index a to index b on a pattern. */
export function rideGeometry(pattern, fromIdx, toIdx) {
  return pattern.segments.slice(fromIdx, toIdx).flatMap((s, i) => (i === 0 ? s : s.slice(1)));
}

/** Current time in Phnom Penh as minutes since midnight (DEMO_CLOCK=HH:MM overrides the start). */
const bootMs = Date.now();
export function nowMinutes() {
  if (process.env.DEMO_CLOCK) {
    return (toMin(process.env.DEMO_CLOCK) + (Date.now() - bootMs) / 60000) % DAY;
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return get('hour') * 60 + get('minute') + get('second') / 60;
}

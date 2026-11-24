// Data fusion: turns raw GPS fixes + the timetable into bus positions and
// arrival predictions passengers can trust.
//
//   GPS fresh (≤ 1 min)            -> "live"       shown where GPS says, delay measured
//   GPS silent (1–10 min)          -> "estimated"  moved along the route at the measured delay
//   GPS silent (> 10 min)          -> "lost"       faded, shown at estimate, low confidence
//   GPS fresh but not moving 5+ min
//   away from a terminal           -> "suspect"    likely a frozen unit / ghost bus;
//                                                  ignored for arrival times
// Arrivals prefer live > estimated > timetable, and always say which one it is.
import { patterns, projectCandidates, positionAt, departuresBetween } from './schedule.js';
import { gpsFeed } from './simulation.js';
import { haversine } from './geo.js';

export const LIVE_MAX_AGE_MIN = 1;
export const ESTIMATE_MAX_AGE_MIN = 10;
const STUCK_RADIUS_M = 25;
export const STUCK_MIN = 5;

const round1 = (x) => Math.round(x * 10) / 10;

/** How long (minutes) the reported position has not changed, using the fix history. */
function stillForMin(entry) {
  let still = 0;
  for (const h of entry.history) {
    if (haversine(h, entry.fix) > STUCK_RADIUS_M) break;
    still = entry.fix.t - h.t;
  }
  return still;
}

/**
 * Where along its route the bus is, in timetable minutes. When the road doubles
 * back and the point matches several places, pick the one that fits the bus's
 * earlier fix (it moved forward at a believable pace), then the timetable.
 */
function locateOnRoute(pattern, e) {
  const cands = projectCandidates(pattern, e.fix);
  if (cands.length === 1) return cands[0].minutes;
  const onTime = e.fix.t - e.scheduledDep; // progress if exactly on time
  const prior = (m) => (m > onTime + 1 ? (m - onTime) * 3 : (onTime - m) * 0.3); // early is rarer than late
  // Use the OLDEST fix where the bus was somewhere else: a short look-back can be
  // ambiguous in the same way when a route covers the same road twice.
  const prev = [...e.history].reverse().find((h) => haversine(h, e.fix) > 40 && h.t < e.fix.t);
  const prevCands = prev ? projectCandidates(pattern, prev) : [];
  let best = null;
  for (const c of cands) {
    let cost = prior(c.minutes) * 0.2;
    if (prevCands.length) {
      const dt = e.fix.t - prev.t;
      cost += Math.min(...prevCands.map((p) => {
        const moved = c.minutes - p.minutes;
        return moved < -0.2 ? 99 : Math.abs(moved - dt) * (moved > dt ? 2 : 0.5); // can't go backwards or faster than the timetable
      }));
    } else {
      cost = prior(c.minutes);
    }
    if (!best || cost < best.cost) best = { minutes: c.minutes, cost };
  }
  return best.minutes;
}

/** Fuse one GPS feed snapshot into vehicles with a status and a best-estimate position. */
export function fuse(t, feed = gpsFeed(t)) {
  const vehicles = [];
  for (const e of feed) {
    const pattern = patterns[e.lineId][e.dir];
    const ageMin = t - e.fix.t;
    const snapped = { minutes: locateOnRoute(pattern, e) };
    const base = {
      id: e.vehicleId,
      busNo: e.busNo,
      lineId: e.lineId,
      dir: e.dir,
      headsign: pattern.headsign,
      scheduledDep: e.scheduledDep,
      gpsAgeMin: round1(ageMin),
      lastFix: { lat: e.fix.lat, lng: e.fix.lng },
    };

    const still = stillForMin(e);
    const nearTerminal = snapped.minutes < 0.6 || snapped.minutes > pattern.tripMinutes - 0.6;
    if (still >= STUCK_MIN && !nearTerminal) {
      vehicles.push({ ...base, status: 'suspect', lat: e.fix.lat, lng: e.fix.lng, stillMin: Math.round(still), delayMin: null, progressMin: null });
      continue;
    }

    // Delay = when it was there minus when the timetable says it should have been there.
    const delayMin = e.fix.t - e.scheduledDep - snapped.minutes;
    const progressMin = ageMin <= LIVE_MAX_AGE_MIN ? snapped.minutes + ageMin : t - e.scheduledDep - delayMin;
    if (progressMin > pattern.tripMinutes + 1) continue; // trip is over

    const status = ageMin <= LIVE_MAX_AGE_MIN ? 'live' : ageMin <= ESTIMATE_MAX_AGE_MIN ? 'estimated' : 'lost';
    const pos = status === 'live' ? e.fix : positionAt(pattern, Math.min(Math.max(progressMin, 0), pattern.tripMinutes));
    vehicles.push({
      ...base,
      status,
      lat: pos.lat,
      lng: pos.lng,
      delayMin: round1(delayMin),
      progressMin,
      nextStopId: positionAt(pattern, Math.min(Math.max(progressMin, 0), pattern.tripMinutes))?.nextStopId ?? null,
    });
  }
  return vehicles;
}

// Fusion is recomputed at most every 15 s (the GPS report interval).
let cache = { key: null, vehicles: [] };
export function vehiclesAt(t) {
  const key = Math.floor(t * 4);
  if (cache.key !== key) cache = { key, vehicles: fuse(t) };
  return cache.vehicles;
}

export function summarize(vehicles) {
  const s = { live: 0, estimated: 0, lost: 0, suspect: 0 };
  for (const v of vehicles) s[v.status]++;
  return s;
}

/**
 * Next arrivals of one line direction at a stop (index into the pattern), best source first:
 * tracked buses use their measured delay, untracked trips fall back to the timetable.
 */
export function predictArrivals(pattern, idx, t, vehicles = vehiclesAt(t), count = 3) {
  const stopOffset = pattern.offsets[idx];
  const out = [];
  const tracked = new Set();
  for (const v of vehicles) {
    if (v.lineId !== pattern.lineId || v.dir !== pattern.dir || v.status === 'suspect') continue;
    tracked.add(v.scheduledDep);
    if (v.progressMin >= stopOffset - 0.2) continue; // already past this stop
    out.push({
      at: t + (stopOffset - v.progressMin),
      source: v.status === 'live' ? 'live' : 'estimated',
      delayMin: v.delayMin,
      busNo: v.busNo,
      vehicleId: v.id,
      gpsAgeMin: v.gpsAgeMin,
    });
  }
  for (const { dep } of departuresBetween(pattern, t, t + 240)) {
    if (tracked.has(dep)) continue;
    const at = dep + stopOffset;
    if (at < t - 0.5) continue; // should already have passed
    out.push({ at, source: 'timetable', delayMin: null, busNo: null, vehicleId: null, gpsAgeMin: null });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, count);
}

/** Add a live prediction to the first bus leg of each itinerary (when the passenger reaches the stop). */
export function annotateWithRealtime(plan, t) {
  const vehicles = vehiclesAt(t);
  for (const opt of plan.options) {
    const leg = opt.legs.find((l) => l.type === 'bus');
    if (!leg) continue;
    const pattern = patterns[leg.lineId][leg.dir];
    const idx = pattern.stopIds.indexOf(leg.from.stopId);
    const atStop = leg.departMin - leg.waitMin;
    const next = predictArrivals(pattern, idx, t, vehicles, 6).find((p) => p.at >= atStop - 0.1);
    if (next) leg.realtime = next;
  }
  return plan;
}

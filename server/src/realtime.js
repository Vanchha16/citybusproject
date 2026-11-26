// Data fusion: turns raw GPS fixes + the timetable into bus positions and
// arrival predictions passengers can trust.
//
//   GPS fresh (≤ 1 min)            -> "live"       shown where GPS says, delay measured
//   GPS silent (1–10 min)          -> "estimated"  moved along the route at the measured delay
//   GPS silent (> 10 min)          -> "lost"       faded, shown at estimate, low confidence
//   GPS fresh but not moving 5+ min
//   away from a terminal           -> "suspect"    likely a frozen unit / ghost bus;
//                                                  ignored for arrival times
//
// Passengers fill the gaps (reports.js): "the bus is here" places a bus whose GPS is
// lost or frozen, "it didn't come" from two people drops a ghost bus, and "too full"
// follows the bus to the next stops.
//
// Arrivals prefer live > estimated > timetable, and always say which one it is.
import { patterns, projectCandidates, positionAt, departuresBetween, stopById } from './schedule.js';
import { gpsFeed } from './simulation.js';
import { haversine } from './geo.js';
import {
  reports as reportStore, byTrip, tripSummary, tripIdOf, parseTripId,
  MISSED_TO_DROP, SIGHTING_MAX_AGE_MIN, FULL_MAX_AGE_MIN, MISSED_MAX_AGE_MIN,
} from './reports.js';

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
 * Where along its route the bus is, in timetable minutes. When the road doubles back
 * (out and back along one street, a loop at a terminal) the point matches several places.
 * Replay each one: if the bus is really there now, then moving at its pace it was
 * Δt minutes further back along the route when each earlier fix was taken. The place whose
 * replay lands closest to where GPS actually put the bus earlier wins; the timetable only
 * breaks ties (and decides when there is no earlier fix).
 */
function locateOnRoute(pattern, e) {
  const cands = projectCandidates(pattern, e.fix);
  if (cands.length === 1) return cands[0].minutes;
  const onTime = e.fix.t - e.scheduledDep; // progress if exactly on time
  const prior = (m) => (m > onTime + 1 ? (m - onTime) * 3 : (onTime - m) * 0.3); // early is rarer than late
  const past = e.history.filter((h) => h.t < e.fix.t);
  let best = null;
  for (const c of cands) {
    let cost = prior(c.minutes) * 0.05;
    if (past.length) {
      let miss = 0;
      for (const h of past) {
        const back = c.minutes - (e.fix.t - h.t);
        // A few seconds "before the start" is rounding (the bus was at its terminal); more is the wrong place.
        const then = back >= -0.25 ? positionAt(pattern, Math.max(0, back)) : null;
        miss += then ? Math.min(haversine(then, h), 1000) : 1000;
      }
      cost += miss / past.length / 50; // 50 m average mismatch ≈ 1
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

const REPORT_WINDOW_MIN = Math.max(SIGHTING_MAX_AGE_MIN, FULL_MAX_AGE_MIN, MISSED_MAX_AGE_MIN);

/** What passengers said recently, per trip: Map tripId -> summary (see reports.js). */
export function reportIndex(t, store = reportStore) {
  const index = new Map();
  for (const [tripId, list] of byTrip(store.since(t, REPORT_WINDOW_MIN))) {
    const trip = parseTripId(tripId);
    const pattern = trip && patterns[trip.lineId]?.[trip.dir];
    if (!pattern) continue;
    const offsetOf = (stopId) => {
      const i = pattern.stopIds.indexOf(stopId);
      return i < 0 ? null : pattern.offsets[i];
    };
    const sum = tripSummary(list, t, offsetOf);
    if (sum) index.set(tripId, sum);
  }
  return index;
}

/** The part of a trip's reports that buses and arrivals carry to the app. */
export function publicReports(sum, t) {
  if (!sum) return null;
  return {
    seen: sum.seen
      ? { stopId: sum.seen.stopId, stopName: stopById.get(sum.seen.stopId).name, minAgo: Math.max(0, Math.round(t - sum.seen.at)) }
      : null,
    missed: sum.missed,
    full: sum.full,
  };
}

/**
 * Let passenger reports correct the GPS picture:
 *  - seen at a stop after the last good GPS fix (or GPS frozen) -> placed from the sighting
 *  - MISSED_TO_DROP people say it didn't come, and GPS isn't live -> suspect, ignored
 */
export function applyReports(vehicles, t, index) {
  if (!index.size) return vehicles;
  const out = [];
  for (const v of vehicles) {
    const sum = index.get(v.id);
    if (!sum) { out.push(v); continue; }
    const pattern = patterns[v.lineId][v.dir];
    const withReports = { ...v, reports: publicReports(sum, t) };
    const { seen } = sum;
    const gpsFixAt = t - v.gpsAgeMin;
    if (seen && (v.status === 'suspect' || (v.status !== 'live' && seen.at > gpsFixAt))) {
      if (seen.progress > pattern.tripMinutes + 1) continue; // seen near the end: the trip is over
      const pos = positionAt(pattern, Math.min(Math.max(seen.progress, 0), pattern.tripMinutes));
      const { stillMin, ...rest } = withReports;
      out.push({
        ...rest,
        status: 'estimated',
        confirmedBy: 'passenger',
        gpsFault: v.status === 'suspect', // GPS unit frozen, but passengers see the bus moving
        lat: pos.lat,
        lng: pos.lng,
        delayMin: round1(seen.at - v.scheduledDep - seen.offset),
        progressMin: seen.progress,
        nextStopId: pos.nextStopId,
      });
      continue;
    }
    if (sum.missed >= MISSED_TO_DROP && v.status !== 'live') {
      out.push({ ...withReports, status: 'suspect', reason: 'passengers', delayMin: null, progressMin: null });
      continue;
    }
    out.push(withReports);
  }
  return out;
}

// Fusion is recomputed at most every 15 s (the GPS report interval), or when a passenger reports.
let cache = { key: null, vehicles: [], index: new Map() };
function current(t) {
  const key = `${Math.floor(t * 4)}|${reportStore.version}`;
  if (cache.key !== key) {
    const index = reportIndex(t);
    cache = { key, index, vehicles: applyReports(fuse(t), t, index) };
  }
  return cache;
}
export const vehiclesAt = (t) => current(t).vehicles;
export const reportIndexAt = (t) => current(t).index;

export function summarize(vehicles) {
  const s = { live: 0, estimated: 0, lost: 0, suspect: 0 };
  for (const v of vehicles) s[v.status]++;
  return s;
}

/**
 * Next arrivals of one line direction at a stop (index into the pattern), best source first:
 * tracked buses use their measured delay, untracked trips fall back to the timetable.
 */
export function predictArrivals(pattern, idx, t, vehicles = vehiclesAt(t), count = 3, index = reportIndexAt(t)) {
  const stopOffset = pattern.offsets[idx];
  const out = [];
  const tracked = new Set();
  for (const v of vehicles) {
    if (v.lineId !== pattern.lineId || v.dir !== pattern.dir) continue;
    if (v.status === 'suspect') {
      // A frozen GPS unit says nothing about the trip, so the timetable still counts.
      // Passengers saying it never came does: drop the trip altogether.
      if (v.reason === 'passengers') tracked.add(v.scheduledDep);
      continue;
    }
    tracked.add(v.scheduledDep);
    if (v.progressMin >= stopOffset - 0.2) continue; // already past this stop
    out.push({
      at: t + (stopOffset - v.progressMin),
      source: v.status === 'live' ? 'live' : 'estimated',
      delayMin: v.delayMin,
      busNo: v.busNo,
      vehicleId: v.id,
      gpsAgeMin: v.gpsAgeMin,
      tripId: v.id,
      ...(v.confirmedBy && { confirmedBy: v.confirmedBy }),
      ...(v.reports && { reports: v.reports }),
    });
  }
  for (const { dep } of departuresBetween(pattern, t, t + 240)) {
    if (tracked.has(dep)) continue;
    const at = dep + stopOffset;
    if (at < t - 0.5) continue; // should already have passed
    const tripId = tripIdOf(pattern.lineId, pattern.dir, dep);
    const sum = index.get(tripId);
    if (sum && sum.missed >= MISSED_TO_DROP) continue; // passengers say this trip isn't running
    const reports = publicReports(sum, t);
    out.push({ at, source: 'timetable', delayMin: null, busNo: null, vehicleId: null, gpsAgeMin: null, tripId, ...(reports && { reports }) });
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

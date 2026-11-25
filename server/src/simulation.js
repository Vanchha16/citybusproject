// Simulated GPS feed (AVL) that reproduces the problems passengers report about
// the official app: buses running late, GPS signal dropping out ("bus missing
// from the map"), and frozen GPS units that keep reporting the same spot ("ghost
// bus shown on the map but nothing comes"). Everything is deterministic: the
// same trip always behaves the same, so demos are repeatable.
//
// In production this file is replaced by the operator's real GPS feed; the
// fusion layer (realtime.js) only sees fixes, exactly like it would there.
import { lines } from './data/dataset.js';
import { patterns, positionAt, departuresBetween } from './schedule.js';

const REPORT_EVERY_MIN = 0.25; // a GPS unit reports every 15 s
const GHOST_LINGER_MIN = 25; // frozen units keep reporting after the bus has gone

/** Deterministic pseudo-random number in [0,1) for (trip, salt). */
function rand(id, salt) {
  let h = 2166136261;
  const s = `${id}#${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** How a given trip behaves today: how late it runs and what its GPS does. */
export function tripProfile(pattern, dep, k) {
  const id = `${pattern.lineId}-${pattern.dir}-${dep}`;
  const lateMin = rand(id, 'late') < 0.35 ? 1 + Math.floor(rand(id, 'lateBy') * 12) : 0;
  const g = rand(id, 'gps');
  const at = (lo, hi) => lo + rand(id, 'at') * (hi - lo);
  let gps = { kind: 'ok' };
  if (g < 0.12) {
    const from = at(2, pattern.tripMinutes * 0.7);
    gps = { kind: 'dropout', from, to: from + 3 + rand(id, 'len') * 10 };
  } else if (g < 0.17) {
    gps = { kind: 'frozen', from: at(3, pattern.tripMinutes * 0.6) };
  }
  const code = lines.find((l) => l.id === pattern.lineId).code;
  return { id, dep, lateMin, gps, busNo: `${code}-${String((k % 18) + 1).padStart(2, '0')}` };
}

/** The bus's true position at time t (what you'd see standing on the street). */
export function truePosition(pattern, profile, t) {
  return positionAt(pattern, t - profile.dep - profile.lateMin);
}

/** The latest GPS fix the unit has sent at or before time t, or null if it never has. */
export function gpsFixAt(pattern, profile, t) {
  const start = profile.dep + profile.lateMin;
  let reportT = Math.floor(t / REPORT_EVERY_MIN) * REPORT_EVERY_MIN;
  if (reportT < start) return null;
  const { gps } = profile;
  if (gps.kind === 'dropout' && reportT >= start + gps.from && reportT < start + gps.to) {
    reportT = start + gps.from; // signal lost: the last fix is from before the dropout
  }
  if (gps.kind === 'frozen' && reportT >= start + gps.from) {
    // Unit keeps sending fresh timestamps but the coordinates never change.
    if (reportT > start + pattern.tripMinutes + GHOST_LINGER_MIN) return null;
    const stuck = positionAt(pattern, gps.from);
    return { t: reportT, lat: stuck.lat, lng: stuck.lng };
  }
  const pos = positionAt(pattern, reportT - start);
  if (!pos) return null; // trip finished, unit switched off
  return { t: reportT, lat: pos.lat, lng: pos.lng };
}

/** Every vehicle reporting at time t, with its fix now and a few minutes ago (history buffer). */
export function gpsFeed(t, historyMin = [2, 4, 6, 8, 10, 15]) {
  const feed = [];
  for (const line of lines) {
    for (const pattern of patterns[line.id]) {
      for (const { dep, k } of departuresBetween(pattern, t - 60, t)) {
        const profile = tripProfile(pattern, dep, k);
        const fix = gpsFixAt(pattern, profile, t);
        if (!fix || t - fix.t > 30) continue; // silent for 30+ min: no longer listed
        feed.push({
          vehicleId: profile.id,
          busNo: profile.busNo,
          lineId: line.id,
          dir: pattern.dir,
          scheduledDep: dep,
          fix,
          history: historyMin.map((m) => gpsFixAt(pattern, profile, t - m)).filter(Boolean),
          // Ground truth for tests and the demo legend only — never used for predictions.
          _truth: { lateMin: profile.lateMin, gps: profile.gps.kind, position: truePosition(pattern, profile, t) },
        });
      }
    }
  }
  return feed;
}

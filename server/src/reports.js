// Passenger reports: the third source of truth, next to GPS and the timetable.
//
// At a stop, a passenger can say about the bus they are waiting for:
//   came    "The bus is here"       a sighting: a position fix that needs no GPS
//   missed  "It didn't come"        evidence of a ghost bus or a cancelled trip
//   full    "Too full to get on"    crowding, shown to the next passengers and the operator
//
// How the fusion layer uses them (realtime.js):
//   - a sighting newer than the bus's last GPS fix re-places the bus and measures its
//     delay; it also keeps tracking buses whose GPS unit froze ("suspect")
//   - MISSED_TO_DROP "didn't come" reports from different people drop that bus
//     from arrival times (unless its GPS is live)
//   - "full" travels with the bus to the stops further along its route
//
// Reports live in memory (one store per server instance), which is fine for the
// prototype. In production they belong in a shared store (database or Redis) so
// every instance, and the operator, sees the same reports.

export const KINDS = ['came', 'missed', 'full'];
export const SIGHTING_MAX_AGE_MIN = 20; // a sighting places the bus for this long
export const FULL_MAX_AGE_MIN = 30;
export const MISSED_MAX_AGE_MIN = 30;
export const MISSED_TO_DROP = 2; // distinct people
const KEEP_MS = 3 * 60 * 60 * 1000;
const MAX_REPORTS = 5000;

/** Trip ids look like `${lineId}-${dir}-${scheduledDeparture}` (the same id the GPS feed uses). */
export const tripIdOf = (lineId, dir, dep) => `${lineId}-${dir}-${dep}`;
export function parseTripId(id) {
  const m = /^(.+)-([01])-(\d{1,4})$/.exec(String(id ?? ''));
  return m ? { lineId: m[1], dir: Number(m[2]), dep: Number(m[3]) } : null;
}

/**
 * In-memory report store. `at` is network time (minutes since midnight, the same clock
 * as the request, so demo-clock reports stay with demo-clock passengers).
 */
export function createReportStore(clock = () => Date.now()) {
  let list = [];
  let version = 0;

  const prune = () => {
    const now = clock();
    list = list.filter((r) => now - r.receivedMs < KEEP_MS);
    if (list.length > MAX_REPORTS) list = list.slice(-MAX_REPORTS);
  };

  return {
    /** Bumps on every change, so caches built from reports know when to rebuild. */
    get version() { return version; },

    /** Add a report. The same person reporting the same thing about the same bus again replaces it. */
    add({ kind, stopId, lineId, dir, tripId, at, client }) {
      prune();
      const same = (r) => r.client === client && r.tripId === tripId && r.kind === kind;
      const duplicate = list.some(same);
      list = list.filter((r) => !same(r));
      list.push({ kind, stopId, lineId, dir, tripId, at, client, receivedMs: clock() });
      version++;
      return { duplicate };
    },

    /** Reports made in the last `minutes` of network time, oldest first. */
    since(t, minutes) {
      return list.filter((r) => t - r.at >= -0.1 && t - r.at <= minutes);
    },

    clear() { list = []; version++; },
  };
}

/** The store the API uses. */
export const reports = createReportStore();

/**
 * What passengers have said about one trip. `offsetOf(stopId)` gives the stop's position
 * along the route (timetable minutes), so the newest and furthest sighting wins.
 * Returns null when nobody has said anything recent.
 */
export function tripSummary(list, t, offsetOf) {
  let seen = null;
  for (const r of list) {
    if (r.kind !== 'came' || t - r.at > SIGHTING_MAX_AGE_MIN) continue;
    const offset = offsetOf(r.stopId);
    if (offset == null) continue;
    // Where the bus would be now, going by this sighting: later and further along wins.
    const progress = offset + (t - r.at);
    if (!seen || progress > seen.progress + 0.01) seen = { stopId: r.stopId, at: r.at, offset, progress };
  }
  // "Didn't come" only counts if nobody saw the bus after it.
  const missedBy = new Set(
    list
      .filter((r) => r.kind === 'missed' && t - r.at <= MISSED_MAX_AGE_MIN && (!seen || r.at > seen.at))
      .map((r) => r.client),
  );
  const fullAt = list.filter((r) => r.kind === 'full' && t - r.at <= FULL_MAX_AGE_MIN).map((r) => r.at);
  const full = fullAt.length > 0;
  if (!seen && !missedBy.size && !full) return null;
  return {
    seen,
    missed: missedBy.size,
    full,
    fullMinAgo: full ? Math.max(0, Math.round(t - Math.max(...fullAt))) : null,
  };
}

/** Group recent reports by trip id. */
export function byTrip(list) {
  const map = new Map();
  for (const r of list) {
    if (!map.has(r.tripId)) map.set(r.tripId, []);
    map.get(r.tripId).push(r);
  }
  return map;
}

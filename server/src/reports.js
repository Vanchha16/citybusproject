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
// Where reports live: each server keeps them in memory. On Vercel the API can run as
// several copies at once, so with a shared Redis (Upstash, connected in Vercel → Storage)
// every copy also writes each report there and re-reads the list every few seconds:
// a report sent to one copy shows up on all of them, and on the operator page.
// Without Redis settings it is memory only (fine for one server, like `npm run dev`).

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

const SYNC_EVERY_MS = 3000;
const REDIS_KEY = 'citybus:reports';

/** Upstash Redis over its REST API (no client library). `null` when not configured. */
export function redisFromEnv(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return {
    /** Run several commands in one round trip; returns each command's result. */
    async pipeline(commands) {
      const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`Redis ${res.status}`);
      const out = await res.json();
      const failed = out.find((r) => r.error);
      if (failed) throw new Error(`Redis: ${failed.error}`);
      return out.map((r) => r.result);
    },
  };
}

/**
 * Report store. `at` is network time (minutes since midnight, the same clock as the
 * request, so demo-clock reports stay with demo-clock passengers). With `redis`, reports
 * are shared between server copies (see the top of this file).
 */
export function createReportStore({ clock = () => Date.now(), redis = null } = {}) {
  let list = [];
  let version = 0;
  let lastSync = -Infinity;
  let syncing = null;

  /** Drop old reports; the same person saying the same thing about the same bus again: keep the newest. */
  const keep = (items) => {
    const now = clock();
    const seen = new Set();
    const out = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const r = items[i];
      const k = `${r.client}|${r.tripId}|${r.kind}`;
      if (now - r.receivedMs >= KEEP_MS || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out.reverse().slice(-MAX_REPORTS);
  };

  return {
    /** 'shared' (Redis) or 'memory'. */
    mode: redis ? 'shared' : 'memory',

    /** Bumps on every change, so caches built from reports know when to rebuild. */
    get version() { return version; },

    /** Add a report. The same person reporting the same thing about the same bus again replaces it. */
    async add({ kind, stopId, lineId, dir, tripId, at, client }) {
      const report = { kind, stopId, lineId, dir, tripId, at, client, receivedMs: clock() };
      const duplicate = list.some((r) => r.client === client && r.tripId === tripId && r.kind === kind);
      list = keep([...list, report]);
      version++;
      if (redis) {
        try {
          await redis.pipeline([
            ['LPUSH', REDIS_KEY, JSON.stringify(report)],
            ['LTRIM', REDIS_KEY, 0, MAX_REPORTS - 1],
            ['PEXPIRE', REDIS_KEY, KEEP_MS],
          ]);
        } catch (err) {
          console.warn('[reports] could not share a report, kept on this server only:', err.message);
        }
      }
      return { duplicate };
    },

    /** Pick up reports other server copies received (at most every few seconds). */
    async sync() {
      if (!redis || clock() - lastSync < SYNC_EVERY_MS) return;
      if (syncing) return syncing;
      lastSync = clock();
      syncing = (async () => {
        try {
          const [raw] = await redis.pipeline([['LRANGE', REDIS_KEY, 0, -1]]);
          const shared = (raw ?? [])
            .map((x) => { try { return JSON.parse(x); } catch { return null; } })
            .filter(Boolean)
            .reverse();
          // Merge with what this copy holds, in case one of its writes to Redis failed.
          const merged = keep([...shared, ...list].sort((x, y) => x.receivedMs - y.receivedMs));
          const sig = (l) => `${l.length}|${l[0]?.receivedMs ?? 0}|${l.at(-1)?.receivedMs ?? 0}`;
          if (sig(merged) !== sig(list)) { list = merged; version++; }
        } catch (err) {
          console.warn('[reports] could not read shared reports:', err.message);
        } finally {
          syncing = null;
        }
      })();
      return syncing;
    },

    /** Reports made in the last `minutes` of network time, oldest first. */
    since(t, minutes) {
      return list.filter((r) => t - r.at >= -0.1 && t - r.at <= minutes);
    },

    /** Forget everything on this server (tests). */
    clear() { list = []; version++; lastSync = -Infinity; },
  };
}

/** The store the API uses. */
export const reports = createReportStore({ redis: redisFromEnv() });

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

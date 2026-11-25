// Protects the "ask" endpoint on a public site, so nobody can run up an AI bill.
//
//   1. Flood guard: more than ASK_PER_MINUTE questions a minute from one person -> 429.
//   2. Per-person AI budget: AI_PER_HOUR Claude answers per hour; after that the free
//      keyword engine answers instead (the passenger still gets a route).
//   3. Site-wide AI budget: AI_PER_DAY Claude answers per day per server instance.
//
// Counters live in memory, so on Vercel each running instance counts on its own —
// good enough as a cost guard for a prototype. For a hard global cap, also add a
// Vercel Firewall rate-limit rule or move these counters to a shared store.

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const limits = () => ({
  askPerMinute: num(process.env.ASK_PER_MINUTE, 10),
  aiPerHour: num(process.env.AI_PER_HOUR, 20),
  aiPerDay: num(process.env.AI_PER_DAY, 300),
  reportsPer10Min: num(process.env.REPORTS_PER_10_MIN, 12),
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Sliding-window counter per key. */
class Window {
  constructor(ms) { this.ms = ms; this.hits = new Map(); }
  count(key, now) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.ms);
    this.hits.set(key, list);
    return list.length;
  }
  add(key, now) { this.count(key, now); this.hits.get(key).push(now); }
  /** Milliseconds until the oldest hit leaves the window. */
  retryIn(key, now) { const list = this.hits.get(key) ?? []; return list.length ? this.ms - (now - list[0]) : 0; }
  /** Drop idle keys so memory stays small. */
  sweep(now) { for (const [k, list] of this.hits) if (!list.some((t) => now - t < this.ms)) this.hits.delete(k); }
}

export function createLimiter(clock = () => Date.now()) {
  const perMinute = new Window(MINUTE);
  const aiPerHour = new Window(HOUR);
  const aiPerDay = new Window(DAY);
  let lastSweep = clock();

  return {
    /** Call once per question. Returns { allowed, retryAfterSec, useAI }. */
    check(clientId, aiAvailable) {
      const now = clock();
      if (now - lastSweep > 5 * MINUTE) { perMinute.sweep(now); aiPerHour.sweep(now); lastSweep = now; }
      const l = limits();
      if (perMinute.count(clientId, now) >= l.askPerMinute) {
        return { allowed: false, retryAfterSec: Math.ceil(perMinute.retryIn(clientId, now) / 1000), useAI: false };
      }
      perMinute.add(clientId, now);
      const useAI = aiAvailable
        && aiPerHour.count(clientId, now) < l.aiPerHour
        && aiPerDay.count('all', now) < l.aiPerDay;
      if (useAI) { aiPerHour.add(clientId, now); aiPerDay.add('all', now); }
      return { allowed: true, retryAfterSec: 0, useAI };
    },
  };
}

/** Passenger reports: at most REPORTS_PER_10_MIN per person, so one phone can't fake a ghost bus. */
export function createReportLimiter(clock = () => Date.now()) {
  const win = new Window(10 * MINUTE);
  let lastSweep = clock();
  return {
    check(clientId) {
      const now = clock();
      if (now - lastSweep > 5 * MINUTE) { win.sweep(now); lastSweep = now; }
      if (win.count(clientId, now) >= limits().reportsPer10Min) {
        return { allowed: false, retryAfterSec: Math.ceil(win.retryIn(clientId, now) / 1000) };
      }
      win.add(clientId, now);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** Best guess at who is asking. On Vercel these headers are set by the platform. */
export function clientId(req) {
  const fwd = req.get('x-vercel-forwarded-for') || req.get('x-real-ip') || req.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

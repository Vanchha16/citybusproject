// Demo mode pins the server's clock to a time of day (e.g. 09:00) that keeps running
// from when the demo started, so a rehearsal at night still shows buses.
let demoClock = null; // { startMinutes, startedAt }
export function setDemoClock(startMinutes) {
  demoClock = startMinutes == null ? null : { startMinutes, startedAt: Date.now() };
}
const demoHeaders = () =>
  demoClock ? { 'X-Demo-Clock': String((demoClock.startMinutes + (Date.now() - demoClock.startedAt) / 60000) % 1440) } : {};

async function request(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...(options.headers ?? {}), ...demoHeaders() } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();

export const api = {
  network: () => request('/api/network'),
  buses: () => request('/api/buses'),
  search: (q, near) => request(`/api/search?${qs({ q, nearLat: near?.lat, nearLng: near?.lng })}`),
  nearby: (p) => request(`/api/nearby?${qs({ lat: p.lat, lng: p.lng })}`),
  arrivals: ({ stopId, lineId, dir }) => request(`/api/arrivals?${qs({ stopId, lineId, dir })}`),
  plan: (from, to) =>
    request(`/api/plan?${qs({ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng })}`),
  /** A passenger's report about the bus at their stop: kind = came | missed | full. */
  report: ({ kind, stopId, lineId, dir, tripId }) =>
    request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, stopId, lineId, dir, tripId }),
    }),
  reports: () => request('/api/reports'),
  ask: (message, location) =>
    request('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, location }),
    }),
};

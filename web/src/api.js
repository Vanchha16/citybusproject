async function request(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
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
  ask: (message, location) =>
    request('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, location }),
    }),
};

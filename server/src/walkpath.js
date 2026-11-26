// Walking paths along real streets, for drawing a route's walk legs on the map.
//
// The planner times walks from straight-line distance (× a road factor), which is quick
// and needs no network. Only the drawing asks a foot router for the street path:
// OpenStreetMap's public foot routing (routing.openstreetmap.de, run by FOSSGIS) by
// default, or any OSRM server with a foot profile (WALK_ROUTER_URL; empty = off).
// Results are cached; if the router is slow or down, the straight line is used.
import { haversine } from './geo.js';

const DEFAULT_ROUTER = 'https://routing.openstreetmap.de/routed-foot';
const MAX_WALK_M = 5000; // longer than any walk the planner makes
const CACHE_SIZE = 500;
const round = (x) => Math.round(x * 1e5) / 1e5;

export function createWalkPaths({ router = process.env.WALK_ROUTER_URL ?? DEFAULT_ROUTER, timeoutMs = 4000 } = {}) {
  const cache = new Map();
  const remember = (key, value) => {
    cache.set(key, value);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value); // oldest first
  };

  return {
    enabled: Boolean(router),

    /** { source: 'streets' | 'straight', geometry: [[lat, lng], ...] } from `from` to `to`. */
    async path(from, to) {
      const straight = { source: 'straight', geometry: [[from.lat, from.lng], [to.lat, to.lng]] };
      if (!router || haversine(from, to) > MAX_WALK_M) return straight;
      const key = [from.lat, from.lng, to.lat, to.lng].map((v) => v.toFixed(5)).join(',');
      if (cache.has(key)) return cache.get(key);
      try {
        const url = `${router.replace(/\/$/, '')}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'citybus-prototype (CamDX hackathon demo)' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = await res.json();
        const coords = body.routes?.[0]?.geometry?.coordinates;
        if (body.code !== 'Ok' || !coords?.length) return straight;
        // Start and end exactly where the passenger and the stop are.
        const result = {
          source: 'streets',
          geometry: [[from.lat, from.lng], ...coords.map(([lng, lat]) => [round(lat), round(lng)]), [to.lat, to.lng]],
        };
        remember(key, result);
        return result;
      } catch {
        return straight; // router slow or down: don't cache, try again next time
      }
    },
  };
}

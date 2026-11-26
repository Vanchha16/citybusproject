// Walk legs drawn along real streets (from /api/walk-path), and moving a point along a path.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Street paths for walk legs, shared by every route option: key = "lat,lng>lat,lng".
const walkPathCache = new Map();
const walkKey = (leg) => `${leg.from.lat.toFixed(5)},${leg.from.lng.toFixed(5)}>${leg.to.lat.toFixed(5)},${leg.to.lng.toFixed(5)}`;

/** The route with its walk legs drawn along real streets once known (straight lines until then). */
export function useStreetWalks(option) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!option) return undefined;
    let alive = true;
    for (const leg of option.legs) {
      if (leg.type !== 'walk' || walkPathCache.has(walkKey(leg))) continue;
      walkPathCache.set(walkKey(leg), null); // asked already
      api.walkPath(leg.from, leg.to)
        .then((r) => {
          if (r.source !== 'streets') return;
          walkPathCache.set(walkKey(leg), r.geometry);
          if (alive) setVersion((v) => v + 1);
        })
        .catch(() => walkPathCache.delete(walkKey(leg))); // try again next time
    }
    return () => { alive = false; };
  }, [option]);
  if (!option) return option;
  const legs = option.legs.map((l) => (l.type === 'walk' && walkPathCache.get(walkKey(l)) ? { ...l, geometry: walkPathCache.get(walkKey(l)) } : l));
  return legs.some((l, i) => l !== option.legs[i]) ? { ...option, legs } : option;
}

/** The point `f` (0..1) of the way along a path of [lat, lng] points. */
export function alongPath(points, f) {
  const seg = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], (p[1] - points[i][1]) * Math.cos((p[0] * Math.PI) / 180)));
  let left = seg.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, left / seg[i]) : 1;
      return { lat: points[i][0] + (points[i + 1][0] - points[i][0]) * t, lng: points[i][1] + (points[i + 1][1] - points[i][1]) * t };
    }
    left -= seg[i];
  }
  return { lat: points.at(-1)[0], lng: points.at(-1)[1] };
}

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Length in metres of a polyline given as [[lat,lng], ...]. */
export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine({ lat: points[i - 1][0], lng: points[i - 1][1] }, { lat: points[i][0], lng: points[i][1] });
  }
  return total;
}

/** Point at `fraction` (0..1) of the way along a polyline. Returns [lat,lng]. */
export function pointAlong(points, fraction) {
  if (points.length === 1 || fraction <= 0) return points[0];
  if (fraction >= 1) return points[points.length - 1];
  const target = polylineLength(points) * fraction;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = { lat: points[i - 1][0], lng: points[i - 1][1] };
    const b = { lat: points[i][0], lng: points[i][1] };
    const seg = haversine(a, b);
    if (walked + seg >= target) {
      const f = seg === 0 ? 0 : (target - walked) / seg;
      return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f];
    }
    walked += seg;
  }
  return points[points.length - 1];
}

/** Compass bearing in degrees from a to b. */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

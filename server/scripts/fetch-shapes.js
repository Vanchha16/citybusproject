// Fetch road geometry between consecutive stops of every line from the public OSRM
// demo router and cache it in the active network's shapes file (src/data/shapes.json
// for the sample, src/data/imported/shapes.json for imported GTFS data).
// Run with `npm run shapes` whenever stops or lines change. Lines that already have a
// shape (e.g. from the GTFS feed) are kept; `--all` re-fetches everything.
// The app works without this file (it falls back to straight lines).
import fs from 'node:fs';
import { stops, lines, SHAPES_FILE as OUT } from '../src/data/dataset.js';

const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org';
const stopById = new Map(stops.map((s) => [s.id, s]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x) => Math.round(x * 1e5) / 1e5;
const refetchAll = process.argv.includes('--all');

async function route(a, b) {
  const url = `${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': 'citybus-prototype' } });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const body = await res.json();
  if (body.code !== 'Ok' || !body.routes?.length) throw new Error(`OSRM: ${body.code}`);
  return body.routes[0].geometry.coordinates.map(([lng, lat]) => [round(lat), round(lng)]);
}

let existing = {};
try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* none yet */ }
const shapes = {};
// Each line's stop list, plus the way back when it uses different stops.
const jobs = lines.flatMap((l) => [
  { key: l.id, seq: l.stops },
  ...(l.stopsBack ? [{ key: `${l.id}:back`, seq: l.stopsBack }] : []),
]);
for (const { key, seq } of jobs) {
  if (!refetchAll && existing[key]?.length === seq.length - 1) {
    shapes[key] = existing[key];
    console.log(`  ${key}: kept`);
    continue;
  }
  shapes[key] = [];
  for (let i = 1; i < seq.length; i++) {
    const a = stopById.get(seq[i - 1]);
    const b = stopById.get(seq[i]);
    let seg;
    try {
      seg = await route(a, b);
      // Pin the ends exactly on the stops so buses stop where the markers are.
      seg = [[a.lat, a.lng], ...seg, [b.lat, b.lng]];
    } catch (err) {
      console.warn(`  ${key} ${a.id} -> ${b.id}: ${err.message}, using a straight line`);
      seg = [[a.lat, a.lng], [b.lat, b.lng]];
    }
    shapes[key].push(seg);
    process.stdout.write('.');
    await sleep(1100); // be polite to the free demo server
  }
  console.log(` ${key}`);
}
fs.writeFileSync(OUT, JSON.stringify(shapes));
console.log(`Saved ${OUT}`);

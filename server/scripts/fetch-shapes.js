// One-off: fetch road geometry between consecutive stops of every line from the
// public OSRM demo router and cache it in src/data/shapes.json.
// Run with `npm run shapes` whenever stops or lines change. The app works
// without this file (it falls back to straight lines).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stops, lines } from '../src/data/network.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'data', 'shapes.json');
const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org';
const stopById = new Map(stops.map((s) => [s.id, s]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x) => Math.round(x * 1e5) / 1e5;

async function route(a, b) {
  const url = `${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': 'citybus-prototype' } });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const body = await res.json();
  if (body.code !== 'Ok' || !body.routes?.length) throw new Error(`OSRM: ${body.code}`);
  return body.routes[0].geometry.coordinates.map(([lng, lat]) => [round(lat), round(lng)]);
}

const shapes = {};
for (const line of lines) {
  shapes[line.id] = [];
  for (let i = 1; i < line.stops.length; i++) {
    const a = stopById.get(line.stops[i - 1]);
    const b = stopById.get(line.stops[i]);
    let seg;
    try {
      seg = await route(a, b);
      // Pin the ends exactly on the stops so buses stop where the markers are.
      seg = [[a.lat, a.lng], ...seg, [b.lat, b.lng]];
    } catch (err) {
      console.warn(`  ${line.id} ${a.id} -> ${b.id}: ${err.message}, using a straight line`);
      seg = [[a.lat, a.lng], [b.lat, b.lng]];
    }
    shapes[line.id].push(seg);
    process.stdout.write('.');
    await sleep(1100); // be polite to the free demo server
  }
  console.log(` ${line.id}`);
}
fs.writeFileSync(OUT, JSON.stringify(shapes));
console.log(`Saved ${OUT}`);

// GTFS -> City Bus network. Turns an official timetable feed (the standard format
// transit agencies publish: a .zip of CSV files) into the stops and lines the app
// runs on. Pure functions, so the conversion is tested without files; the command
// line wrapper is scripts/import-gtfs.js.
//
// What the app models, and how GTFS maps onto it:
//   stop            <- stops.txt (only stops a line uses), Khmer names from translations.txt
//   line            <- routes.txt: code = route_short_name, name = route_long_name
//   line.stops      <- the most common stop pattern of direction 0
//   line.stopsBack  <- the most common pattern of direction 1, when it is not simply
//                      the reverse (one-way streets); otherwise the app reverses line.stops
//   headway, hours  <- frequencies.txt, or the gaps between trip start times
//   speed           <- scheduled trip duration vs. route length
//   road shapes     <- shapes.txt, cut at each stop
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { haversine, polylineLength } from './geo.js';

const DWELL_MIN = 0.5; // keep in step with schedule.js
const ROAD_FACTOR = 1.3;
const MAX_STOP_TO_SHAPE_M = 150;
const PALETTE = ['#1d4ed8', '#b91c1c', '#15803d', '#7e22ce', '#a16207', '#0e7490', '#be185d', '#4338ca', '#9a3412', '#3f6212', '#334155', '#86198f'];
const AIRPORT_NAME = /airport|អាកាសយានដ្ឋាន|ព្រលានយន្តហោះ/i;

// ---------- Reading files ----------

/** RFC 4180 CSV -> array of objects keyed by the header row. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (!nonEmpty.length) return [];
  const keys = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** Files of a .zip archive: { name: Buffer }. Stored and deflated entries (what GTFS feeds use). */
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new Error('ZIP64 archives are not supported: unzip it and import the folder');
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip (central directory)');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`Corrupt zip (${name})`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = zlib.inflateRawSync(data);
    else throw new Error(`${name}: unsupported zip compression (${method})`);
  }
  return out;
}

const TABLES = ['agency', 'feed_info', 'stops', 'routes', 'trips', 'stop_times', 'frequencies', 'calendar', 'shapes', 'translations'];

/** Read a GTFS feed from a .zip or a folder: { stops: [...], routes: [...], ... }. */
export function readGtfs(source) {
  const raw = {};
  if (fs.statSync(source).isDirectory()) {
    for (const t of TABLES) {
      const f = path.join(source, `${t}.txt`);
      if (fs.existsSync(f)) raw[t] = fs.readFileSync(f, 'utf8');
    }
  } else {
    for (const [name, data] of Object.entries(readZip(fs.readFileSync(source)))) {
      const t = path.basename(name).replace(/\.txt$/i, '');
      if (TABLES.includes(t)) raw[t] = data.toString('utf8'); // files may sit in a sub-folder
    }
  }
  return Object.fromEntries(Object.entries(raw).map(([t, text]) => [t, parseCsv(text)]));
}

// ---------- Helpers ----------

/** "25:10:00" -> 1510 (GTFS times may pass midnight). */
export function gtfsMinutes(hms) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hms ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 60 : null;
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
/** Darken a colour until white text on it passes WCAG AA (4.5:1), like the line badges need. */
export function readableColor(hex) {
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let k = 0; k < 40 && 1.05 / (luminance(rgb) + 0.05) < 4.5; k++) rgb = rgb.map((c) => Math.floor(c * 0.92));
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** translations.txt -> lookup(table, field, recordId, value) for Khmer. */
function khmerLookup(rows = []) {
  const byRecord = new Map();
  const byValue = new Map();
  for (const r of rows) {
    if (!/^km/i.test(r.language ?? '')) continue;
    if (r.record_id) byRecord.set(`${r.table_name}|${r.field_name}|${r.record_id}`, r.translation);
    if (r.field_value) byValue.set(`${r.table_name}|${r.field_name}|${r.field_value}`, r.translation);
  }
  return (table, field, id, value) => byRecord.get(`${table}|${field}|${id}`) ?? byValue.get(`${table}|${field}|${value}`) ?? null;
}

/** Cut a shape at each stop: one polyline per pair of consecutive stops, ends pinned on the stops. */
export function cutShape(points, stopsInOrder) {
  const idxs = [];
  let from = 0;
  for (const st of stopsInOrder) {
    let best = -1;
    let bestM = Infinity;
    // Search forward from the previous stop and take the first close pass, so a road
    // that passes the same stop twice is cut where the bus actually stops.
    for (let i = from; i < points.length; i++) {
      const m = haversine(st, { lat: points[i][0], lng: points[i][1] });
      if (m < bestM - 0.01) { bestM = m; best = i; }
      if (bestM <= MAX_STOP_TO_SHAPE_M && m > bestM + 300) break; // moving away again
    }
    if (best < 0 || bestM > MAX_STOP_TO_SHAPE_M) return null;
    idxs.push(best);
    from = best;
  }
  return stopsInOrder.slice(1).map((b, k) => {
    const a = stopsInOrder[k];
    return [[a.lat, a.lng], ...points.slice(idxs[k] + 1, idxs[k + 1]), [b.lat, b.lng]];
  });
}

// ---------- Conversion ----------

/**
 * Convert parsed GTFS tables into { network: { meta, stops, lines }, shapes, warnings }.
 * `places` (the app's landmarks) help recognise airport lines.
 */
export function convertGtfs(feed, { places = [], source = 'gtfs' } = {}) {
  const warnings = [];
  for (const t of ['stops', 'routes', 'trips', 'stop_times']) {
    if (!feed[t]?.length) throw new Error(`${t}.txt is missing or empty: this does not look like a GTFS feed`);
  }
  const km = khmerLookup(feed.translations);
  const stopRow = new Map(feed.stops.map((s) => [s.stop_id, s]));

  // Which service days to model: a weekday service with the most trips (the "normal day").
  const tripCount = new Map();
  for (const t of feed.trips) tripCount.set(t.service_id, (tripCount.get(t.service_id) ?? 0) + 1);
  const weekday = new Set((feed.calendar ?? []).filter((c) => c.monday === '1' || c.wednesday === '1').map((c) => c.service_id));
  const ranked = [...tripCount.keys()].sort((a, b) => (weekday.has(b) - weekday.has(a)) || tripCount.get(b) - tripCount.get(a));
  const mainService = ranked[0];

  // Stop times per trip, in order.
  const timesByTrip = new Map();
  for (const st of feed.stop_times) {
    if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, []);
    timesByTrip.get(st.trip_id).push(st);
  }
  for (const list of timesByTrip.values()) list.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

  const freqByTrip = new Map();
  for (const f of feed.frequencies ?? []) {
    if (!freqByTrip.has(f.trip_id)) freqByTrip.set(f.trip_id, []);
    freqByTrip.get(f.trip_id).push(f);
  }

  const shapePts = new Map();
  for (const p of feed.shapes ?? []) {
    if (!shapePts.has(p.shape_id)) shapePts.set(p.shape_id, []);
    shapePts.get(p.shape_id).push(p);
  }
  for (const [id, list] of shapePts) {
    list.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence));
    shapePts.set(id, list.map((p) => [Number(p.shape_pt_lat), Number(p.shape_pt_lon)]));
  }

  const usedStops = new Set();
  const lines = [];
  const shapes = {};
  const airportPlaces = places.filter((p) => p.category === 'airport');
  const tripsByRoute = new Map();
  for (const t of feed.trips) {
    if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, []);
    tripsByRoute.get(t.route_id).push(t);
  }

  feed.routes.forEach((route, routeNo) => {
    const code = route.route_short_name || route.route_id;
    let trips = (tripsByRoute.get(route.route_id) ?? []).filter((t) => timesByTrip.get(t.trip_id)?.length >= 2);
    if (!trips.length) { warnings.push(`Line ${code}: no trips with stop times, skipped`); return; }
    // Model the normal day; a route that never runs on it uses its own busiest service.
    const onMain = trips.filter((t) => t.service_id === mainService);
    if (onMain.length) trips = onMain;
    else {
      const own = new Map();
      for (const t of trips) own.set(t.service_id, (own.get(t.service_id) ?? 0) + 1);
      const busiest = [...own].sort((a, b) => b[1] - a[1])[0][0];
      trips = trips.filter((t) => t.service_id === busiest);
    }

    // The most common stop pattern in each direction.
    const seqOf = (t) => timesByTrip.get(t.trip_id).map((s) => s.stop_id);
    const patternsByDir = [new Map(), new Map()];
    const firstPattern = seqOf(trips[0]).join('>');
    for (const t of trips) {
      const seq = seqOf(t);
      let dir = t.direction_id === '1' ? 1 : t.direction_id === '0' ? 0 : null;
      if (dir === null) dir = seq[0] === firstPattern.split('>')[0] ? 0 : 1; // no direction_id: guess by first stop
      const key = seq.join('>');
      const m = patternsByDir[dir];
      if (!m.has(key)) m.set(key, { seq, trips: [] });
      m.get(key).trips.push(t);
    }
    const main = patternsByDir.map((m) => [...m.values()].sort((a, b) => b.trips.length - a.trips.length)[0] ?? null);
    if (!main[0]) { main[0] = main[1]; main[1] = null; }
    const fwd = main[0];
    const back = main[1];
    const missing = fwd.seq.find((id) => !stopRow.has(id));
    if (missing) { warnings.push(`Line ${code}: stop ${missing} is not in stops.txt, skipped`); return; }

    const sameAsReverse = back && back.seq.length === fwd.seq.length && back.seq.every((id, i) => id === fwd.seq[fwd.seq.length - 1 - i]);
    const stopsBack = back && !sameAsReverse && back.seq.every((id) => stopRow.has(id)) ? back.seq : null;
    if (!back) warnings.push(`Line ${code}: trips run in one direction only; the app also shows the way back (reverse order)`);
    if (stopsBack) warnings.push(`Line ${code}: the way back uses different stops (${stopsBack.length} vs ${fwd.seq.length}); kept as its own stop list`);
    const otherPatterns = patternsByDir.reduce((n, m) => n + Math.max(0, m.size - 1), 0);
    if (otherPatterns) warnings.push(`Line ${code}: ${otherPatterns} less common stop pattern(s) (short trips, variants) not modelled`);

    // Departures from the first stop, expanded from frequencies.txt where given.
    const startsOf = (pattern) => pattern.trips.flatMap((t) => {
      const freqs = freqByTrip.get(t.trip_id);
      const first = gtfsMinutes(timesByTrip.get(t.trip_id)[0].departure_time || timesByTrip.get(t.trip_id)[0].arrival_time);
      if (!freqs) return first == null ? [] : [first];
      return freqs.flatMap((f) => {
        const a = gtfsMinutes(f.start_time);
        const b = gtfsMinutes(f.end_time);
        const h = Number(f.headway_secs) / 60;
        if (a == null || b == null || !(h > 0)) return [];
        const out = [];
        for (let x = a; x < b; x += h) out.push(x);
        return out;
      });
    });
    const starts = startsOf(fwd).sort((a, b) => a - b);
    const gaps = starts.slice(1).map((x, i) => x - starts[i]).filter((g) => g > 0.5);
    let headwayMin = Math.round(median(gaps) ?? 60);
    if (!gaps.length) warnings.push(`Line ${code}: only one trip a day; modelled as hourly`);
    headwayMin = Math.max(2, Math.min(headwayMin, 120));
    let first = starts[0];
    let last = starts.at(-1);
    if (last >= 24 * 60) { warnings.push(`Line ${code}: service runs past midnight; modelled until 23:59`); last = 24 * 60 - 1; }
    if (first >= 24 * 60) first = 0;

    // Road shape of each direction, cut at the stops.
    const pointOf = (id) => ({ lat: Number(stopRow.get(id).stop_lat), lng: Number(stopRow.get(id).stop_lon) });
    const shapeFor = (pattern, seq) => {
      const id = pattern.trips.find((t) => t.shape_id && shapePts.has(t.shape_id))?.shape_id;
      if (!id) return null;
      const segs = cutShape(shapePts.get(id), seq.map(pointOf));
      if (!segs) warnings.push(`Line ${code}: a stop is more than ${MAX_STOP_TO_SHAPE_M} m from shape ${id}; straight lines used`);
      return segs;
    };
    const lineId = route.route_id;
    const fwdShape = shapeFor(fwd, fwd.seq);
    if (fwdShape) shapes[lineId] = fwdShape;
    if (stopsBack) {
      const backShape = shapeFor(back, stopsBack);
      if (backShape) shapes[`${lineId}:back`] = backShape;
    }

    // Speed: the scheduled time from first to last stop over the route length (minus stop dwell).
    const durations = fwd.trips.map((t) => {
      const st = timesByTrip.get(t.trip_id);
      const a = gtfsMinutes(st[0].departure_time || st[0].arrival_time);
      const b = gtfsMinutes(st.at(-1).arrival_time || st.at(-1).departure_time);
      return a != null && b != null ? b - a : null;
    }).filter((d) => d > 0);
    const meters = fwdShape
      ? fwdShape.reduce((sum, seg) => sum + polylineLength(seg), 0)
      : fwd.seq.slice(1).reduce((sum, id, i) => sum + haversine(pointOf(fwd.seq[i]), pointOf(id)) * ROAD_FACTOR, 0);
    const moving = (median(durations) ?? 0) - DWELL_MIN * (fwd.seq.length - 1);
    let speedKmh = moving > 0 ? (meters / 1000) / (moving / 60) : 18;
    if (!durations.length) warnings.push(`Line ${code}: no usable stop times; assumed 18 km/h`);
    speedKmh = Math.round(Math.max(6, Math.min(speedKmh, 70)) * 10) / 10;

    const en = route.route_long_name || `${stopRow.get(fwd.seq[0]).stop_name} – ${stopRow.get(fwd.seq.at(-1)).stop_name}`;
    const kmName = km('routes', 'route_long_name', route.route_id, route.route_long_name) ?? en;
    const nearAirport = [...fwd.seq, ...(stopsBack ?? [])].some((id) => airportPlaces.some((p) => haversine(pointOf(id), p) < 1500));
    const kind = AIRPORT_NAME.test(`${route.route_short_name} ${route.route_long_name} ${route.route_desc ?? ''}`) || nearAirport ? 'airport' : 'city';
    const color = readableColor(/^[0-9a-f]{6}$/i.test(route.route_color ?? '') ? `#${route.route_color}` : PALETTE[routeNo % PALETTE.length]);

    for (const id of fwd.seq) usedStops.add(id);
    for (const id of stopsBack ?? []) usedStops.add(id);
    lines.push({
      id: lineId,
      code,
      color,
      kind,
      name: { en, km: kmName },
      headwayMin,
      speedKmh,
      serviceStart: hhmm(first),
      serviceEnd: hhmm(last),
      stops: fwd.seq,
      ...(stopsBack && { stopsBack }),
    });
  });

  if (!lines.length) throw new Error('No usable lines in this feed');
  const stops = [...usedStops].map((id) => {
    const s = stopRow.get(id);
    return {
      id,
      name: { en: s.stop_name, km: km('stops', 'stop_name', id, s.stop_name) ?? s.stop_name },
      lat: Number(s.stop_lat),
      lng: Number(s.stop_lon),
    };
  });
  const untranslated = stops.filter((s) => s.name.km === s.name.en).length;
  if (untranslated) warnings.push(`${untranslated} of ${stops.length} stops have no Khmer name (translations.txt); the English name is shown in Khmer mode`);

  const agency = feed.agency?.[0]?.agency_name;
  const info = feed.feed_info?.[0];
  return {
    network: {
      meta: {
        name: info?.feed_publisher_name || agency || 'GTFS feed',
        version: info?.feed_version || null,
        source,
        importedAt: new Date().toISOString(),
        service: mainService,
      },
      stops,
      lines,
    },
    shapes,
    warnings,
  };
}

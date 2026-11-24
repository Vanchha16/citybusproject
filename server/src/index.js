import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stops, lines, places } from './data/network.js';
import { patterns, lineGeometry, nowMinutes, boardingsAtStop, hasRoadShapes, stopById } from './schedule.js';
import { vehiclesAt, summarize, predictArrivals, annotateWithRealtime } from './realtime.js';
import { planTrip, stopsNear, linesServing } from './planner.js';
import { searchPlaces } from './search.js';
import { understand, resolvePlace, aiEnabled } from './assistant.js';
import { composeAnswer } from './describe.js';
import { haversine } from './geo.js';
import { createLimiter, clientId } from './ratelimit.js';

const app = express();
app.use(express.json({ limit: '20kb' }));
const limiter = createLimiter();

// Demo mode: the app can ask for the network "as at" a time of day (X-Demo-Clock header,
// minutes since midnight), so a demo or rehearsal at night still shows buses running.
app.use('/api', (req, _res, next) => {
  const raw = req.get('x-demo-clock');
  const demo = raw === undefined ? NaN : Number(raw);
  req.now = Number.isFinite(demo) && demo >= 0 && demo < 1440 ? demo : nowMinutes();
  next();
});

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
function pointFromQuery(q, prefix) {
  const lat = num(q[prefix ? `${prefix}Lat` : 'lat']);
  const lng = num(q[prefix ? `${prefix}Lng` : 'lng']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
const startTime = (req) => {
  const t = num(req.query.time);
  return Number.isFinite(t) ? t : req.now;
};

/** Nearby stops with their next buses, plus nearby places. */
function nearby(point, t) {
  const nearStops = stopsNear(point, 1500).slice(0, 5).map(({ stop, meters }) => ({
    stopId: stop.id,
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    meters: Math.round(meters),
    departures: boardingsAtStop.get(stop.id).map(({ pattern, idx }) => ({
      lineId: pattern.lineId,
      dir: pattern.dir,
      headsign: pattern.headsign,
      arrivals: predictArrivals(pattern, idx, t, vehiclesAt(t), 2),
    })).sort((a, b) => (a.arrivals[0]?.at ?? Infinity) - (b.arrivals[0]?.at ?? Infinity)),
  }));
  const nearPlaces = places
    .map((p) => ({ id: p.id, name: p.name, category: p.category, lat: p.lat, lng: p.lng, meters: Math.round(haversine(point, p)) }))
    .filter((p) => p.meters <= 2500)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 6);
  return { stops: nearStops, places: nearPlaces };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiEnabled, roadShapes: hasRoadShapes, now: nowMinutes() }));

app.get('/api/network', (req, res) => {
  res.json({
    stops,
    places,
    lines: lines.map((l) => ({
      ...l,
      geometry: lineGeometry(l.id),
      headsigns: patterns[l.id].map((p) => p.headsign),
    })),
    ai: aiEnabled,
    now: req.now,
  });
});

app.get('/api/search', (req, res) => {
  const near = pointFromQuery(req.query, 'near');
  res.json(searchPlaces(String(req.query.q ?? ''), near));
});

app.get('/api/nearby', (req, res) => {
  const point = pointFromQuery(req.query, '');
  if (!point) return res.status(400).json({ error: 'lat and lng are required' });
  res.json(nearby(point, startTime(req)));
});

app.get('/api/lines-serving', (req, res) => {
  const point = pointFromQuery(req.query, '');
  if (!point) return res.status(400).json({ error: 'lat and lng are required' });
  res.json(linesServing(point));
});

app.get('/api/plan', (req, res) => {
  const from = pointFromQuery(req.query, 'from');
  const to = pointFromQuery(req.query, 'to');
  if (!from || !to) return res.status(400).json({ error: 'fromLat, fromLng, toLat and toLng are required' });
  const t = startTime(req);
  res.json(annotateWithRealtime(planTrip(from, to, t), t));
});

app.get('/api/buses', (req, res) => {
  const t = req.now;
  const vehicles = vehiclesAt(t).map(({ progressMin, scheduledDep, ...v }) => v);
  res.json({ now: t, buses: vehicles, summary: summarize(vehicles) });
});

/** Next arrivals of one line at one stop — used by the "bus is coming" alert. */
app.get('/api/arrivals', (req, res) => {
  const { stopId, lineId } = req.query;
  const dir = Number(req.query.dir);
  const pattern = patterns[lineId]?.[dir];
  const idx = pattern ? pattern.stopIds.indexOf(stopId) : -1;
  if (idx < 0 || idx === pattern.stopIds.length - 1) {
    return res.status(400).json({ error: 'Unknown stopId/lineId/dir combination' });
  }
  const t = req.now;
  res.json({
    now: t,
    stop: stopById.get(stopId),
    lineId,
    dir,
    headsign: pattern.headsign,
    arrivals: predictArrivals(pattern, idx, t, vehiclesAt(t), 3),
  });
});

app.post('/api/assistant', async (req, res) => {
  const message = String(req.body?.message ?? '').trim().slice(0, 500);
  if (!message) return res.status(400).json({ error: 'message is required' });
  const loc = req.body?.location;
  const here = loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? { lat: loc.lat, lng: loc.lng } : null;

  // Flood guard + AI budget (see ratelimit.js). Over the AI budget, the free keyword engine answers.
  const gate = limiter.check(clientId(req), aiEnabled);
  if (!gate.allowed) {
    res.set('Retry-After', String(gate.retryAfterSec));
    return res.status(429).json({ error: 'Too many questions. Please try again in a minute.', retryAfterSec: gate.retryAfterSec });
  }
  const u = await understand(message, { allowAI: gate.useAI });
  const lang = u.language === 'km' ? 'km' : 'en';
  const originPlace = resolvePlace(u.origin_place_id);
  const origin = originPlace
    ? { ...originPlace, label: originPlace.name }
    : here
      ? { lat: here.lat, lng: here.lng, label: { en: 'your location', km: 'ទីតាំងរបស់អ្នក' }, isCurrentLocation: true }
      : null;
  const destination = resolvePlace(u.destination_place_id);
  const t = req.now;

  if (!origin && destination) {
    return res.json({
      engine: u.engine, language: lang, intent: u.intent, destination, origin: null, plan: null,
      answer: lang === 'km'
        ? 'សូមបើកទីតាំង (GPS) ឬប្រាប់ខ្ញុំថាអ្នកចាប់ផ្តើមពីណា ឧទាហរណ៍៖ «ពីផ្សារធំថ្មី ទៅអាកាសយានដ្ឋាន»។'
        : 'Please turn on location, or tell me where you are starting from, e.g. "from Central Market to the airport".',
    });
  }
  if (u.intent === 'nearby' && origin) {
    const near = nearby(origin, t);
    const list = near.stops.slice(0, 3).map((s) => `• ${s.name[lang]} (${s.meters} m)`).join('\n');
    return res.json({
      engine: u.engine, language: lang, intent: 'nearby', origin, destination: null, plan: null, nearby: near,
      answer: (lang === 'km' ? 'ចំណតឡានក្រុងនៅជិតអ្នក៖\n' : 'Bus stops near you:\n') + (list || (lang === 'km' ? 'មិនមានចំណតក្បែរនេះទេ។' : 'No stops nearby.')),
    });
  }

  const plan = origin && destination ? annotateWithRealtime(planTrip(origin, destination, t), t) : null;
  const servingLineCodes = plan ? plan.servingLines.map((s) => lines.find((l) => l.id === s.lineId).code) : [];
  const note = u.unknown_place
    ? u.note || (lang === 'km' ? `ខ្ញុំមិនស្គាល់ «${u.unknown_place}» នៅឡើយទេ។` : `I don't know "${u.unknown_place}" yet.`)
    : u.note;
  res.json({
    engine: u.engine, language: lang, intent: u.intent, origin, destination, plan,
    answer: composeAnswer({ lang, origin, destination, plan, note, servingLineCodes }),
  });
});

// Unknown API paths answer in JSON, like the rest of the API.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built web app in production (`npm run build && npm start`).
const srcDir = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(srcDir, '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  // Client mistakes (e.g. malformed JSON, body too large) are 4xx, not server errors.
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.type === 'entity.parse.failed' ? 'Invalid JSON body' : err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export { app };

// Start listening only when run directly (`node src/index.js`), not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  app.listen(port, () => {
    console.log(`City Bus API on http://localhost:${port}  (AI: ${aiEnabled ? 'Claude' : 'keyword fallback — set ANTHROPIC_API_KEY to enable'})`);
  });
}

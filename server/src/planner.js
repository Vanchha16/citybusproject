// Trip planner: time-dependent Dijkstra over (stop, on-bus pattern) states.
// Generalised cost = minutes + extra weight on walking + a penalty per transfer,
// so it prefers fewer transfers and less walking, as passengers do.
import { stops, lines } from './data/dataset.js';
import { haversine } from './geo.js';
import { stopById, lineById, patterns, boardingsAtStop, nextArrival, rideGeometry } from './schedule.js';

export const WALK_M_PER_MIN = 75; // ~4.5 km/h
export const WALK_ROAD_FACTOR = 1.25;
export const MAX_ACCESS_WALK_M = 1200;
const EXTENDED_ACCESS_WALK_M = 3000;
const TRANSFER_WALK_M = 400;
const WALK_WEIGHT = 1.5;
const TRANSFER_PENALTY = 8;
const MIN_WALK_LEG_M = 20; // shorter walks are not worth showing as a step
const MAX_BOARDINGS = 3;

const walkMeters = (a, b) => haversine(a, b) * WALK_ROAD_FACTOR;
const walkMinutes = (m) => m / WALK_M_PER_MIN;

/** Stops within `radius` metres (walking distance) of a point, nearest first. */
export function stopsNear(point, radius) {
  return stops
    .map((s) => ({ stop: s, meters: walkMeters(point, s) }))
    .filter((x) => x.meters <= radius)
    .sort((a, b) => a.meters - b.meters);
}

/** Lines that stop within walking distance of `point` — e.g. every line that serves the airport. */
export function linesServing(point, radius = MAX_ACCESS_WALK_M) {
  const best = new Map();
  for (const { stop, meters } of stopsNear(point, radius)) {
    for (const line of lines) {
      if (!line.stops.includes(stop.id) && !line.stopsBack?.includes(stop.id)) continue;
      if (!best.has(line.id) || best.get(line.id).meters > meters) {
        best.set(line.id, { lineId: line.id, stopId: stop.id, meters: Math.round(meters) });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.meters - b.meters);
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** One Dijkstra search. Returns the best path to DEST or null. */
function search(from, to, startMin, { bannedLines = new Set(), accessRadius = MAX_ACCESS_WALK_M } = {}) {
  const egress = new Map(stopsNear(to, accessRadius).map((x) => [x.stop.id, x.meters]));
  if (!egress.size) return null;

  const best = new Map();
  const heap = new MinHeap();
  const relax = (key, label) => {
    const cur = best.get(key);
    if (cur && cur.cost <= label.cost) return;
    best.set(key, label);
    heap.push({ key, ...label });
  };

  for (const { stop, meters } of stopsNear(from, accessRadius)) {
    const mins = walkMinutes(meters);
    relax(`at|${stop.id}`, {
      cost: mins * WALK_WEIGHT, time: startMin + mins, boardings: 0, lastWalk: true,
      prev: null, edge: { type: 'walk', from: 'ORIGIN', to: stop.id, meters },
    });
  }

  while (heap.size) {
    const node = heap.pop();
    if (best.get(node.key) !== undefined && best.get(node.key).cost < node.cost) continue;
    if (node.key === 'DEST') return node;
    const [kind, stopId, lineId, dirStr, idxStr] = node.key.split('|');

    if (kind === 'at') {
      // Walk to destination.
      if (egress.has(stopId) && node.boardings > 0) {
        const m = egress.get(stopId);
        relax('DEST', {
          cost: node.cost + walkMinutes(m) * WALK_WEIGHT, time: node.time + walkMinutes(m),
          boardings: node.boardings, prev: node, edge: { type: 'walk', from: stopId, to: 'DEST', meters: m },
        });
      }
      // Board a bus.
      if (node.boardings < MAX_BOARDINGS) {
        for (const { pattern, idx } of boardingsAtStop.get(stopId)) {
          if (bannedLines.has(pattern.lineId)) continue;
          const arrive = nextArrival(pattern, idx, node.time);
          if (arrive === null) continue;
          const wait = arrive - node.time;
          relax(`on|${stopId}|${pattern.lineId}|${pattern.dir}|${idx}`, {
            cost: node.cost + wait + (node.boardings > 0 ? TRANSFER_PENALTY : 0),
            time: arrive, boardings: node.boardings + 1, prev: node,
            edge: { type: 'board', stopId, lineId: pattern.lineId, dir: pattern.dir, idx, wait },
          });
        }
      }
      // Short transfer walk to a nearby stop (only right after getting off a bus).
      if (!node.lastWalk && node.boardings > 0) {
        for (const { stop, meters } of stopsNear(stopById.get(stopId), TRANSFER_WALK_M)) {
          if (stop.id === stopId) continue;
          const mins = walkMinutes(meters);
          relax(`at|${stop.id}`, {
            cost: node.cost + mins * WALK_WEIGHT, time: node.time + mins, boardings: node.boardings,
            lastWalk: true, prev: node, edge: { type: 'walk', from: stopId, to: stop.id, meters },
          });
        }
      }
    } else {
      const pattern = patterns[lineId][Number(dirStr)];
      const idx = Number(idxStr);
      // Get off here.
      relax(`at|${stopId}`, {
        cost: node.cost, time: node.time, boardings: node.boardings, lastWalk: false, prev: node,
        edge: { type: 'alight', stopId },
      });
      // Stay on to the next stop.
      if (idx < pattern.stopIds.length - 1) {
        const next = pattern.stopIds[idx + 1];
        const mins = pattern.segMinutes[idx];
        relax(`on|${next}|${lineId}|${dirStr}|${idx + 1}`, {
          cost: node.cost + mins, time: node.time + mins, boardings: node.boardings, prev: node,
          edge: { type: 'ride', lineId, dir: pattern.dir, fromIdx: idx, toIdx: idx + 1 },
        });
      }
    }
  }
  return null;
}

const pointOf = (id, from, to) => {
  if (id === 'ORIGIN') return { lat: from.lat, lng: from.lng, name: from.name ?? null };
  if (id === 'DEST') return { lat: to.lat, lng: to.lng, name: to.name ?? null };
  const s = stopById.get(id);
  return { lat: s.lat, lng: s.lng, name: s.name, stopId: s.id };
};

/** Turn the Dijkstra label chain into passenger-friendly legs. */
function toItinerary(destNode, from, to, startMin) {
  const edges = [];
  for (let n = destNode; n; n = n.prev) if (n.edge) edges.unshift({ edge: n.edge, time: n.time });

  const legs = [];
  let clock = startMin;
  for (let i = 0; i < edges.length; i++) {
    const { edge, time } = edges[i];
    if (edge.type === 'walk') {
      if (edge.meters < MIN_WALK_LEG_M) continue;
      const minutes = walkMinutes(edge.meters);
      const a = pointOf(edge.from, from, to);
      const b = pointOf(edge.to, from, to);
      legs.push({
        type: 'walk', from: a, to: b, meters: Math.round(edge.meters), minutes,
        departMin: time - minutes, arriveMin: time, geometry: [[a.lat, a.lng], [b.lat, b.lng]],
      });
      clock = time;
    } else if (edge.type === 'board') {
      const pattern = patterns[edge.lineId][edge.dir];
      let toIdx = edge.idx;
      let arrive = time;
      while (edges[i + 1]?.edge.type === 'ride') {
        i++;
        toIdx = edges[i].edge.toIdx;
        arrive = edges[i].time;
      }
      const line = lineById.get(edge.lineId);
      legs.push({
        type: 'bus',
        lineId: line.id, code: line.code, color: line.color, kind: line.kind, lineName: line.name,
        dir: edge.dir, headsign: pattern.headsign,
        from: pointOf(pattern.stopIds[edge.idx]), to: pointOf(pattern.stopIds[toIdx]),
        stopIds: pattern.stopIds.slice(edge.idx, toIdx + 1),
        numStops: toIdx - edge.idx,
        waitMin: time - clock, departMin: time, arriveMin: arrive, minutes: arrive - time,
        geometry: rideGeometry(pattern, edge.idx, toIdx),
      });
      clock = arrive;
    }
  }
  const busLegs = legs.filter((l) => l.type === 'bus');
  const last = legs[legs.length - 1];
  return {
    id: busLegs.map((l) => `${l.lineId}:${l.from.stopId}>${l.to.stopId}`).join('|'),
    legs,
    departMin: startMin,
    arriveMin: last.arriveMin,
    durationMin: last.arriveMin - startMin,
    walkMeters: legs.filter((l) => l.type === 'walk').reduce((s, l) => s + l.meters, 0),
    transfers: Math.max(0, busLegs.length - 1),
    lineIds: busLegs.map((l) => l.lineId),
    score: destNode.cost,
  };
}

/** Label each option so passengers can choose: recommended / fastest / fewest transfers / least walking. */
function tagOptions(options) {
  if (!options.length) return;
  options.forEach((o) => { o.tags = []; });
  options[0].tags.push('recommended');
  if (options.length < 2) return;
  const pick = (key, tag) => {
    const min = Math.min(...options.map((o) => o[key]));
    const winners = options.filter((o) => o[key] - min < 1);
    if (winners.length < options.length) winners.forEach((o) => o.tags.push(tag));
  };
  pick('durationMin', 'fastest');
  pick('transfers', 'fewest-transfers');
  pick('walkMeters', 'least-walking');
}

/**
 * Plan up to `maxOptions` different bus journeys from `from` to `to`.
 * @param {{lat:number,lng:number,name?:any}} from
 * @param {{lat:number,lng:number,name?:any}} to
 * @param {number} startMin minutes since local midnight
 */
export function planTrip(from, to, startMin, maxOptions = 3) {
  const directMeters = walkMeters(from, to);
  let accessRadius = MAX_ACCESS_WALK_M;
  let first = search(from, to, startMin, { accessRadius });
  if (!first) {
    accessRadius = EXTENDED_ACCESS_WALK_M;
    first = search(from, to, startMin, { accessRadius });
  }

  const options = [];
  const seen = new Set();
  const add = (node) => {
    if (!node) return;
    const it = toItinerary(node, from, to, startMin);
    if (!it.lineIds.length || seen.has(it.id)) return;
    seen.add(it.id);
    options.push(it);
  };
  add(first);

  // Alternatives: ban each line of the earlier options one at a time.
  const queue = first ? [new Set()] : [];
  const tried = new Set();
  while (queue.length && options.length < maxOptions + 2) {
    const base = queue.shift();
    for (const opt of [...options]) {
      for (const lineId of opt.lineIds) {
        const banned = new Set([...base, lineId]);
        const key = [...banned].sort().join(',');
        if (tried.has(key) || banned.size > 2) continue;
        tried.add(key);
        const before = options.length;
        add(search(from, to, startMin, { bannedLines: banned, accessRadius }));
        if (options.length > before) queue.push(banned);
      }
    }
  }

  options.sort((a, b) => a.score - b.score);
  // Drop alternatives that are much slower without saving a transfer — they only add noise.
  const result = options
    .filter((o, i) => i === 0 || o.durationMin <= options[0].durationMin + 20 || o.transfers < options[0].transfers)
    .slice(0, maxOptions);
  tagOptions(result);

  const walkOnly = directMeters <= 2000 && (!result.length || walkMinutes(directMeters) <= result[0].durationMin)
    ? {
        meters: Math.round(directMeters),
        minutes: walkMinutes(directMeters),
        geometry: [[from.lat, from.lng], [to.lat, to.lng]],
      }
    : null;

  return {
    departMin: startMin,
    options: result,
    walkOnly,
    servingLines: linesServing(to),
    extendedWalk: accessRadius > MAX_ACCESS_WALK_M,
  };
}

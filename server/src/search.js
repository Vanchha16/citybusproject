import { places, stops } from './data/network.js';
import { haversine } from './geo.js';

const KHMER = /[ក-៿]/;
export const isKhmer = (text) => KHMER.test(text);

/** Lowercase, strip punctuation and Khmer zero-width spaces, collapse whitespace. */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[​‌‍]/g, '')
    .replace(/[(),.?!'"“”‘’\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const searchable = [
  ...places.map((p) => ({ type: 'place', id: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, aliases: p.aliases })),
  ...stops.map((s) => ({ type: 'stop', id: s.id, name: s.name, lat: s.lat, lng: s.lng, category: 'bus-stop', aliases: [] })),
].map((item) => ({
  ...item,
  terms: [item.name.en, item.name.km, ...item.aliases].map(normalize).filter(Boolean),
}));

const publicItem = ({ terms, aliases, ...rest }) => rest;

/** Autocomplete search over places and stops. */
export function searchPlaces(query, near = null, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const scored = [];
  for (const item of searchable) {
    let score = 0;
    for (const term of item.terms) {
      if (term === q) score = Math.max(score, 100);
      else if (term.startsWith(q)) score = Math.max(score, 80);
      else if (term.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 60);
      else if (term.includes(q)) score = Math.max(score, 40);
    }
    if (!score) continue;
    if (item.type === 'place') score += 5; // prefer named places over stops with the same name
    if (near) score -= Math.min(15, haversine(near, item) / 1000);
    scored.push({ item, score });
  }
  // A stop named after a place right next to it (e.g. the airport stop) is the same answer — show it once.
  const ranked = scored.sort((a, b) => b.score - a.score).map((x) => x.item);
  const unique = ranked.filter((item) =>
    item.type !== 'stop' ||
    !ranked.some((p) => p.type === 'place' && normalize(p.name.en) === normalize(item.name.en) && haversine(p, item) < 400));
  return unique.slice(0, limit).map(publicItem);
}

export function getPlace(id) {
  const item = searchable.find((x) => x.id === id);
  return item ? publicItem(item) : null;
}

/** Every place/stop mentioned in free text, with its position in the text (longest alias wins). */
export function findMentions(text) {
  const t = normalize(text);
  const hits = [];
  for (const item of searchable) {
    for (const term of item.terms) {
      if (term.length < 3) continue;
      const at = t.indexOf(term);
      if (at >= 0) hits.push({ item, at, len: term.length });
    }
  }
  hits.sort((a, b) => b.len - a.len);
  const taken = [];
  const result = [];
  for (const h of hits) {
    if (taken.some(([s, e]) => h.at < e && s < h.at + h.len)) continue;
    if (result.some((r) => r.item.id === h.item.id)) continue;
    taken.push([h.at, h.at + h.len]);
    result.push(h);
  }
  return result.sort((a, b) => a.at - b.at).map((h) => ({ ...publicItem(h.item), at: h.at }));
}

/** Compact catalogue for the AI prompt: id | English | Khmer | category. Stable order for prompt caching. */
export function catalogueText() {
  return places.map((p) => `${p.id} | ${p.name.en} | ${p.name.km} | ${p.category}`).join('\n');
}

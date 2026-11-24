// "Ask in Khmer or English" assistant.
// Workflow: (1) understand the request -> origin/destination place ids,
// (2) the deterministic planner finds real routes, (3) the answer is built from
// the plan. Claude only does step 1, so it can never make up a bus route.
// Without an API key, step 1 falls back to a keyword parser.
import Anthropic from '@anthropic-ai/sdk';
import { places } from './data/network.js';
import { catalogueText, findMentions, getPlace, isKhmer, normalize } from './search.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = aiEnabled ? new Anthropic() : null;
const placeIds = new Set(places.map((p) => p.id));

const SYSTEM = `You are the trip-request reader for a Phnom Penh City Bus app.
Passengers write in Khmer, English, or a mix (including Khmer typed in Latin letters).
Work out where they want to go and where they are starting from, using ONLY the place ids
in the catalogue below. Rules:
- If they don't say where they start, set origin_place_id to null (the app uses their GPS location).
- Map informal names to catalogue entries (e.g. "airport", "ព្រលានយន្តហោះ", "new airport" -> kti;
  "Psar Thmey" -> central-market; "AEON 2" -> aeon2).
- If the destination is not in the catalogue, set destination_place_id to null and put the name they used in unknown_place.
- intent: "trip" for getting somewhere, "nearby" for nearby stops/places, "other" for anything else.
- language: "km" if they wrote mostly in Khmer, otherwise "en".
- note: at most one short, friendly sentence in their language, only when something needs explaining
  (e.g. an unknown place or an off-topic question); otherwise an empty string.

Catalogue (id | English | Khmer | category):
${catalogueText()}`;

const SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['trip', 'nearby', 'other'] },
    origin_place_id: { type: ['string', 'null'] },
    destination_place_id: { type: ['string', 'null'] },
    unknown_place: { type: ['string', 'null'] },
    language: { type: 'string', enum: ['en', 'km'] },
    note: { type: 'string' },
  },
  required: ['intent', 'origin_place_id', 'destination_place_id', 'unknown_place', 'language', 'note'],
  additionalProperties: false,
};

async function understandWithClaude(message) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: message }],
  });
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new Error(`Claude stopped early: ${response.stop_reason}`);
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  const parsed = JSON.parse(text);
  // Never trust ids blindly — keep only ones that exist.
  if (parsed.origin_place_id && !placeIds.has(parsed.origin_place_id)) parsed.origin_place_id = null;
  if (parsed.destination_place_id && !placeIds.has(parsed.destination_place_id)) parsed.destination_place_id = null;
  return parsed;
}

// Words that, right before a place name, mark it as the start or the destination.
const ORIGIN_MARKERS = /(\bfrom|\bi am (at|near|in)|\bi'?m (at|near|in)|ពី|ខ្ញុំនៅ|នៅជិត)\s*$/;
const DEST_MARKERS = /(\bto|\bgo|\breach|\bfor|ទៅ|ដល់)\s*$/;
const NEARBY_WORDS = ['near me', 'nearby', 'nearest', 'closest', 'around me', 'ជិតខ្ញុំ', 'ជិតនេះ', 'ជិតបំផុត'];

/** Keyword fallback used when no API key is configured (or the API call fails). */
export function understandWithKeywords(message) {
  const text = normalize(message);
  const language = isKhmer(message) ? 'km' : 'en';
  const mentions = findMentions(message);
  let origin = null;
  let destination = null;
  for (const m of mentions) {
    const lead = text.slice(Math.max(0, m.at - 16), m.at);
    if (!origin && ORIGIN_MARKERS.test(lead)) origin = m;
    else if (!destination && DEST_MARKERS.test(lead)) destination = m;
  }
  const rest = mentions.filter((m) => m !== origin && m !== destination);
  if (!destination && rest.length) destination = rest.pop();
  if (!origin && rest.length) origin = rest[0];

  const nearby = !destination && NEARBY_WORDS.some((w) => text.includes(w));
  const toPlaceId = (m) => (!m ? null : m.type === 'place' ? m.id : `stop:${m.id}`);
  return {
    intent: nearby ? 'nearby' : destination ? 'trip' : 'other',
    origin_place_id: toPlaceId(origin),
    destination_place_id: toPlaceId(destination),
    unknown_place: null,
    language,
    note: '',
  };
}

/** Resolve "place-id" or "stop:STOPID" to a point with a bilingual name. */
export function resolvePlace(id) {
  if (!id) return null;
  const item = getPlace(id.startsWith('stop:') ? id.slice(5) : id);
  return item ? { id: item.id, type: item.type, name: item.name, lat: item.lat, lng: item.lng, category: item.category } : null;
}

export async function understand(message) {
  if (client) {
    try {
      return { ...(await understandWithClaude(message)), engine: 'claude' };
    } catch (err) {
      console.warn('[assistant] Claude unavailable, using keyword parser:', err.message);
    }
  }
  return { ...understandWithKeywords(message), engine: 'keywords' };
}

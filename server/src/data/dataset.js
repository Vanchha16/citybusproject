// Which network the app runs on.
//
//   imported/network.json present  -> official data, from `npm run import:gtfs -- <feed>`
//   otherwise (or CITYBUS_DATA=sample) -> the hand-made sample in network.js
//
// Places (landmarks people search for, like the airport or Central Market) always come
// from network.js: GTFS feeds describe stops and routes, not landmarks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sample from './network.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const IMPORTED_DIR = process.env.CITYBUS_IMPORTED_DIR || path.join(here, 'imported');

function loadImported() {
  if (process.env.CITYBUS_DATA === 'sample') return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(IMPORTED_DIR, 'network.json'), 'utf8'));
  } catch {
    return null;
  }
}
const imported = loadImported();

export const stops = imported?.stops ?? sample.stops;
export const lines = imported?.lines ?? sample.lines;
export const places = sample.places;
/** { kind: 'sample' } or { kind: 'gtfs', name, version, importedAt, ... } */
export const dataSource = imported ? { kind: 'gtfs', ...imported.meta } : { kind: 'sample' };
/** Road shapes for the active network (see scripts/fetch-shapes.js and scripts/import-gtfs.js). */
export const SHAPES_FILE = imported ? path.join(IMPORTED_DIR, 'shapes.json') : path.join(here, 'shapes.json');

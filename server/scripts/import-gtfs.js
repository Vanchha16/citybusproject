// Import official bus data (a GTFS feed) into the app.
//
//   npm run import:gtfs -- path/to/feed.zip      (or an unzipped folder)
//   npm run import:gtfs -- --remove              back to the sample network
//
// Writes server/src/data/imported/network.json and shapes.json. The server picks them
// up on its next start. Commit the folder to deploy the data to Vercel.
import fs from 'node:fs';
import path from 'node:path';
import { readGtfs, convertGtfs } from '../src/gtfs.js';
import { IMPORTED_DIR } from '../src/data/dataset.js';
import { places } from '../src/data/network.js';

const arg = process.argv[2];
if (!arg || arg === '--help' || arg === '-h') {
  console.log('Usage: npm run import:gtfs -- <feed.zip | folder>\n       npm run import:gtfs -- --remove   (use the sample network again)');
  process.exit(arg ? 0 : 1);
}

if (arg === '--remove') {
  fs.rmSync(IMPORTED_DIR, { recursive: true, force: true });
  console.log('Removed the imported network. The app uses the sample network again.');
  process.exit(0);
}

// npm runs scripts from server/, so resolve the path against where the command was typed.
const source = path.resolve(process.env.INIT_CWD || process.cwd(), arg);
if (!fs.existsSync(source)) {
  console.error(`Not found: ${source}`);
  process.exit(1);
}

let result;
try {
  result = convertGtfs(readGtfs(source), { places, source: path.basename(source) });
} catch (err) {
  console.error(`Could not import ${path.basename(source)}: ${err.message}`);
  process.exit(1);
}

const { network, shapes, warnings } = result;
fs.mkdirSync(IMPORTED_DIR, { recursive: true });
fs.writeFileSync(path.join(IMPORTED_DIR, 'network.json'), `${JSON.stringify(network, null, 1)}\n`);
fs.writeFileSync(path.join(IMPORTED_DIR, 'shapes.json'), JSON.stringify(shapes));

const shaped = network.lines.filter((l) => shapes[l.id]).length;
console.log(`Imported ${network.meta.name}${network.meta.version ? ` (${network.meta.version})` : ''}`);
console.log(`  ${network.lines.length} lines, ${network.stops.length} stops, road shapes for ${shaped} of ${network.lines.length} lines`);
for (const l of network.lines) {
  console.log(`  ${l.code.padEnd(6)} ${l.kind === 'airport' ? '✈ ' : '  '}${l.name.en}  ·  every ${l.headwayMin} min, ${l.serviceStart}–${l.serviceEnd}, ${l.stops.length} stops, ${l.speedKmh} km/h`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} note(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (shaped < network.lines.length) {
  console.log('\nTip: `npm run shapes` fetches road shapes for the lines without one.');
}
console.log(`\nSaved to ${path.relative(process.cwd(), IMPORTED_DIR)}. Restart the server to use it (stop npm run dev and start it again).`);

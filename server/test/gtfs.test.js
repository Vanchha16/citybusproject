// GTFS import: a small feed with the awkward parts real feeds have (a way back on
// different streets, frequency-based trips, a weekend service, Khmer translations,
// a road shape), converted, zipped, and run through the real planner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv, readZip, readGtfs, convertGtfs, gtfsMinutes, readableColor, cutShape } from '../src/gtfs.js';
import { places } from '../src/data/network.js';
import { FEED } from './fixtures/mini-feed.js';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const parsed = () => Object.fromEntries(Object.entries(FEED).map(([f, text]) => [f.replace('.txt', ''), parseCsv(text)]));

/** Minimal zip writer (deflate), to check the reader against a real archive layout. */
function makeZip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const packed = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(`feed/${name}`);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(packed.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, packed);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

test('CSV: quotes, commas inside quotes, BOM, CRLF, blank lines', () => {
  const rows = parseCsv('﻿a,b\r\n1,"x, ""y"""\r\n\r\n2,z\r\n');
  assert.deepEqual(rows, [{ a: '1', b: 'x, "y"' }, { a: '2', b: 'z' }]);
});

test('times past midnight and readable line colours', () => {
  assert.equal(gtfsMinutes('25:10:00'), 1510);
  assert.equal(gtfsMinutes('6:05:30'), 365.5);
  assert.equal(gtfsMinutes(''), null);
  const dark = readableColor('#ffc629');
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  assert.ok(1.05 / (lum(dark) + 0.05) >= 4.5, `${dark} is readable with white text`);
  assert.equal(readableColor('#1d4ed8'), '#1d4ed8', 'already dark enough: unchanged');
});

test('a shape is cut at each stop; a stop far from the shape means no shape', () => {
  const pts = [[0, 0], [0, 0.001], [0, 0.002], [0, 0.003]];
  const segs = cutShape(pts, [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.002 }, { lat: 0, lng: 0.003 }]);
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0], [[0, 0], [0, 0.001], [0, 0.002]]);
  assert.equal(cutShape(pts, [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]), null);
});

test('converts lines, stops, timing, Khmer names and shapes', () => {
  const { network, shapes, warnings } = convertGtfs(parsed(), { places, source: 'test.zip' });
  assert.equal(network.meta.name, 'Test City Bus');
  assert.equal(network.meta.version, '2026-11');
  assert.equal(network.meta.service, 'WK');

  const [r1, r2] = network.lines;
  assert.equal(r1.code, '10');
  assert.equal(r1.kind, 'airport');
  assert.deepEqual(r1.stops, ['A', 'B', 'C', 'AIR']);
  assert.deepEqual(r1.stopsBack, ['AIR', 'C', 'E', 'A'], 'the way back uses other streets');
  assert.equal(r1.headwayMin, 15);
  assert.equal(r1.serviceStart, '06:00');
  assert.equal(r1.serviceEnd, '06:30');
  assert.equal(r1.name.km, 'ផ្សារធំថ្មី – អាកាសយានដ្ឋាន');
  assert.notEqual(r1.color, '#ffc629', 'yellow is darkened for white text');
  assert.ok(r1.speedKmh > 15 && r1.speedKmh < 60, `speed ${r1.speedKmh}`);

  assert.equal(r2.code, '20');
  assert.equal(r2.kind, 'city');
  assert.equal(r2.name.en, 'Monivong, Sihanouk – Stung Meanchey');
  assert.equal(r2.stopsBack, undefined, 'the way back is the same stops reversed');
  assert.equal(r2.headwayMin, 10, 'from frequencies.txt');
  assert.equal(r2.serviceStart, '06:00');
  assert.equal(r2.serviceEnd, '07:50');

  const ids = network.stops.map((s) => s.id).sort();
  assert.deepEqual(ids, ['A', 'AIR', 'B', 'C', 'D', 'E'], 'only stops a line uses; weekend-only patterns ignored');
  assert.equal(network.stops.find((s) => s.id === 'A').name.km, 'ផ្សារធំថ្មី');
  assert.equal(network.stops.find((s) => s.id === 'B').name.en, 'Monivong, Sihanouk');

  assert.equal(shapes.R1.length, 3);
  assert.deepEqual(shapes.R1[0][0], [11.5697, 104.9211]);
  assert.deepEqual(shapes.R1[2].at(-1), [11.3629, 104.9166]);
  assert.equal(shapes.R2, undefined);

  assert.ok(warnings.some((w) => w.includes('Line 10') && w.includes('different stops')));
  assert.ok(warnings.some((w) => w.includes('no Khmer name')));
  assert.ok(!warnings.some((w) => w.includes('less common')), 'the weekend trip is not counted');
});

test('reads the same feed from a folder and from a zip (files in a sub-folder)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-'));
  for (const [f, text] of Object.entries(FEED)) fs.writeFileSync(path.join(dir, f), text);
  const zipPath = path.join(dir, 'feed.zip');
  fs.writeFileSync(zipPath, makeZip(FEED));
  assert.equal(Object.keys(readZip(fs.readFileSync(zipPath))).length, Object.keys(FEED).length);
  const fromDir = convertGtfs(readGtfs(dir), { places }).network;
  const fromZip = convertGtfs(readGtfs(zipPath), { places }).network;
  assert.deepEqual({ ...fromZip, meta: null }, { ...fromDir, meta: null });
  assert.throws(() => convertGtfs({ stops: [] }), /missing or empty/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('imported data runs through the real app: plan, buses, arrivals on the way back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citybus-imported-'));
  const { network, shapes } = convertGtfs(parsed(), { places });
  fs.writeFileSync(path.join(dir, 'network.json'), JSON.stringify(network));
  fs.writeFileSync(path.join(dir, 'shapes.json'), JSON.stringify(shapes));
  const script = `
    const { dataSource, lines } = await import('./src/data/dataset.js');
    const { planTrip } = await import('./src/planner.js');
    const { patterns, lineGeometry } = await import('./src/schedule.js');
    const { vehiclesAt, predictArrivals } = await import('./src/realtime.js');
    const back = patterns.R1[1];
    const plan = planTrip({ lat: 11.5697, lng: 104.9211 }, { lat: 11.3629, lng: 104.9166 }, 360);
    console.log(JSON.stringify({
      kind: dataSource.kind,
      lines: lines.length,
      backStops: back.stopIds,
      geometryPoints: lineGeometry('R1').length,
      options: plan.options.length,
      firstBus: plan.options[0]?.legs.find((l) => l.type === 'bus')?.lineId,
      buses: vehiclesAt(375).length,
      arrivalsAtE: predictArrivals(back, back.stopIds.indexOf('E'), 400).length,
    }));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: serverDir,
    env: { ...process.env, CITYBUS_DATA: '', CITYBUS_IMPORTED_DIR: dir },
    encoding: 'utf8',
  });
  const r = JSON.parse(out.trim().split('\n').at(-1));
  assert.equal(r.kind, 'gtfs');
  assert.equal(r.lines, 2);
  assert.deepEqual(r.backStops, ['AIR', 'C', 'E', 'A']);
  assert.ok(r.geometryPoints > 7, 'the map draws the way there and the way back');
  assert.ok(r.options >= 1);
  assert.equal(r.firstBus, 'R1');
  assert.ok(r.buses > 0, 'simulated buses run on imported lines');
  assert.ok(r.arrivalsAtE > 0, 'arrival times at a stop only on the way back');
  fs.rmSync(dir, { recursive: true, force: true });
});

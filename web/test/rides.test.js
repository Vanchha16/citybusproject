import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIDE_APPS, RIDE_KMH, rideMinutes } from '../src/rides.js';

test('ride time comes from road distance at the city speed, never under 2 minutes', () => {
  assert.equal(RIDE_KMH, 18);
  assert.equal(rideMinutes(3000), 10); // 3 km at 18 km/h
  assert.equal(rideMinutes(1500), 5);
  assert.equal(rideMinutes(100), 2);
});

test('apps link only to their official store listings', () => {
  const byKey = Object.fromEntries(RIDE_APPS.map((a) => [a.key, a]));
  assert.equal(byKey.grab.ios, 'https://apps.apple.com/app/id647268330');
  assert.equal(byKey.grab.android, 'https://play.google.com/store/apps/details?id=com.grabtaxi.passenger');
  assert.equal(byKey.passapp.ios, 'https://apps.apple.com/app/id1535615747');
  assert.equal(byKey.passapp.android, 'https://play.google.com/store/apps/details?id=kh.com.passapp.passenger');
  for (const a of RIDE_APPS) {
    assert.match(a.ios, /^https:\/\/apps\.apple\.com\//);
    assert.match(a.android, /^https:\/\/play\.google\.com\//);
  }
});

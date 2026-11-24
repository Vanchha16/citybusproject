import { webkit, devices } from 'playwright';
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], permissions: ['geolocation'], geolocation: { latitude: 13.0957, longitude: 103.2022, accuracy: 50000 } });
const p = await ctx.newPage(); await p.goto('http://localhost:5173/');
console.log('webkit coords:', await p.evaluate(() => new Promise((r) => navigator.geolocation.getCurrentPosition(
  (x) => r({ acc: x.coords.accuracy, lat: x.coords.latitude }), (e) => r('error ' + e.code), { enableHighAccuracy: false }))));
await p.waitForTimeout(3000);
console.log('notice:', await p.locator('[role="status"]').allInnerTexts());
await b.close();

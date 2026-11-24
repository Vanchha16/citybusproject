# City Bus: smart route finder (CamDX Hackathon 2026 prototype)

A passenger types or says where they want to go, in Khmer or English, and the app
shows **only the bus lines that actually go there**: which stop to walk to, which bus
to take, where to get off, and when the next bus comes.

Example: choose **Techo International Airport** and every unrelated line fades from the map.
Only the airport buses (AEB, AX2) stay highlighted, with route options from where you are.

> ⚠️ **Sample data.** Stops are approximate. Lines are illustrative: AEB is loosely modelled on
> the real Airport Express Bus; the others are made up. Codes like 1A or 2A follow the official
> numbering style but do not match the real routes with those numbers. Bus positions and times are simulated
> from headways. Replace `server/src/data/network.js` with official City Bus data before real use.

## Run it

Requires Node.js 22+.

```bash
npm install
npm run dev          # API on :8787, web app on http://localhost:5173
```

Optional AI answers: copy `server/.env.example` to `server/.env` and set `ANTHROPIC_API_KEY`,
then restart. Without a key, the assistant uses a keyword parser that still handles common
questions in both languages.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Planner, timetable, parser and search tests |
| `npm run build && npm start` | Production build served by the API on :8787 |
| `npm run shapes` | Re-fetch road geometry for lines (run after editing stops/lines) |

If GPS is off, or you're outside Phnom Penh, the app starts from **Central Market (demo location)**.
To demo at night when buses are out of service, set `DEMO_CLOCK=08:30` in `server/.env`.

## Deploy (Vercel)

`vercel.json` builds the web app to static files (`web/dist`) and runs the API as one serverless
function (`api/index.js`, the same Express app). Import the GitHub repo at vercel.com/new, or
run `npx vercel --prod`. Optional environment variable: `ANTHROPIC_API_KEY` (AI answers).
Location works on the deployed site because it is served over HTTPS.

## Features

- **Home page** in the same layout as the official app (header, live map card, service tiles, bottom bar),
  with what it lacks: a big **"Where do you want to go?"** search bar and quick destination chips.
  The live map card is a mini diagram of the network with buses moving in real time.
- **Bottom bar**: Home, Lines (every line with frequency, hours and stops), a raised **Directions**
  button (the trip planner), Nearby (stops near you with next buses), Settings (language, alerts, about)
- **Destination search** in Khmer and English (`ផ្សារទួលទំពូង`, `russian market`, `airport`, `AEON 2`…)
- **"Buses that go to …"**: every line serving the destination, with the map filtered to those lines
- **Route options** tagged *Recommended / Fastest / Fewest transfers / Least walking*
- **Step-by-step directions**: walk → board (with wait time) → ride N stops → get off → arrive
- **Nearby stops** with the next departures in each direction
- **Ask box**: "I am near AEON Sen Sok, how can I go to the Royal Palace?" / "ពីផ្សារធំថ្មី ទៅព្រលានយន្តហោះ"
- **Trustworthy live buses**: every bus and arrival time shows where it came from (see below)
- **"Bus is coming" alert**: tap 🔔 on a nearby departure, or "Alert me" in route steps. You get a
  notification and vibration when the bus is 5 min away. Notifications need `localhost` or HTTPS.

## Trustworthy live buses (why this matters)

The biggest complaint in the official app's Play Store reviews is that live GPS can't be trusted:
frozen buses, "ghost buses" that never come, and buses missing from the map. The Authority itself
says the GPS signal is unstable in bad weather. Here, GPS is combined with the timetable
(`server/src/realtime.js`):

| What the GPS does | What the app shows |
|---|---|
| Fresh fix (≤ 1 min) | **Live** bus (solid marker, green dot on times), with its measured delay |
| Silent for 1–10 min | **Estimated** position: moved along the route at its last known delay (dashed marker, `~` on times) |
| Silent > 10 min | Faded "lost" marker, rough estimate |
| Reports fresh fixes but hasn't moved for 5+ min, away from a terminal | **Suspect**: grey `?` marker, "not moving, may be out of service", and **ignored for arrival times** |
| No bus tracked yet | **Timetable** time (clock mark) |

The GPS feed is simulated (`server/src/simulation.js`) with the same faults users report: about 35%
of trips run late, about 12% lose signal for a while, and about 5% have frozen units. The tests check
the fusion against the simulator's ground truth. Swap the simulator for the operator's real GPS feed to
go live.

## How it works

```
web/ (React + Leaflet + Tailwind)        server/ (Node + Express)
  map, search, route list,      /api →    planner.js    time-dependent Dijkstra over stops × lines
  steps, ask box                          schedule.js   headway timetable, live bus positions
                                          search.js     bilingual place search
                                          assistant.js  question → {origin, destination}
                                          describe.js   itinerary → Khmer/English steps
                                          data/         network.js (stops, lines, places), shapes.json
```

**The AI never invents routes.** Claude (or the keyword fallback) only works out *where* the
passenger wants to go, as place IDs from the catalogue. The deterministic planner then finds
the real routes, and the answer text is built from that plan. This keeps answers correct and
easy to explain to judges.

Planner details: walking ≤ 1.2 km to or from stops (widened to 3 km if nothing is nearby),
transfers by walking ≤ 400 m, an 8-minute penalty per transfer, and walking weighted 1.5×.
Alternatives come from banning lines used by earlier options.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/network` | Stops, lines (with geometry), places |
| `GET /api/search?q=` | Place/stop autocomplete |
| `GET /api/plan?fromLat&fromLng&toLat&toLng` | Route options + lines serving the destination |
| `GET /api/nearby?lat&lng` | Nearest stops with next departures |
| `GET /api/buses` | Fused bus positions with status (live/estimated/lost/suspect) and counts |
| `GET /api/arrivals?stopId&lineId&dir` | Next 3 arrivals of a line at a stop (used by alerts) |
| `POST /api/assistant` `{message, location}` | Free-text question → answer + plan |

## Ideas for the hackathon days

- Load official GTFS data instead of `network.js`
- Real GPS feed for bus positions and live ETAs
- Voice input (Khmer speech-to-text)
- Show fares and accessibility information per line
- Telegram bot using the same `/api/assistant`

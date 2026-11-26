# City Bus: smart route finder (CamDX Hackathon 2026 prototype)

A passenger types or says where they want to go, in Khmer or English, and the app
shows **only the bus lines that actually go there**: which stop to walk to, which bus
to take, where to get off, and when the next bus comes.

Example: choose **Techo International Airport** and every unrelated line fades from the map.
Only the airport buses (AEB, AX2) stay highlighted, with route options from where you are.

> ⚠️ **Sample data.** Stops are approximate. Lines are illustrative: AEB is loosely modelled on
> the real Airport Express Bus; the others are made up. Codes like 1A or 2A follow the official
> numbering style but do not match the real routes with those numbers. Bus positions and times are simulated
> from headways. Load official City Bus data with `npm run import:gtfs` (see below) before real use.

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
| `npm run shapes` | Fetch road geometry for lines that have none (`-- --all` to re-fetch every line) |
| `npm run import:gtfs -- feed.zip` | Load official bus data (GTFS). `-- --remove` goes back to the sample |

If GPS is off, or you're outside Phnom Penh, the app starts from **Central Market (demo location)**.
To demo at night when buses are out of service, set `DEMO_CLOCK=08:30` in `server/.env`.

## Official bus data (GTFS)

When the City Bus Authority or the organisers share their timetable as a **GTFS feed** (a `.zip` of
CSV files, the standard format transit agencies publish):

```bash
npm run import:gtfs -- path/to/feed.zip     # or an unzipped folder
npm run dev                                  # restart: the app now runs on the official network
```

The command prints every line it found and anything it could not model. It writes
`server/src/data/imported/`; commit that folder to deploy the data. How the feed is turned into
the app's model (`server/src/gtfs.js`):

- **Stops and lines:** only the stops a line uses. Khmer names come from `translations.txt`. Without
  them, the English name is shown in Khmer mode and the import says how many are missing.
- **Stop order:** the most common pattern each way. If the way back uses other streets, it keeps its
  own stop list. Short trips and other variants are reported, not modelled.
- **Timing:** a normal weekday service. Headway from `frequencies.txt` or the gaps between trips,
  service hours from the first and last trip, speed from scheduled trip times.
- **Road shapes:** from `shapes.txt`, cut at each stop. Lines without one: `npm run shapes`.
- **Landmarks** (the airport, markets…) stay in `network.js`. Lines near the airport are marked as airport lines.

Bus positions stay simulated until a real GPS feed is connected (`server/src/simulation.js` is the
only file to replace). Tests always run on the sample network (`CITYBUS_DATA=sample`).

## Pitch demo

Open the site with **`?demo`** (e.g. `https://citybus-omega.vercel.app/?demo`) or tap
**Settings → Start demo**. A 12-step guided tour drives the real app: pick the airport, see only
airport buses, open the best route, set an alert, walk to the stop with the map following,
the bus arrives (the tour's clock jumps to it), tap "It's here", see the report on the operator
view, switch to Khmer, ask in Khmer. It runs at **09:00 Phnom Penh time** whatever the real time, so
rehearsals at night work. Controls: → / Page Down / Space (next), ← / Page Up (back),
Home (first step), Esc (exit). Presentation clickers work too.

## Passenger reports (GPS + timetable + passengers)

When you reach a stop, the stop card asks about the next bus: **It's here**, **Didn't come**
(only once the bus is due) or **Too full**. One tap changes what everyone else sees
(`server/src/reports.js`, `server/src/realtime.js`):

| Report | What it changes |
|---|---|
| It's here | A bus whose GPS dropped out or froze is placed at that stop and its delay is measured. A frozen GPS unit no longer hides a real bus. |
| Didn't come | 1 person: other passengers see a warning. 2 different people: that bus is removed from arrival times (unless its GPS is live). |
| Too full | Passengers at later stops see "Full" on that bus. |

Operators open **`/operator`** (or Settings → Operator view): report counts for the last hour, and what
to act on: buses that didn't come, GPS units to repair, lines that need more buses.
Limits: `REPORTS_PER_10_MIN` (12) per person. Reports are kept for 3 hours. Who sent a report is
stored only as a one-way hash (`REPORT_SALT`), never an IP address.

**Shared reports on Vercel.** Vercel can run the API as several copies, each with its own memory, so
a report sent to one copy would be missing on the others (and on `/operator`). Connect a free Redis:
Vercel → your project → **Storage → Create → Upstash (Redis)** → connect it to the project, then
redeploy. Vercel adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`), and every copy then shares reports, re-reading them every 3 seconds.
`/api/health` says `"reports": "shared"` once it works. Without it (and with `npm run dev`) reports
stay in memory.

## AI answers and cost protection

Add `ANTHROPIC_API_KEY` in Vercel → Project → Settings → Environment Variables, then redeploy.
The ask endpoint is protected (`server/src/ratelimit.js`): more than `ASK_PER_MINUTE` (10)
questions a minute from one person gets a 429; each person gets `AI_PER_HOUR` (20) Claude
answers an hour and then free keyword answers; at most `AI_PER_DAY` (300) Claude answers a
day per running instance. All three are environment variables.

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
- **Ride to the stop**: under the walk to the first bus stop, "Or ride, about N min" with Open Grab /
  Open PassApp and "or take a motodop / tuk-tuk nearby". Grab and PassApp publish no documented
  deep links, so the buttons open their official store pages (which show "Open" when installed)
  and copy the stop name to paste as the drop-off. Ride time = road distance at 18 km/h
  (`RIDE_KMH` in `web/src/rides.js`, an assumption).
- **Choose on map**: set your start (or destination) by moving the map under a fixed pin
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
                                          realtime.js   GPS + passenger reports → positions, ETAs
                                          reports.js    passenger reports (here / didn't come / full)
                                          gtfs.js       official GTFS feed → stops and lines
                                          data/         network.js (sample stops, lines, places), imported/ (GTFS)
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
| `POST /api/reports` `{kind, stopId, lineId, dir, tripId}` | Passenger report: `came`, `missed` or `full` |
| `GET /api/reports` | Operator view: last hour's reports, counts and issues |

## Ideas for the hackathon days

- Real GPS feed for bus positions and live ETAs
- Voice input (Khmer speech-to-text)
- Show fares and accessibility information per line
- Telegram bot using the same `/api/assistant`

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { label, t } from './i18n.js';
import MapView from './components/MapView.jsx';
import PlaceSearch from './components/PlaceSearch.jsx';
import AskBox from './components/AskBox.jsx';
import NearbyStops from './components/NearbyStops.jsx';
import LinesToHere from './components/LinesToHere.jsx';
import RouteOptions from './components/RouteOptions.jsx';
import RouteSteps from './components/RouteSteps.jsx';
import HomeView from './components/HomeView.jsx';
import LinesView, { LineDetail } from './components/LinesView.jsx';
import SettingsView from './components/SettingsView.jsx';
import BottomNav from './components/BottomNav.jsx';
import LocationNotice from './components/LocationNotice.jsx';
import { AlertBanner, BusLegend } from './components/Realtime.jsx';
import { ChevronIcon, LocateIcon, PinIcon, PlaneIcon, SwapIcon } from './components/icons.jsx';

const ALERT_MINUTES = 5;
const WATCH_KEY = 'citybus.watch';
const loadWatch = () => {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY)) ?? null; } catch { return null; }
};
const saveWatch = (w) => {
  try { if (w) localStorage.setItem(WATCH_KEY, JSON.stringify(w)); else localStorage.removeItem(WATCH_KEY); } catch { /* private mode */ }
};

/** "Bus is coming" alert: poll the next arrival and notify once it's ALERT_MINUTES away. */
function useBusAlert(lineById, lang) {
  const [watch, setWatch] = useState(loadWatch);
  const [info, setInfo] = useState(null);
  const [alerting, setAlerting] = useState(false);
  const alerted = useRef(null);

  useEffect(() => { saveWatch(watch); }, [watch]);

  useEffect(() => {
    if (!watch) return;
    let alive = true;
    alerted.current = null;
    setAlerting(false);
    setInfo(null);
    const check = async () => {
      try {
        const r = await api.arrivals(watch);
        if (!alive) return;
        const next = r.arrivals[0] ?? null;
        setInfo({ next, now: r.now });
        if (alerted.current && r.now - alerted.current.at > 3) {
          setWatch(null); // the bus we alerted about has come and gone
          return;
        }
        if (next && next.at - r.now <= ALERT_MINUTES && !alerted.current) {
          alerted.current = { at: next.at };
          setAlerting(true);
          const s = t(lang);
          const code = lineById.get(watch.lineId)?.code ?? '';
          const body = s.alertBody(Math.max(1, Math.round(next.at - r.now)), label(watch.stopName, lang));
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(s.alertTitle(code), { body, tag: 'citybus-alert', icon: '/bus.svg' });
            }
          } catch { /* some mobile browsers only allow notifications from a service worker */ }
          navigator.vibrate?.([250, 120, 250]);
        }
      } catch { /* keep the last info; try again next tick */ }
    };
    check();
    const id = setInterval(check, 15000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  const toggle = useCallback((target) => {
    setWatch((cur) => {
      const same = cur && cur.stopId === target.stopId && cur.lineId === target.lineId && cur.dir === target.dir;
      if (same) return null;
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      return target;
    });
  }, []);

  return { watch, info, alerting, toggle, stop: () => setWatch(null) };
}

// Used when GPS is unavailable or the device is outside Phnom Penh (e.g. a judge's laptop).
const DEMO_LOCATION = { lat: 11.5697, lng: 104.9211, demo: true };
const PP_CENTER = { lat: 11.556, lng: 104.92 };
const ROUGH_M = 3000; // worse than ±3 km = a guess from the internet connection, not GPS/Wi-Fi
const POPULAR = ['kti', 'central-market', 'royal-palace', 'aeon2', 'russian-market', 'rupp'];

const kmBetween = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 109);
const pointKey = (p) => (p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : '');

function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

const LANG_KEY = 'citybus.lang';
function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'km' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return navigator.language?.startsWith('km') ? 'km' : 'en';
}

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const s = t(lang);

  // Remember the choice, and tell browsers and screen readers which language the page is in.
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked */ }
  }, [lang]);
  const isDesktop = useIsDesktop();

  // home | trip (map + planner) | lines | nearby | settings
  const [view, setView] = useState('home');
  const [focusTarget, setFocusTarget] = useState(null); // 'to' | 'ask' — what to focus when the planner opens

  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);
  const [buses, setBuses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(0);

  const [here, setHere] = useState(DEMO_LOCATION);
  const [locating, setLocating] = useState(false);
  const [originPlace, setOriginPlace] = useState(null); // null = use `here`
  const [destination, setDestination] = useState(null);
  const [lineFocusId, setLineFocusId] = useState(null); // a line opened from the Lines tab

  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [onlyServing, setOnlyServing] = useState(true);
  const [nearby, setNearby] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelRef = useRef(null);

  const origin = originPlace ?? here;

  // Load the network, retrying every 5 s so the app recovers by itself once the server is up.
  useEffect(() => {
    let alive = true;
    let timer;
    const load = () =>
      api.network()
        .then((n) => { if (alive) { setNetwork(n); setNow(n.now); setError(null); } })
        .catch(() => { if (alive) { setError(t(lang).error); timer = setTimeout(load, 5000); } });
    load();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let alive = true;
    const tick = () => api.buses().then((r) => { if (alive) { setBuses(r.buses); setSummary(r.summary); setNow(r.now); } }).catch(() => {});
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Why we are (not) using the real position, so the app can say so instead of silently showing
  // the demo spot: { kind: 'ok' | 'rough' | 'far' | 'denied' | 'unavailable' | 'timeout' | 'unsupported', km? }
  const [locStatus, setLocStatus] = useState(null);
  const locate = useCallback(async () => {
    if (!navigator.geolocation) { setLocStatus({ kind: 'unsupported' }); return; }
    setLocating(true);
    const fix = (opts) => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
    const apply = (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const km = kmBetween(p, PP_CENTER);
      // Use it if it's in Phnom Penh, even when rough (better than nothing) — but say it's a guess.
      setHere(km < 40 ? p : DEMO_LOCATION);
      if (pos.coords.accuracy > ROUGH_M) setLocStatus({ kind: 'rough', km: Math.max(1, Math.round(pos.coords.accuracy / 1000)) });
      else setLocStatus(km < 40 ? { kind: 'ok' } : { kind: 'far', km: Math.round(km) });
    };
    let first;
    try {
      // 1) Quick Wi-Fi/cell fix: fast, works indoors. Shown straight away — no waiting for GPS.
      first = await fix({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
    } catch (err) {
      setLocating(false);
      setHere(DEMO_LOCATION);
      setOriginPlace(null);
      setLocStatus({ kind: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable' });
      return;
    }
    setLocating(false);
    setOriginPlace(null);
    apply(first);
    // 2) Only a rough guess (e.g. from the internet connection on a computer)? Ask for real GPS
    //    in the background, and switch to it if it's better.
    if (first.coords.accuracy > ROUGH_M) {
      fix({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
        .then((better) => { if (better.coords.accuracy < first.coords.accuracy) apply(better); })
        .catch(() => { /* keep the rough fix and its message */ });
    }
  }, []);
  useEffect(() => { locate(); }, [locate]);

  // Plan whenever start or destination changes (unless the assistant already returned this plan).
  const planKey = destination ? `${pointKey(origin)}>${pointKey(destination)}` : '';
  useEffect(() => {
    if (!planKey) { setPlan(null); return; }
    if (plan?.key === planKey) return;
    let cancelled = false;
    setPlanning(true);
    setSelected(null);
    api.plan(origin, destination)
      .then((p) => { if (!cancelled) setPlan({ ...p, key: planKey }); })
      .catch(() => { if (!cancelled) setError(s.error); })
      .finally(() => { if (!cancelled) setPlanning(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  // Nearby stops for the starting point.
  const originKey = pointKey(origin);
  useEffect(() => {
    // Ignore answers for a previous position: when GPS arrives right after the demo
    // location, the older (slower) response must not overwrite the newer one.
    let current = true;
    const load = () => api.nearby(origin).then((r) => { if (current) setNearby(r); }).catch(() => {});
    load();
    const id = setInterval(load, 20000); // arrival times move with the buses
    return () => { current = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey]);

  const lineById = useMemo(() => new Map((network?.lines ?? []).map((l) => [l.id, l])), [network]);
  const alert = useBusAlert(lineById, lang);
  const stopById = useMemo(() => new Map((network?.stops ?? []).map((st) => [st.id, st])), [network]);
  const placeById = useMemo(() => new Map((network?.places ?? []).map((p) => [p.id, p])), [network]);

  const focusLineIds = useMemo(() => {
    if (!destination) return lineFocusId ? new Set([lineFocusId]) : null;
    // Only use a plan that belongs to the current destination, so the reveal never draws stale lines.
    if (!onlyServing || !plan?.servingLines?.length || plan.key !== planKey) return null;
    return new Set(plan.servingLines.map((x) => x.lineId));
  }, [destination, onlyServing, plan, planKey, lineFocusId]);

  // ---- Navigation ----
  const navigate = (to) => {
    setView(to);
    setFocusTarget(to === 'trip' && !destination ? 'to' : null);
    panelRef.current?.scrollTo({ top: 0 });
  };
  const openPlanner = (focus = null) => {
    setView('trip');
    setFocusTarget(focus);
    setSheetOpen(Boolean(focus)); // typing needs room on a phone
  };

  const chooseDestination = (place) => {
    setDestination(place);
    setLineFocusId(null);
    setAnswer(null);
    setView('trip');
    setFocusTarget(null);
    setSheetOpen(false); // keep the map visible: the highlighted lines are the answer
    panelRef.current?.scrollTo({ top: 0 });
  };
  const swap = () => {
    if (!destination) return;
    const oldOrigin = originPlace ?? { ...here, name: { en: s.myLocation, km: t('km').myLocation } };
    setOriginPlace(destination);
    setDestination(oldOrigin);
  };
  const reset = () => {
    setDestination(null);
    setSelected(null);
    setAnswer(null);
  };
  const showLine = (lineId) => {
    reset();
    setLineFocusId(lineId);
    setView('trip');
    setFocusTarget(null);
    setSheetOpen(false);
  };

  const ask = async (question) => {
    setAsking(true);
    try {
      const res = await api.ask(question, here);
      setAnswer(res);
      if (res.language && res.language !== lang) setLang(res.language);
      if (res.origin && !res.origin.isCurrentLocation) setOriginPlace(res.origin);
      if (res.origin?.isCurrentLocation) setOriginPlace(null);
      if (res.destination) {
        setDestination(res.destination);
        setLineFocusId(null);
        setSelected(null);
        if (res.plan) setPlan({ ...res.plan, key: `${pointKey(res.origin)}>${pointKey(res.destination)}` });
      }
      setSheetOpen(true);
    } catch {
      setAnswer({ answer: s.error, engine: 'keywords', language: lang });
    } finally {
      setAsking(false);
    }
  };

  // Keep the route clear of the panel: left panel on desktop, bottom sheet on phones.
  const sheetHeight = sheetOpen ? 0.82 : 0.48;
  const fitPadding = isDesktop
    ? { topLeft: [40, 40], bottomRight: [40, 40] }
    : { topLeft: [24, 70], bottomRight: [24, Math.round(window.innerHeight * sheetHeight) + 16] };

  const originText = originPlace
    ? label(originPlace.name, lang)
    : locating ? s.locating : here.demo ? s.demoLocation : s.myLocation;

  const isTrip = view === 'trip';
  const fullPage = !isDesktop && !isTrip; // home, lines, nearby, settings cover the whole phone screen
  const showNav = isDesktop || !isTrip;

  const asideClass = isDesktop
    ? 'flex h-full min-h-0 flex-col overflow-hidden bg-mist' // panel scrolls inside; never pushes the bottom bar off-screen
    : fullPage
      ? 'fixed inset-0 z-[1100] flex flex-col bg-mist'
      : 'fixed inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-2xl bg-white shadow-[0_-4px_24px_rgb(21_35_63/0.15)] transition-[height] duration-300';

  const tripPanel = (
    <>
      {!isDesktop && (
        <button
          type="button"
          onClick={() => setSheetOpen((o) => !o)}
          className="sticky top-0 z-10 flex w-full justify-center bg-white pb-1 pt-2"
          aria-label={sheetOpen ? s.collapse : s.expand}
          aria-expanded={sheetOpen}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </button>
      )}

      <header className="flex items-center gap-2 px-4 pb-1 pt-1 md:pt-5">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="-ml-1.5 flex items-center gap-1 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-ink-soft hover:bg-mist hover:text-ink"
        >
          <ChevronIcon dir="left" className="size-4" />
          {s.backHome}
        </button>
        <h1 className="ml-auto flex items-center gap-2 text-base font-bold">
          <img src="/bus.svg" alt="" className="size-6" />
          {s.nav.directions}
        </h1>
      </header>

      <div className="space-y-5 px-4 pb-6 pt-3">
        {/* From / To */}
        <div className="relative space-y-2">
          <PlaceSearch
            key={focusTarget === 'from' ? 'from-focus' : 'from'}
            autoFocus={focusTarget === 'from'}
            fieldLabel={s.from}
            value={originPlace}
            valueText={originText}
            placeholder={s.from}
            onSelect={(p) => setOriginPlace(p)}
            onClear={originPlace ? () => setOriginPlace(null) : undefined}
            near={here}
            lang={lang}
            marker={<span className="size-3 rounded-full border-[3px] border-blue-600 bg-white" />}
            myLocationOption
            onMyLocation={locate}
          />
          <PlaceSearch
            key={focusTarget === 'to' ? 'to-focus' : 'to'}
            fieldLabel={s.to}
            value={destination}
            placeholder={s.whereTo}
            onSelect={chooseDestination}
            onClear={reset}
            near={here}
            lang={lang}
            marker={<PinIcon className="size-5 text-ink" />}
            autoFocus={focusTarget === 'to'}
          />
          {destination && (
            <button
              type="button"
              onClick={swap}
              className="absolute -right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-sm hover:text-ink"
              aria-label={s.swap}
              title={s.swap}
            >
              <SwapIcon className="size-4" />
            </button>
          )}
        </div>

        {!originPlace && <LocationNotice status={locStatus} locating={locating} lang={lang} onRetry={locate} onChooseStart={() => openPlanner('from')} />}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

        {network && !destination && lineFocusId && lineById.get(lineFocusId) && (
          <LineDetail key={lineFocusId} line={lineById.get(lineFocusId)} stopById={stopById} lang={lang} onClose={() => setLineFocusId(null)} />
        )}

        {network && !destination && (
          <>
            <section aria-labelledby="popular-h">
              <h2 id="popular-h" className="sr-only">{s.popular}</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((id) => placeById.get(id)).filter(Boolean).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => chooseDestination(p)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${p.category === 'airport' ? 'border-ink bg-ink text-white' : 'border-line hover:bg-mist'}`}
                  >
                    {p.category === 'airport' && <PlaneIcon className="size-3.5" />}
                    {label(p.name, lang)}
                  </button>
                ))}
              </div>
            </section>
            <AskBox
              key={focusTarget === 'ask' ? 'ask-focus' : 'ask'}
              lang={lang}
              aiEnabled={network.ai}
              onAsk={ask}
              loading={asking}
              answer={answer}
              autoFocus={focusTarget === 'ask'}
            />
            {nearby && (
              <NearbyStops nearby={nearby} now={now} lineById={lineById} lang={lang} watch={alert.watch} onWatch={alert.toggle} />
            )}
          </>
        )}

        {network && destination && !selected && (
          // Keyed by destination so the panel choreography replays for every new suggestion.
          <Fragment key={pointKey(destination)}>
            {answer && <AskBox lang={lang} aiEnabled={network.ai} onAsk={ask} loading={asking} answer={answer} />}
            {plan && (
              <LinesToHere
                destination={destination}
                servingLines={plan.servingLines}
                lineById={lineById}
                onlyServing={onlyServing}
                onToggle={setOnlyServing}
                lang={lang}
              />
            )}
            {planning && <p className="text-sm text-ink-soft" role="status">{s.thinking}</p>}
            {plan && !planning && (
              <RouteOptions plan={plan} lineById={lineById} lang={lang} onSelect={(o) => { setSelected(o); setSheetOpen(false); }} />
            )}
          </Fragment>
        )}

        {network && destination && selected && (
          <RouteSteps
            option={selected}
            destination={destination}
            lineById={lineById}
            stopById={stopById}
            lang={lang}
            onBack={() => setSelected(null)}
            now={now}
            watch={alert.watch}
            onWatch={alert.toggle}
          />
        )}

      </div>
    </>
  );

  const nearbyPage = (
    <div className="space-y-4 px-4 pb-6 pt-5">
      <h1 id="nearby-page-h" className="text-xl font-bold">{s.nearbyTitle}</h1>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-line">
        <span className="flex min-w-0 items-center gap-2 text-ink-soft">
          <span className="size-2.5 shrink-0 rounded-full border-2 border-blue-600" />
          <span className="truncate">{originText}</span>
        </span>
        <button type="button" onClick={locate} className="flex shrink-0 items-center gap-1.5 font-semibold text-blue-700">
          <LocateIcon />
          {locating ? s.locating : s.refreshLocation}
        </button>
      </div>
      {!originPlace && <LocationNotice status={locStatus} locating={locating} lang={lang} onRetry={locate} onChooseStart={() => openPlanner('from')} />}
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
        {nearby && (
          <NearbyStops nearby={nearby} now={now} lineById={lineById} lang={lang} watch={alert.watch} onWatch={alert.toggle} limit={5} showHeading={false} />
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full md:grid md:grid-cols-[minmax(360px,420px)_1fr] md:grid-rows-[minmax(0,1fr)]" lang={lang}>
      <aside className={asideClass} style={!isDesktop && isTrip ? { height: `${sheetHeight * 100}dvh` } : undefined}>
        {/* `relative` keeps absolutely positioned bits (e.g. screen-reader-only labels) inside the scroll area. */}
        <div ref={panelRef} className={`relative min-h-0 flex-1 overflow-y-auto ${isTrip ? 'bg-white' : ''}`}>
          {view === 'home' && (
            <HomeView
              lang={lang}
              onToggleLang={() => setLang(lang === 'en' ? 'km' : 'en')}
              network={network}
              buses={buses}
              summary={summary}
              origin={origin}
              originText={originText}
              placeById={placeById}
              lineById={lineById}
              now={now}
              watch={alert.watch}
              watchInfo={alert.info}
              onSearch={() => openPlanner('to')}
              onAsk={() => openPlanner('ask')}
              onPick={chooseDestination}
              onOpenMap={() => { reset(); setLineFocusId(null); openPlanner(null); }}
              onCityLines={() => navigate('lines')}
              onAirport={() => placeById.get('kti') && chooseDestination(placeById.get('kti'))}
              onNearby={() => navigate('nearby')}
              onBell={() => (alert.watch ? openPlanner(null) : navigate('settings'))}
              locationNotice={!originPlace && <LocationNotice status={locStatus} locating={locating} lang={lang} onRetry={locate} onChooseStart={() => openPlanner('from')} />}
              isDesktop={isDesktop}
            />
          )}
          {view === 'trip' && tripPanel}
          {view === 'lines' && network && <LinesView network={network} lang={lang} onShowLine={showLine} />}
          {view === 'nearby' && nearbyPage}
          {view === 'settings' && (
            <SettingsView lang={lang} setLang={setLang} aiEnabled={network?.ai} watch={alert.watch} lineById={lineById} onStopWatch={alert.stop} />
          )}
          {error && !isTrip && <p className="mx-4 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        </div>
        {showNav && <BottomNav view={view} lang={lang} onNavigate={navigate} />}
      </aside>

      <main className="fixed inset-0 md:relative md:h-full">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1050] flex flex-col items-center gap-2 p-3">
          {alert.watch && (
            <AlertBanner
              watch={alert.watch}
              info={alert.info}
              alerting={alert.alerting}
              lineById={lineById}
              now={now}
              lang={lang}
              onStop={alert.stop}
            />
          )}
          <div className="self-end md:hidden"><BusLegend summary={summary} lang={lang} compact /></div>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-3 z-[1050] hidden md:block">
          <BusLegend summary={summary} lang={lang} />
        </div>
        {network && (
          <MapView
            network={network}
            buses={buses}
            origin={origin}
            destination={destination}
            focusLineIds={focusLineIds}
            lineFocusId={destination ? null : lineFocusId}
            option={selected}
            lang={lang}
            fitPadding={fitPadding}
          />
        )}
      </main>
    </div>
  );
}

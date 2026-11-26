import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { label, t } from '../i18n.js';
import LineBadge from './LineBadge.jsx';

const LANG_KEY = 'citybus.lang';
const initialLang = () => {
  try { return localStorage.getItem(LANG_KEY) === 'km' ? 'km' : 'en'; } catch { return 'en'; }
};

const KIND_STYLE = {
  came: 'bg-green-50 text-green-800 ring-green-200',
  missed: 'bg-red-50 text-red-800 ring-red-200',
  full: 'bg-amber-50 text-amber-900 ring-amber-300',
};
const ISSUE_STYLE = {
  'no-show': 'border-l-red-600',
  'gps-frozen': 'border-l-amber-500',
  crowded: 'border-l-blue-600',
};

/**
 * For the bus operator (open /operator): what passengers reported in the last hour,
 * turned into things to act on — buses that didn't come, GPS units to repair, lines
 * that need more buses. Passengers, GPS and the timetable feeding each other.
 * `embedded`: shown on top of the app (guided demo), in the app's language, with a close button.
 */
export default function OperatorView({ embedded = false, lang: appLang, onClose }) {
  const [ownLang, setLang] = useState(initialLang);
  const lang = embedded ? appLang : ownLang;
  const s = t(lang);
  const [network, setNetwork] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (embedded) return;
    document.documentElement.lang = lang;
    document.title = `${s.ops.title} · ${s.appName}`;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked */ }
  }, [lang, s, embedded]);

  useEffect(() => {
    api.network().then(setNetwork).catch(() => setError(true));
    let alive = true;
    const load = () => api.reports()
      .then((d) => { if (alive) { setData(d); setError(false); } })
      .catch(() => { if (alive) setError(true); });
    load();
    const id = setInterval(load, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const lineById = useMemo(() => new Map((network?.lines ?? []).map((l) => [l.id, l])), [network]);
  const stopById = useMemo(() => new Map((network?.stops ?? []).map((st) => [st.id, st])), [network]);
  const stopName = (id) => label(stopById.get(id)?.name, lang) || id;
  const towards = (lineId, dir) => {
    const h = lineById.get(lineId)?.headsigns?.[dir];
    return h ? s.towards(label(h, lang)) : '';
  };

  const issueText = (i) => {
    if (i.type === 'no-show') return { main: s.ops.noShow(i.count, stopName(i.stopId)), sub: s.ops.noShowGps[i.gps] };
    if (i.type === 'gps-frozen') return { main: s.ops.gpsFrozen(stopName(i.stopId), i.minAgo) };
    return { main: s.ops.crowded(i.count, i.buses) };
  };

  const tracking = data?.tracking;
  const onRoad = tracking ? tracking.live + tracking.estimated + tracking.lost : 0;

  return (
    <div className="h-full overflow-y-auto bg-mist" lang={lang}>
      {/* Embedded: room at the top for the demo bar. */}
      <div className={`mx-auto max-w-5xl px-4 pb-10 ${embedded ? 'pt-20' : 'pt-6'}`}>
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <img src="/logo.svg" alt="" className="size-9" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{s.ops.title}</h1>
            <p className="text-sm text-ink-soft">{s.ops.subtitle}</p>
          </div>
          {embedded ? (
            <button type="button" onClick={onClose} className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">{s.ops.back}</button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
                className="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:bg-white"
                lang={lang === 'en' ? 'km' : 'en'}
              >
                {s.switchLanguage}
              </button>
              <a href="/" className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">{s.ops.back}</a>
            </>
          )}
        </header>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{s.error}</p>}

        <section aria-label={s.ops.lastHour} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {['came', 'missed', 'full'].map((k) => (
            <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <p className="text-sm text-ink-soft">{s.ops.counts[k]}</p>
              <p className="text-3xl font-bold tabular-nums" data-count={k}>{data?.counts[k] ?? '–'}</p>
              <p className="text-xs text-ink-faint">{s.ops.lastHour}</p>
            </div>
          ))}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="text-sm text-ink-soft">{s.ops.tracking}</p>
            <p className="text-3xl font-bold tabular-nums">{tracking ? onRoad : '–'}</p>
            {tracking && (
              <p className="text-xs text-ink-faint">
                {tracking.live} {s.ops.trackedLive} · {tracking.byPassengers} {s.ops.trackedByPassengers} · {tracking.suspect} {s.ops.ignored}
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="issues-h">
            <h2 id="issues-h" className="mb-2 font-semibold">{s.ops.issues}</h2>
            {data && !data.issues.length && <p className="rounded-2xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">{s.ops.noIssues}</p>}
            <ul className="space-y-2">
              {data?.issues.map((i) => {
                const line = lineById.get(i.lineId);
                const { main, sub } = issueText(i);
                return (
                  <li key={`${i.type}-${i.tripId ?? `${i.lineId}-${i.dir}`}`} className={`rounded-xl border-l-4 bg-white p-3.5 ring-1 ring-line ${ISSUE_STYLE[i.type]}`} data-issue={i.type}>
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                      {line && <LineBadge line={line} size="sm" />}
                      {i.busNo && <span className="font-semibold">{s.bus(i.busNo)}</span>}
                      <span className="text-ink-soft">{towards(i.lineId, i.dir)}</span>
                      {i.minAgo != null && <span className="ml-auto text-xs text-ink-faint">{s.ops.minAgo(i.minAgo)}</span>}
                    </p>
                    <p className="text-sm font-medium">{main}</p>
                    {sub && <p className="text-sm text-ink-soft">{sub}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="recent-h">
            <h2 id="recent-h" className="mb-2 font-semibold">{s.ops.recent}</h2>
            {data && !data.reports.length && <p className="rounded-2xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">{s.ops.noReports}</p>}
            {data?.reports.length > 0 && (
              <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                {data.reports.map((r, k) => {
                  const line = lineById.get(r.lineId);
                  return (
                    <li key={`${r.tripId}-${r.kind}-${k}`} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm" data-report-row={r.kind}>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${KIND_STYLE[r.kind]}`}>{s.ops.counts[r.kind]}</span>
                      {line && <LineBadge line={line} size="sm" />}
                      {r.busNo && <span className="text-ink-soft">{r.busNo}</span>}
                      <span className="min-w-0 flex-1 truncate">{label(r.stopName, lang)}</span>
                      <span className="text-xs text-ink-faint">{s.ops.minAgo(r.minAgo)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <p className="mt-8 text-xs text-ink-faint">{s.ops.privacy} {s.ops.refreshing}. {network?.data?.kind === 'gtfs' ? s.dataFrom(network.data.name) : s.sample}</p>
      </div>
    </div>
  );
}

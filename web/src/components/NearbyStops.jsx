import LineBadge from './LineBadge.jsx';
import { ArrivalTime, ReportNote } from './Realtime.jsx';
import { distance, label, t } from '../i18n.js';

/** The closest stops, when the next buses come, and a bell to get alerted. */
export default function NearbyStops({ nearby, now, lineById, lang, watch, onWatch, limit = 3, showHeading = true }) {
  const s = t(lang);
  return (
    // On the Nearby page the page title already says this, so the section skips its own heading.
    <section aria-labelledby={showHeading ? 'nearby-h' : 'nearby-page-h'}>
      {showHeading && <h2 id="nearby-h" className="mb-2 text-sm font-semibold text-ink-soft">{s.nearbyStops}</h2>}
      {!nearby.stops.length && <p className="text-sm text-ink-soft">{s.noNearby}</p>}
      <ul className="space-y-3">
        {nearby.stops.slice(0, limit).map((stop) => (
          <li key={stop.stopId} className="rounded-xl border border-line px-3.5 py-3">
            <p className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{label(stop.name, lang)}</span>
              <span className="shrink-0 text-xs text-ink-faint">{distance(stop.meters, lang)}</span>
            </p>
            <ul className="space-y-1">
              {stop.departures.filter((d) => d.arrivals.length).slice(0, 4).map((d) => {
                const line = lineById.get(d.lineId);
                const next = d.arrivals[0];
                const watching = Boolean(watch && watch.stopId === stop.stopId && watch.lineId === d.lineId && watch.dir === d.dir);
                return (
                  <li key={`${d.lineId}-${d.dir}`} className="flex flex-wrap items-center gap-x-2 text-sm">
                    <LineBadge line={line} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{s.towards(label(d.headsign, lang))}</span>
                    <ArrivalTime arrival={next} now={now} lang={lang} className="shrink-0" />
                    <button
                      type="button"
                      onClick={() => onWatch({ stopId: stop.stopId, stopName: stop.name, lineId: d.lineId, dir: d.dir })}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-base leading-none ${watching ? 'bg-signal' : 'opacity-60 hover:bg-mist hover:opacity-100'}`}
                      aria-pressed={watching}
                      aria-label={`${s.notifyWhenNear}: ${line.code}`}
                      title={s.notifyWhenNear}
                    >
                      🔔
                    </button>
                    <ReportNote arrival={next} lang={lang} className="w-full pb-1 pl-9" />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

import LineBadge from './LineBadge.jsx';
import { ArrivalTime } from './Realtime.jsx';
import { label, t } from '../i18n.js';
import { CloseIcon, PinIcon } from './icons.jsx';

/**
 * Shown when you reach a bus stop: the next buses there, live. If you have a
 * route open and this is where you board, your bus comes first, in large type.
 */
export default function AtStopCard({ stop, now, lineById, lang, yourBus, onClose }) {
  const s = t(lang);
  const deps = stop.departures.filter((d) => d.arrivals.length);
  const isYours = (d) => yourBus && d.lineId === yourBus.lineId && d.dir === yourBus.dir;
  const mine = deps.find(isYours);
  const others = deps.filter((d) => !isYours(d)).slice(0, mine ? 2 : 4);

  return (
    <section
      aria-labelledby="atstop-h"
      className="rise pointer-events-auto w-full max-w-md rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-line"
    >
      <div className="mb-2 flex items-center gap-2">
        <PinIcon className="size-5 shrink-0 text-blue-600" />
        <h2 id="atstop-h" className="min-w-0 flex-1 truncate font-bold">{s.atStop(label(stop.name, lang))}</h2>
        <button type="button" onClick={onClose} className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-ink" aria-label={s.close}>
          <CloseIcon />
        </button>
      </div>

      {mine && (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-ink px-3 py-2.5 text-white" data-your-bus="">
          <span className="sr-only">{s.yourBus}:</span>
          <LineBadge line={lineById.get(mine.lineId)} size="lg" className="ring-2 ring-white/90" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-white/75">{s.yourBus}</span>
            <span className="block truncate text-sm">{s.towards(label(mine.headsign, lang))}</span>
          </span>
          {/* White on the dark box whatever the source (live / estimated / timetable). */}
          <ArrivalTime arrival={mine.arrivals[0]} now={now} lang={lang} className="shrink-0 text-xl !text-white [&_.live-dot]:bg-green-400" />
        </div>
      )}

      {others.length > 0 ? (
        <ul className="space-y-1">
          {others.map((d) => (
            <li key={`${d.lineId}-${d.dir}`} className="flex items-center gap-2 text-sm">
              <LineBadge line={lineById.get(d.lineId)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{s.towards(label(d.headsign, lang))}</span>
              <ArrivalTime arrival={d.arrivals[0]} now={now} lang={lang} className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        !mine && <p className="text-sm text-ink-soft">{s.noUpcoming}</p>
      )}
    </section>
  );
}

import LineBadge from './LineBadge.jsx';
import { ArrivalTime, ReportNote } from './Realtime.jsx';
import { label, t } from '../i18n.js';
import { CloseIcon, PinIcon } from './icons.jsx';

/** "Didn't come" only makes sense once the bus is due (≤ 2 min away or late). */
const DUE_MIN = 2;

/**
 * Shown when you reach a bus stop: the next buses there, live. If you have a
 * route open and this is where you board, your bus comes first, in large type.
 * One tap tells everyone else about the next bus: it's here, it didn't come, or it's full.
 */
export default function AtStopCard({ stop, now, lineById, lang, yourBus, onClose, reported = {}, flash, reportError, onReport }) {
  const s = t(lang);
  const deps = stop.departures.filter((d) => d.arrivals.length);
  const isYours = (d) => yourBus && d.lineId === yourBus.lineId && d.dir === yourBus.dir;
  const mine = deps.find(isYours);
  const others = deps.filter((d) => !isYours(d)).slice(0, mine ? 2 : 4);

  // The bus to report about: yours, or else whichever comes first — skipping buses you already reported.
  const target = [mine, ...[...others].sort((a, b) => a.arrivals[0].at - b.arrivals[0].at)]
    .find((d) => d && d.arrivals[0].tripId && !reported[d.arrivals[0].tripId]);
  const arrival = target?.arrivals[0];
  const targetLine = target && lineById.get(target.lineId);
  const due = arrival && arrival.at - now <= DUE_MIN;
  const thanks = flash?.stopId === stop.stopId ? flash.kind : null;
  const canReport = onReport && targetLine;

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
        <div className="mb-2">
          <div className="flex items-center gap-3 rounded-xl bg-brand px-3 py-2.5 text-white" data-your-bus="">
            <span className="sr-only">{s.yourBus}:</span>
            <LineBadge line={lineById.get(mine.lineId)} size="lg" className="ring-2 ring-white/90" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-white">{s.yourBus}</span>
              <span className="block truncate text-sm">{s.towards(label(mine.headsign, lang))}</span>
            </span>
            {/* White on the dark box whatever the source (live / estimated / timetable). */}
            <ArrivalTime arrival={mine.arrivals[0]} now={now} lang={lang} className="shrink-0 text-xl !text-white [&_.live-dot]:bg-green-400" />
          </div>
          <ReportNote arrival={mine.arrivals[0]} lang={lang} className="mt-1.5 px-1" />
        </div>
      )}

      {others.length > 0 ? (
        <ul className="space-y-1">
          {others.map((d) => (
            <li key={`${d.lineId}-${d.dir}`} className="flex flex-wrap items-center gap-x-2 text-sm">
              <LineBadge line={lineById.get(d.lineId)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{s.towards(label(d.headsign, lang))}</span>
              <ArrivalTime arrival={d.arrivals[0]} now={now} lang={lang} className="shrink-0" />
              <ReportNote arrival={d.arrivals[0]} lang={lang} className="w-full pb-0.5 pl-9" />
            </li>
          ))}
        </ul>
      ) : (
        !mine && <p className="text-sm text-ink-soft">{s.noUpcoming}</p>
      )}

      {thanks ? (
        <p role="status" className="mt-3 border-t border-line pt-3 text-sm font-medium text-green-800">
          <span aria-hidden>✓ </span>{s.report.thanks[thanks]}
        </p>
      ) : canReport && (
        <div className="mt-3 border-t border-line pt-3" data-report="">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <LineBadge line={targetLine} size="sm" />
            {s.report.ask(targetLine.code)}
          </p>
          <div className="flex gap-2">
            {[
              { kind: 'came', text: s.report.came, cls: 'bg-green-700 text-white hover:bg-green-800' },
              due && { kind: 'missed', text: s.report.missed, cls: 'text-red-800 ring-1 ring-red-200 hover:bg-red-50' },
              { kind: 'full', text: s.report.full, cls: 'text-amber-900 ring-1 ring-amber-300 hover:bg-amber-50' },
            ].filter(Boolean).map((b) => (
              <button
                key={b.kind}
                type="button"
                onClick={() => onReport(stop, target, arrival, b.kind)}
                className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-sm font-semibold ${b.cls}`}
              >
                {b.text}
              </button>
            ))}
          </div>
          {reportError
            ? <p role="alert" className="mt-1.5 text-xs text-red-800">{s.report.failed}</p>
            : <p className="mt-1.5 text-xs text-ink-soft">{s.report.why}</p>}
        </div>
      )}
    </section>
  );
}

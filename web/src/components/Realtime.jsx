import LineBadge from './LineBadge.jsx';
import { clock, label, roundMin, t } from '../i18n.js';
import { CloseIcon } from './icons.jsx';
import { BUS_SVG } from './busShape.js';

/**
 * "4 min" with a mark that says how much to trust it:
 *   live (green signal dot) · ~estimated · timetable (clock).
 */
export function ArrivalTime({ arrival, now, lang, className = '' }) {
  const s = t(lang);
  const mins = Math.max(0, Math.round(arrival.at - now));
  const text = mins > 90 ? clock(arrival.at) : s.in(mins);
  const title = `${s.source[arrival.source]}${arrival.delayMin >= 1 ? `, ${s.late(Math.round(arrival.delayMin))}` : ''}`;
  if (arrival.source === 'live') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${className}`} title={title}>
        <span className="live-dot" aria-hidden />
        {text}
        <span className="sr-only">({s.source.live})</span>
      </span>
    );
  }
  if (arrival.source === 'estimated') {
    return (
      <span className={`font-semibold tabular-nums text-amber-800 ${className}`} title={title}>
        ~{text}
        <span className="sr-only">({s.source.estimated})</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums text-ink-soft ${className}`} title={title}>
      <span aria-hidden>◷</span>
      {text}
      <span className="sr-only">({s.source.timetable})</span>
    </span>
  );
}

/** What other passengers said about this bus: it's full, it didn't come, where it was seen. */
export function ReportNote({ arrival, lang, className = '' }) {
  const r = arrival?.reports;
  if (!r || (!r.full && !r.missed && !r.seen)) return null;
  const s = t(lang);
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${className}`}>
      {r.full && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{s.note.full}</span>}
      {r.missed > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-800">{s.note.missed(r.missed)}</span>}
      {r.seen && <span className="text-ink-soft">{s.note.seen(label(r.seen.stopName, lang), r.seen.minAgo)}</span>}
    </span>
  );
}

/** The map's bus marker, small, for the legend. */
function MiniBus({ status = 'live' }) {
  return (
    <span className={`bus-marker is-${status} is-legend`} aria-hidden dangerouslySetInnerHTML={{ __html: `${BUS_SVG}${status === 'suspect' ? '<span class="bus-code">?</span>' : ''}` }} />
  );
}

/** Map legend: how many buses are live, estimated, or ignored as suspect right now. */
export function BusLegend({ summary, lang, compact = false }) {
  const s = t(lang);
  if (!summary) return null;
  const rows = [
    { key: 'live', count: summary.live, mark: <MiniBus /> },
    { key: 'estimated', count: summary.estimated + summary.lost, mark: <MiniBus status="estimated" /> },
    { key: 'suspect', count: summary.suspect, mark: <MiniBus status="suspect" /> },
  ];
  if (compact) {
    // Phones: one small row of marks and counts; full labels are on the home page and in tooltips.
    return (
      <ul className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/95 px-3 py-1.5 text-xs shadow-md ring-1 ring-line" aria-label={s.legendTitle}>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-1" title={s.legend[r.key]}>
            {r.mark}
            <span className="font-semibold tabular-nums">{r.count}</span>
            <span className="sr-only">{s.legend[r.key]}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="pointer-events-auto rounded-xl bg-white/95 px-3 py-2 text-xs shadow-md ring-1 ring-line">
      <p className="mb-1 font-semibold">{s.legendTitle}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.mark}
            <span className="flex-1 text-ink-soft">{s.legend[r.key]}</span>
            <span className="font-semibold tabular-nums">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Floating banner for the "bus is coming" alert. Turns yellow when it's time to go. */
export function AlertBanner({ watch, info, alerting, lineById, now, lang, onStop }) {
  const s = t(lang);
  const line = lineById.get(watch.lineId);
  if (!line) return null;
  const next = info?.next;
  const mins = next ? roundMin(next.at - now) : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-lg ring-1 ${
        alerting ? 'bg-signal text-ink ring-ink/20' : 'bg-white text-ink ring-line'
      }`}
    >
      <span className="text-lg" aria-hidden>🔔</span>
      <LineBadge line={line} />
      <span className="min-w-0 text-sm leading-snug">
        <span className="block truncate font-semibold">
          {alerting ? s.getReady : s.watching(s.lineLabel(line.code), label(watch.stopName, lang))}
        </span>
        <span className="block truncate">
          {next ? (
            <>
              {s.arrivingIn(mins)}{' '}
              <span className="text-xs opacity-75">({s.source[next.source].toLowerCase()})</span>
            </>
          ) : info ? s.noUpcoming : '…'}
        </span>
      </span>
      <button type="button" onClick={onStop} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-black/10" aria-label={s.stopWatching} title={s.stopWatching}>
        <CloseIcon />
      </button>
    </div>
  );
}

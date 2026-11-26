import LineBadge from './LineBadge.jsx';
import { JourneyStrip } from './RouteOptions.jsx';
import { ArrivalTime, ReportNote } from './Realtime.jsx';
import RideToStop from './RideToStop.jsx';
import { ChevronIcon, PinIcon, WalkIcon } from './icons.jsx';
import { clock, distance, label, roundMin, t } from '../i18n.js';

/** Step-by-step directions drawn as a vertical line, coloured like the bus you're on. */
export default function RouteSteps({ option, destination, lineById, stopById, lang, onBack, now, watch, onWatch }) {
  const s = t(lang);
  const firstBusIdx = option.legs.findIndex((l) => l.type === 'bus');
  return (
    <section aria-labelledby="steps-h">
      <button type="button" onClick={onBack} className="-ml-1 mb-3 flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronIcon dir="left" className="size-4" />
        {s.back}
      </button>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="steps-h" className="text-2xl font-bold leading-tight">{s.min(roundMin(option.durationMin))}</h2>
          <p className="text-sm text-ink-soft">{s.arrive(clock(option.arriveMin))}, {s.transfers(option.transfers).toLowerCase()}</p>
        </div>
        <JourneyStrip option={option} lineById={lineById} />
      </div>

      <ol>
        {option.legs.map((leg, i) => {
          if (leg.type === 'walk') {
            const isLast = i === option.legs.length - 1;
            const target = isLast ? label(destination?.name, lang) || s.destination : label(leg.to.name, lang);
            return (
              <li key={i} className="rise grid grid-cols-[2.75rem_1fr] gap-x-2" style={{ '--d': `${120 + i * 120}ms` }}>
                <span className="flex justify-center">
                  <span className="w-0 border-l-[3px] border-dotted border-walk" />
                </span>
                <div className="py-3">
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <WalkIcon />
                    <span>
                      {s.walk(distance(leg.meters, lang), roundMin(leg.minutes))}
                      <span className="block text-ink">{target}</span>
                    </span>
                  </p>
                  {/* The walk to the first bus stop, and from the last stop to the destination, can be a ride. */}
                  {i === 0 && leg.to.stopId && <RideToStop leg={leg} lang={lang} />}
                  {isLast && i > 0 && !leg.to.stopId && <RideToStop leg={leg} lang={lang} toName={target} />}
                </div>
              </li>
            );
          }
          const line = lineById.get(leg.lineId);
          const middle = leg.stopIds.slice(1, -1);
          return (
            <li key={i} className="rise grid grid-cols-[2.75rem_1fr] gap-x-2" style={{ '--d': `${120 + i * 120}ms` }}>
              <span className="relative flex justify-center">
                <span className="absolute inset-y-3 w-1.5 rounded-full" style={{ background: line.color }} />
                <span className="relative mt-3 size-3.5 rounded-full border-[3px] bg-white" style={{ borderColor: line.color }} />
                <span className="absolute bottom-3 size-3.5 rounded-full border-[3px] bg-white" style={{ borderColor: line.color }} />
              </span>
              <div className="py-1.5">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{label(leg.from.name, lang)}</span>
                  <span className="text-sm font-semibold tabular-nums">{clock(leg.departMin)}</span>
                </p>
                <div className="my-2 rounded-lg bg-mist px-3 py-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <LineBadge line={line} />
                    <span className="text-sm">{s.towards(label(leg.headsign, lang))}</span>
                  </p>
                  {i === firstBusIdx && leg.realtime ? (
                    <>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
                        <span className="text-ink-soft">{s.nextBus}</span>
                        <ArrivalTime arrival={leg.realtime} now={now} lang={lang} />
                        <span className="text-ink-soft">({clock(leg.realtime.at)})</span>
                        {leg.realtime.delayMin >= 1 && <span className="text-amber-800">{s.late(Math.round(leg.realtime.delayMin))}</span>}
                      </p>
                      <ReportNote arrival={leg.realtime} lang={lang} className="mt-1" />
                    </>
                  ) : (
                    <p className="mt-1 text-[13px] text-ink-soft">{s.waitFor(Math.round(leg.waitMin))}</p>
                  )}
                  {middle.length > 0 ? (
                    <details className="mt-1 text-[13px] text-ink-soft">
                      <summary className="cursor-pointer select-none">{s.rideStops(leg.numStops, roundMin(leg.minutes))}</summary>
                      <ul className="mt-1 space-y-0.5 pl-3">
                        {middle.map((id) => <li key={id}>{label(stopById.get(id).name, lang)}</li>)}
                      </ul>
                    </details>
                  ) : (
                    <p className="mt-1 text-[13px] text-ink-soft">{s.rideStops(leg.numStops, roundMin(leg.minutes))}</p>
                  )}
                  {i === firstBusIdx && (() => {
                    const target = { stopId: leg.from.stopId, stopName: leg.from.name, lineId: leg.lineId, dir: leg.dir };
                    const active = Boolean(watch && watch.stopId === target.stopId && watch.lineId === target.lineId && watch.dir === target.dir);
                    return (
                      <button
                        type="button"
                        onClick={() => onWatch(target)}
                        aria-pressed={active}
                        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-signal text-ink' : 'bg-brand text-white hover:bg-brand-dark'}`}
                      >
                        <span aria-hidden>🔔</span>
                        {active ? s.alertOn : s.notifyWhenNear}
                      </button>
                    );
                  })()}
                </div>
                <p className="flex items-baseline justify-between gap-2">
                  <span>{s.getOff(label(leg.to.name, lang))}</span>
                  <span className="text-sm tabular-nums text-ink-soft">{clock(leg.arriveMin)}</span>
                </p>
              </div>
            </li>
          );
        })}
        <li className="rise grid grid-cols-[2.75rem_1fr] gap-x-2" style={{ '--d': `${120 + option.legs.length * 120}ms` }}>
          <span className="flex justify-center pt-0.5 text-ink"><PinIcon className="size-5" /></span>
          <p className="flex items-baseline justify-between gap-2 py-0.5 font-semibold">
            <span>{s.arriveAt(label(destination?.name, lang) || s.destination)}</span>
            <span className="text-sm tabular-nums">{clock(option.arriveMin)}</span>
          </p>
        </li>
      </ol>
    </section>
  );
}

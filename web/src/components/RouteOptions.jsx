import { Fragment } from 'react';
import LineBadge from './LineBadge.jsx';
import { ChevronIcon, WalkIcon } from './icons.jsx';
import { clock, distance, roundMin, t } from '../i18n.js';

/** The journey as a strip: walk → [3] → [AEB] → walk. */
export function JourneyStrip({ option, lineById }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-ink-soft">
      {option.legs.map((leg, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronIcon className="size-3 text-ink-faint" />}
          {leg.type === 'walk' ? <WalkIcon /> : <LineBadge line={lineById.get(leg.lineId)} />}
        </Fragment>
      ))}
    </span>
  );
}

export default function RouteOptions({ plan, lineById, lang, onSelect }) {
  const s = t(lang);
  return (
    <section aria-labelledby="routes-h">
      <h2 id="routes-h" className="mb-2 text-sm font-semibold text-ink-soft">{s.routes}</h2>
      {plan.extendedWalk && <p className="mb-2 text-sm text-ink-soft">{s.extendedWalk}</p>}
      {plan.walkOnly && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-mist px-3 py-2 text-sm">
          <WalkIcon />
          {s.walkOnly(roundMin(plan.walkOnly.minutes), distance(plan.walkOnly.meters, lang))}
        </p>
      )}
      {!plan.options.length && !plan.walkOnly && <p className="text-sm text-ink-soft">{s.noRoutes}</p>}

      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {plan.options.map((opt, i) => {
          const firstBus = opt.legs.find((l) => l.type === 'bus');
          return (
            <li key={opt.id} className="rise" style={{ '--d': `${420 + i * 90}ms` }}>
              <button
                type="button"
                onClick={() => onSelect(opt)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3.5 py-3 text-left hover:bg-mist"
              >
                <JourneyStrip option={opt} lineById={lineById} />
                <span className="row-span-2 text-right">
                  <span className="block text-xl font-bold leading-none">{roundMin(opt.durationMin)}</span>
                  <span className="text-xs text-ink-soft">{lang === 'km' ? 'នាទី' : 'min'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
                  <span>{s.arrive(clock(opt.arriveMin))}</span>
                  {opt.transfers > 0 && <span>{s.transfers(opt.transfers)}</span>}
                  {opt.walkMeters >= 300 && <span>{s.walkTotal(distance(opt.walkMeters, lang))}</span>}
                  {/* One tag is enough: the most useful thing about this option. */}
                  {opt.tags?.[0] && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${opt.tags[0] === 'recommended' ? 'bg-ink text-white' : 'bg-mist text-ink-soft'}`}>
                      {s.tag[opt.tags[0]]}
                    </span>
                  )}
                  {firstBus && <span className="sr-only">{clock(firstBus.departMin)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

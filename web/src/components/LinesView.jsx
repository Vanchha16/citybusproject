import LineBadge from './LineBadge.jsx';
import { ChevronIcon, CloseIcon } from './icons.jsx';
import { label, t } from '../i18n.js';

function LineFacts({ line, lang }) {
  const s = t(lang);
  return (
    <span className="flex flex-wrap gap-x-3 text-[13px] text-ink-soft">
      <span>{s.every(line.headwayMin)}</span>
      <span>{s.hours(line.serviceStart, line.serviceEnd)}</span>
      <span>{s.stopsCount(line.stops.length)}</span>
    </span>
  );
}

/** Every line, grouped city / airport, like the official "browse lines" list. */
export default function LinesView({ network, lang, onShowLine }) {
  const s = t(lang);
  const groups = [
    { key: 'city', title: s.cityGroup, lines: network.lines.filter((l) => l.kind === 'city') },
    { key: 'airport', title: s.airportGroup, lines: network.lines.filter((l) => l.kind === 'airport') },
  ];
  return (
    <div className="px-4 pb-6 pt-5">
      <h1 className="mb-4 text-xl font-bold">{s.allLines}</h1>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`grp-${g.key}`} className="mb-6">
          <h2 id={`grp-${g.key}`} className="mb-2 text-sm font-semibold text-ink-soft">{g.title}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
            {g.lines.map((line) => (
              <li key={line.id}>
                <button type="button" onClick={() => onShowLine(line.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-mist">
                  <LineBadge line={line} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{label(line.name, lang)}</span>
                    <LineFacts line={line} lang={lang} />
                  </span>
                  <ChevronIcon className="size-4 shrink-0 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** One line opened from the list: facts and its stops in order, drawn on the map meanwhile. */
export function LineDetail({ line, stopById, lang, onClose }) {
  const s = t(lang);
  return (
    <section aria-labelledby="line-h" className="rise rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="mb-3 flex items-start gap-3">
        <LineBadge line={line} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="line-h" className="font-semibold leading-snug">{label(line.name, lang)}</h2>
          <LineFacts line={line} lang={lang} />
        </div>
        <button type="button" onClick={onClose} className="-mr-1.5 -mt-1 flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-ink" aria-label={s.close}>
          <CloseIcon />
        </button>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-ink-soft">{s.lineStops}</h3>
      <ol className="relative ml-1.5 border-l-4 py-1 pl-4" style={{ borderColor: line.color }}>
        {line.stops.map((id, i) => (
          <li key={id} className="pop relative py-1 text-sm" style={{ '--d': `${150 + i * 50}ms`, display: 'block' }}>
            <span className="absolute -left-[1.6rem] top-2.5 size-3 rounded-full border-[3px] bg-white" style={{ borderColor: line.color }} />
            {label(stopById.get(id)?.name, lang)}
          </li>
        ))}
      </ol>
    </section>
  );
}

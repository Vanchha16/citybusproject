import LineBadge from './LineBadge.jsx';
import { label, t } from '../i18n.js';

/**
 * "Buses that go to Techo International Airport": only the lines that actually
 * stop near the destination, so passengers aren't shown irrelevant routes.
 */
export default function LinesToHere({ destination, servingLines, lineById, onlyServing, onToggle, lang }) {
  const s = t(lang);
  const placeName = label(destination.name, lang);
  return (
    <section aria-labelledby="lines-h" className="rise rounded-xl bg-ink px-4 py-3.5 text-white" style={{ '--d': '80ms' }}>
      <h2 id="lines-h" className="text-[15px] font-semibold">{s.linesHere(placeName)}</h2>
      {servingLines.length === 0 ? (
        <p className="mt-1 text-sm text-white/75">{s.noLinesHere}</p>
      ) : (
        <>
          {/* Just the badges: line names live in the Lines tab and in each badge's tooltip. */}
          <ul className="mt-3 flex flex-wrap gap-2">
            {servingLines.map(({ lineId }, i) => {
              const line = lineById.get(lineId);
              return (
                <li key={lineId} title={label(line.name, lang)}>
                  {/* Badges pop in one by one, in step with their lines drawing on the map. */}
                  <span className="pop" style={{ '--d': `${300 + i * 110}ms` }}>
                    <LineBadge line={line} size="lg" className="ring-2 ring-white/90" />
                  </span>
                </li>
              );
            })}
          </ul>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/85">
            <input type="checkbox" checked={onlyServing} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-signal" />
            {s.onlyTheseLines}
          </label>
        </>
      )}
    </section>
  );
}

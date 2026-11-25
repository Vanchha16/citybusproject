import LineBadge from './LineBadge.jsx';
import Flag from './Flag.jsx';
import { label, t } from '../i18n.js';

export default function SettingsView({ lang, setLang, aiEnabled, watch, lineById, onStopWatch, onStartDemo }) {
  const s = t(lang);
  const line = watch ? lineById.get(watch.lineId) : null;
  return (
    <div className="space-y-6 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold">{s.settingsTitle}</h1>

      <button
        type="button"
        onClick={onStartDemo}
        className="flex w-full items-center gap-3 rounded-2xl bg-brand px-4 py-3.5 text-left text-white shadow-sm hover:bg-brand-dark"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-signal text-ink" aria-hidden>▶</span>
        <span>
          <span className="block font-semibold">{s.demo.start}</span>
          <span className="block text-sm text-white">{s.demo.hint}</span>
        </span>
      </button>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h" className="mb-2 text-sm font-semibold text-ink-soft">{s.language}</h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="radiogroup" aria-labelledby="lang-h">
          {[
            { code: 'km', text: 'ភាសាខ្មែរ' },
            { code: 'en', text: 'English' },
          ].map((o) => (
            <button
              key={o.code}
              type="button"
              role="radio"
              aria-checked={lang === o.code}
              onClick={() => setLang(o.code)}
              lang={o.code}
              className={`flex items-center justify-center gap-2.5 rounded-lg py-2.5 font-semibold ${lang === o.code ? 'bg-brand text-white' : 'text-ink-soft hover:bg-mist'}`}
            >
              <Flag code={o.code} className="h-[18px] w-7" />
              {o.text}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="alerts-h" className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 id="alerts-h" className="mb-2 font-semibold">{s.alertsTitle}</h2>
        {watch && line ? (
          <div className="flex items-center gap-2 text-sm">
            <LineBadge line={line} size="sm" />
            <span className="flex-1">{s.watching(s.lineLabel(line.code), label(watch.stopName, lang))}</span>
            <button type="button" onClick={onStopWatch} className="rounded-lg px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50">
              {s.stopWatching}
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{s.noAlert}</p>
        )}
      </section>

      <section aria-labelledby="ai-h" className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 id="ai-h" className="mb-1 font-semibold">{s.aiTitle}</h2>
        <p className="text-sm text-ink-soft">{aiEnabled ? s.aiOn : s.aiOff}</p>
      </section>

      <section aria-labelledby="about-h" className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 id="about-h" className="mb-1 font-semibold">{s.about}</h2>
        <p className="text-sm leading-relaxed text-ink-soft">{s.sample}</p>
      </section>
    </div>
  );
}

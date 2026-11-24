import { kmNum, t } from '../i18n.js';
import { ChevronIcon, CloseIcon } from './icons.jsx';

/** Caption + controls shown on top of everything while the guided demo runs. */
export default function DemoBar({ demo, lang }) {
  const s = t(lang);
  if (demo.step === null) return null;
  const n = (x) => (lang === 'km' ? kmNum(x) : x);
  const btn = 'flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-30';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[1300] flex justify-center px-3">
      <div
        role="region"
        aria-label={s.demo.start}
        data-demo-bar=""
        className="pointer-events-auto flex w-full max-w-xl items-center gap-1 rounded-2xl bg-ink/95 py-1.5 pl-3 pr-1.5 text-white shadow-xl ring-1 ring-white/10 backdrop-blur"
      >
        <span className="shrink-0 rounded-full bg-signal px-2 py-0.5 text-xs font-bold text-ink tabular-nums">
          {n(demo.step + 1)}/{n(demo.total)}
        </span>
        {/* key: the caption fades in again on every step */}
        <p key={`${demo.step}-${lang}`} className="rise min-w-0 flex-1 truncate px-2 text-[15px] font-semibold" aria-live="polite">
          {s.demo.steps[demo.step]}
        </p>
        <button type="button" className={btn} onClick={() => { demo.setPlaying(false); demo.prev(); }} disabled={demo.step === 0} aria-label={s.demo.prev}>
          <ChevronIcon dir="left" className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => demo.setPlaying(!demo.playing)} aria-label={demo.playing ? s.demo.pause : s.demo.play}>
          {demo.playing ? <span aria-hidden className="text-sm">❚❚</span> : <span aria-hidden className="text-sm">▶</span>}
        </button>
        <button type="button" className={btn} onClick={() => { demo.setPlaying(false); demo.next(); }} aria-label={s.demo.next}>
          <ChevronIcon className="size-4" />
        </button>
        <button type="button" className={btn} onClick={demo.stop} aria-label={s.demo.exit}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

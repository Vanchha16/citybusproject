import { t } from '../i18n.js';

/**
 * One short line saying why the app is using the demo spot instead of your
 * position, with a way to try again. Shows nothing when location works.
 */
export default function LocationNotice({ status, locating, lang, onRetry, className = '' }) {
  const s = t(lang);
  if (!status || status.kind === 'ok' || locating) return null;
  const text = status.kind === 'far' ? s.loc.far(status.km) : s.loc[status.kind];
  return (
    <div role="status" className={`flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200 ${className}`}>
      <span aria-hidden>⚠</span>
      <span className="min-w-0 flex-1">
        {text}
        {status.kind === 'denied' && <span className="block text-amber-800">{s.locDeniedHelp}</span>}
      </span>
      {status.kind !== 'unsupported' && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          {s.tryAgain}
        </button>
      )}
    </div>
  );
}

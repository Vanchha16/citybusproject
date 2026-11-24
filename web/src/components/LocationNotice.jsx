import { t } from '../i18n.js';

/**
 * One short line saying why the app isn't using your exact position, with
 * "Try again" and "Choose start". Shows nothing when location works.
 */
export default function LocationNotice({ status, locating, lang, onRetry, onChooseStart, className = '' }) {
  const s = t(lang);
  if (!status || status.kind === 'ok' || locating) return null;
  const text = status.kind === 'far' || status.kind === 'rough' ? s.loc[status.kind](status.km) : s.loc[status.kind];
  // A precise far-away position or no location support won't change by retrying.
  const canRetry = status.kind !== 'unsupported' && status.kind !== 'far';
  return (
    <div role="status" className={`rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200 ${className}`}>
      <p className="flex items-start gap-2">
        <span aria-hidden>⚠</span>
        <span className="min-w-0 flex-1">
          {text}
          {status.kind === 'denied' && <span className="block text-amber-800">{s.locDeniedHelp}</span>}
        </span>
      </p>
      <p className="mt-1 flex justify-end gap-4 font-semibold">
        {canRetry && (
          <button type="button" onClick={onRetry} className="underline underline-offset-2">{s.tryAgain}</button>
        )}
        <button type="button" onClick={onChooseStart} className="underline underline-offset-2">{s.chooseStart}</button>
      </p>
    </div>
  );
}

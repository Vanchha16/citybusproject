import { useRef, useState } from 'react';
import { label, t } from '../i18n.js';
import { RIDE_APPS, rideMinutes, storeUrl } from '../rides.js';
import { ChevronIcon, CloseIcon } from './icons.jsx';

/**
 * "Ride instead" for the walk to the first bus stop: one small button in the
 * route steps, opening a popup (bottom sheet on phones) with Grab, PassApp and
 * a street motodop / tuk-tuk. Grab/PassApp open their official store pages and
 * the stop name is copied to paste as the drop-off.
 */
export default function RideToStop({ leg, lang }) {
  const s = t(lang);
  const dialogRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const stopName = label(leg.to.name, lang);
  const minutes = rideMinutes(leg.meters);

  const contentRef = useRef(null);
  const openSheet = () => {
    setCopied(false);
    dialogRef.current?.showModal();
    // Focus the popup itself, not the ✕ (which would show a focus ring after a finger tap).
    contentRef.current?.focus();
  };
  const closeSheet = () => dialogRef.current?.close();
  const openApp = async (app) => {
    try {
      await navigator.clipboard?.writeText(stopName);
      setCopied(true);
    } catch { /* clipboard blocked: the store page still opens */ }
    window.open(storeUrl(app), '_blank', 'noopener');
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand ring-1 ring-line hover:bg-mist"
        data-ride-to-stop=""
      >
        <span aria-hidden>🛵</span>
        {s.rideInstead(minutes)}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="ride-h"
        onClick={(e) => { if (e.target === dialogRef.current) closeSheet(); }} // tap outside closes
        className="ride-sheet m-0 mt-auto w-full max-w-none rounded-t-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/40 md:m-auto md:max-w-sm md:rounded-2xl"
      >
        <div ref={contentRef} tabIndex={-1} className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 outline-none">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="ride-h" className="truncate text-lg font-bold">{s.rideTo(stopName)}</h2>
              <p className="text-sm text-ink-soft">{s.rideAbout(minutes)}</p>
            </div>
            <button type="button" onClick={closeSheet} className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-mist hover:text-ink" aria-label={s.close}>
              <CloseIcon />
            </button>
          </div>

          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
            {RIDE_APPS.map((app) => (
              <li key={app.key}>
                <button type="button" onClick={() => openApp(app)} className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold hover:bg-mist">
                  {/* The app's own icon; the text already names it, so screen readers skip the picture. */}
                  <img src={app.icon} alt="" width="36" height="36" className="size-9 shrink-0 rounded-[22%] ring-1 ring-line" />
                  <span className="min-w-0 flex-1">{s.openApp(app.name)}</span>
                  <ChevronIcon className="size-4 shrink-0 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">{s.streetRide}</p>
          {copied && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-[13px] text-ink-soft" role="status">{s.stopCopied}</p>}
        </div>
      </dialog>
    </>
  );
}

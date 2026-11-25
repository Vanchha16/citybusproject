import { useState } from 'react';
import { label, t } from '../i18n.js';
import { RIDE_APPS, rideMinutes, storeUrl } from '../rides.js';

/**
 * Under the walk to the first bus stop: the same trip by Grab / PassApp, or a
 * motodop / tuk-tuk from the street. Tapping an app copies the stop name (to
 * paste as the drop-off) and opens the app's official store page.
 */
export default function RideToStop({ leg, lang }) {
  const s = t(lang);
  const [copied, setCopied] = useState(false);
  const stopName = label(leg.to.name, lang);

  const open = async (app) => {
    try {
      await navigator.clipboard?.writeText(stopName);
      setCopied(true);
    } catch { /* clipboard blocked: the store page still opens */ }
    window.open(storeUrl(app), '_blank', 'noopener');
  };

  return (
    <div className="mt-2 rounded-lg bg-mist px-3 py-2.5" data-ride-to-stop="">
      <p className="text-[13px] font-semibold text-ink">{s.orRide(rideMinutes(leg.meters))}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {RIDE_APPS.map((app) => (
          <button
            key={app.key}
            type="button"
            onClick={() => open(app)}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand ring-1 ring-line hover:bg-white/70"
          >
            {s.openApp(app.name)}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[13px] text-ink-soft">{s.streetRide}</p>
      {copied && <p className="mt-1 text-[12px] text-ink-soft" role="status">{s.stopCopied}</p>}
    </div>
  );
}

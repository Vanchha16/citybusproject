import LiveMapPreview from './LiveMapPreview.jsx';
import { BusLegend } from './Realtime.jsx';
import LineBadge from './LineBadge.jsx';
import Flag from './Flag.jsx';
import { label, roundMin, t } from '../i18n.js';
import { BellIcon, BusIcon, LocateIcon, PinIcon, PlaneIcon, SparkIcon } from './icons.jsx'; // PlaneIcon: tiles + airport chip

const POPULAR = ['kti', 'central-market', 'royal-palace', 'aeon2', 'russian-market', 'rupp'];

/** Home: search first, then the live network, services and what's happening now. */
export default function HomeView({
  lang, onToggleLang, network, buses, summary, origin, originText, placeById, lineById, now,
  watch, watchInfo, onSearch, onAsk, onPick, onOpenMap, onCityLines, onAirport, onNearby, onBell, isDesktop,
  locationNotice, stopCard,
}) {
  const s = t(lang);
  const running = summary ? summary.live + summary.estimated + summary.lost : 0;
  const watchLine = watch ? lineById.get(watch.lineId) : null;

  return (
    <div className="pb-6">
      {/* Header band */}
      <header className="rounded-b-[28px] bg-ink px-4 pb-14 pt-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/bus.svg" alt="" className="size-10 rounded-xl ring-2 ring-white/20" />
            <h1 className="text-lg font-bold leading-tight">{s.appName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLang}
              className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-2 pr-3 text-sm font-medium hover:bg-white/20"
              lang={lang === 'en' ? 'km' : 'en'}
            >
              <Flag code={lang === 'en' ? 'km' : 'en'} className="h-4 w-6" />
              {s.switchLanguage}
            </button>
            <button type="button" onClick={onBell} className="relative rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label={s.alertsTitle}>
              <BellIcon />
              {watch && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-signal ring-2 ring-ink" />}
            </button>
          </div>
        </div>
      </header>

      {/* Search: the main job of the app */}
      <div className="relative mx-4 -mt-10 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => onSearch('to')}
          className="flex w-full items-center gap-3 rounded-xl bg-mist px-3.5 py-3.5 text-left hover:bg-line/60"
        >
          <PinIcon className="size-5 text-ink" />
          <span className="flex-1 text-[16px] font-medium text-ink-soft">{s.whereTo}</span>
        </button>
        <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-ink-soft">
            <span className="size-2.5 shrink-0 rounded-full border-2 border-blue-600" />
            <span className="truncate">{s.fromHere(originText)}</span>
          </span>
          <button type="button" onClick={onAsk} className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-semibold text-ink hover:bg-mist">
            <SparkIcon />
            {s.askShort}
          </button>
        </div>
      </div>

      {stopCard && <div className="mx-4 mt-3">{stopCard}</div>}
      {locationNotice && <div className="mx-4 mt-2">{locationNotice}</div>}

      {/* Quick destinations */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {POPULAR.map((id) => placeById.get(id)).filter(Boolean).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium shadow-sm ring-1 ${
              p.category === 'airport' ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:bg-mist'
            }`}
          >
            {p.category === 'airport' && <PlaneIcon className="size-3.5" />}
            {label(p.name, lang)}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6 px-4">
        {!isDesktop && network && <LiveMapPreview network={network} buses={buses} origin={origin} lang={lang} onOpen={onOpenMap} />}

        {/* Services */}
        <section aria-labelledby="services-h">
          <h2 id="services-h" className="mb-2.5 text-[15px] font-bold">{s.services}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { key: 'city', text: s.tileCity, icon: <BusIcon />, onClick: onCityLines },
              { key: 'airport', text: s.tileAirport, icon: <PlaneIcon className="size-6" />, onClick: onAirport, strong: true },
              { key: 'nearby', text: s.tileNearby, icon: <LocateIcon className="size-6" />, onClick: onNearby },
            ].map((tile) => (
              <button
                key={tile.key}
                type="button"
                onClick={tile.onClick}
                className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1.5 pb-3 pt-4 text-center shadow-sm ring-1 ${
                  tile.strong ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:bg-mist'
                }`}
              >
                <span className={`flex size-11 items-center justify-center rounded-full ${tile.strong ? 'bg-white/15' : 'bg-mist'}`}>{tile.icon}</span>
                {/* Always wraps on narrow phones instead of running past the tile edge. */}
                <span className="w-full whitespace-normal text-balance text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]">{tile.text}</span>
              </button>
            ))}
          </div>
        </section>

        {/* What's happening now */}
        <section aria-labelledby="now-h" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div>
              <h2 id="now-h" className="text-[15px] font-bold">{s.serviceNow}</h2>
              <p className="text-sm text-ink-soft">{s.running(running)}</p>
            </div>
            <div className="[&>ul]:shadow-none [&>ul]:ring-0 [&>ul]:px-0">
              <BusLegend summary={summary} lang={lang} compact />
            </div>
          </div>
          {/* Only when an alert is on — no explanation text otherwise. */}
          {watch && watchLine && (
            <button type="button" onClick={onBell} className="mt-3 flex w-full items-center gap-2 border-t border-line pt-3 text-left text-sm">
              <span aria-hidden>🔔</span>
              <LineBadge line={watchLine} size="sm" />
              <span className="flex-1 truncate">{label(watch.stopName, lang)}</span>
              {watchInfo?.next && <span className="shrink-0 font-semibold">{s.arrivingIn(roundMin(watchInfo.next.at - now))}</span>}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

import { t } from '../i18n.js';
import { GearIcon, HomeIcon, LinesIcon, LocateIcon, RouteIcon } from './icons.jsx';

/** Five tabs; "Directions" in the middle is the main action, so it is raised and filled. */
export default function BottomNav({ view, lang, onNavigate }) {
  const s = t(lang);
  const items = [
    { key: 'home', icon: <HomeIcon /> },
    { key: 'lines', icon: <LinesIcon /> },
    { key: 'trip', icon: <RouteIcon />, main: true, labelKey: 'directions' },
    { key: 'nearby', icon: <LocateIcon className="size-5" /> },
    { key: 'settings', icon: <GearIcon /> },
  ];
  return (
    <nav aria-label="Main" className="shrink-0 border-t border-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
      <ul className="grid grid-cols-5 items-start">
        {items.map((it) => {
          const active = view === it.key;
          const text = s.nav[it.labelKey ?? it.key];
          if (it.main) {
            return (
              <li key={it.key} className="flex justify-center">
                {/* Stays inside the bar (no overlap with the page); emphasis comes from size and fill. */}
                <button
                  type="button"
                  onClick={() => onNavigate(it.key)}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="flex h-10 w-14 items-center justify-center rounded-2xl bg-ink text-white shadow-md">{it.icon}</span>
                  <span className="text-[11px] font-semibold leading-tight">{text}</span>
                </button>
              </li>
            );
          }
          return (
            <li key={it.key} className="flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate(it.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-xl py-1 ${active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
              >
                <span className={`flex h-8 w-11 items-center justify-center rounded-xl ${active ? 'bg-ink text-white' : ''}`}>{it.icon}</span>
                <span className={`text-[11px] leading-tight ${active ? 'font-semibold' : ''}`}>{text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

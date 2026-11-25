import { useMemo } from 'react';
import { t } from '../i18n.js';
import { ChevronIcon } from './icons.jsx';

// The city core, in the card's wide shape, so it shows the network rather than the long road to the airport.
const B = { minLat: 11.52, maxLat: 11.612, minLng: 104.845, maxLng: 104.975 };
const KX = Math.cos((11.57 * Math.PI) / 180);
const S = 1000;
const W = (B.maxLng - B.minLng) * KX * S;
const H = (B.maxLat - B.minLat) * S;
const xy = (lat, lng) => [(lng - B.minLng) * KX * S, (B.maxLat - lat) * S];

/**
 * A live diagram of the whole network for the home page: every line in its
 * colour and every bus gliding along it (positions refresh every few seconds).
 */
export default function LiveMapPreview({ network, buses, origin, lang, onOpen }) {
  const s = t(lang);
  const lineById = useMemo(() => new Map(network.lines.map((l) => [l.id, l])), [network]);
  const paths = useMemo(
    () => network.lines.map((l) => ({ id: l.id, color: l.color, d: l.geometry.map(([la, ln]) => xy(la, ln).join(',')).join(' ') })),
    [network],
  );
  const me = origin ? xy(origin.lat, origin.lng) : null;

  return (
    <section aria-labelledby="livemap-h" className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 id="livemap-h" className="text-[15px] font-bold">{s.liveMap}</h2>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
          <span className="rec-dot" aria-hidden />
          {s.liveTag}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="relative block h-48 w-full overflow-hidden rounded-xl bg-[#e7edf4] text-left">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          {paths.map((p) => (
            <polyline key={p.id} points={p.d} fill="none" stroke={p.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
          ))}
          {network.stops.map((st) => {
            const [x, y] = xy(st.lat, st.lng);
            return <circle key={st.id} cx={x} cy={y} r="0.9" fill="#fff" stroke="#15233f" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
          })}
          {buses.filter((b) => b.status !== 'suspect').map((b) => {
            const [x, y] = xy(b.lat, b.lng);
            return (
              <g key={b.id} className="preview-bus" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <circle r="2" fill={lineById.get(b.lineId)?.color ?? '#15233f'} stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {me && <circle cx={me[0]} cy={me[1]} r="2.2" fill="#2563eb" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-brand py-2 pl-4 pr-3 text-sm font-semibold text-white shadow-md">
          {s.openMap}
          <ChevronIcon className="size-4" />
        </span>
      </button>
    </section>
  );
}

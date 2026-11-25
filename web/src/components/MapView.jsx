import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import { label, t } from '../i18n.js';

const PHNOM_PENH = [11.556, 104.92];

const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
// The pin drops in with a ripple each time the marker mounts (it's keyed by destination).
const destIcon = L.divIcon({
  className: 'dest-pin',
  html: `<div class="dest-wrap"><span class="dest-ripple"></span><div class="dest-drop">
    <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true">
    <path d="M15 1C7.3 1 1 7.2 1 14.8 1 25 15 39 15 39s14-14 14-24.2C29 7.2 22.7 1 15 1z" fill="#FFC629" stroke="#15233F" stroke-width="2"/>
    <circle cx="15" cy="14.5" r="5" fill="#15233F"/></svg></div></div>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

/**
 * Leaflet handlers that make a polyline draw itself when it is added to the map.
 * `from: 1` draws start→end, `from: -1` draws end→start.
 */
const drawWhenAdded = ({ from = 1, delay = 0, duration = 1100, fade = false }) => ({
  add: (e) => {
    const el = e.target.getElement?.();
    if (!el) return;
    el.style.setProperty('--draw-delay', `${delay}ms`);
    if (fade) {
      el.classList.add('route-fade');
      return;
    }
    el.setAttribute('pathLength', '1'); // lets CSS treat every path as length 1
    el.style.setProperty('--draw-from', String(from));
    el.style.setProperty('--draw-dur', `${duration}ms`);
    el.classList.add('line-draw');
  },
});
const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const busIconCache = new Map();
function busIcon(code, color, status) {
  const key = `${code}|${color}|${status}`;
  if (!busIconCache.has(key)) {
    busIconCache.set(key, L.divIcon({
      className: '',
      html: `<div class="bus-marker is-${status}" style="background:${color}">${code}${status === 'suspect' ? '?' : ''}</div>`,
      iconSize: [34, 20],
      iconAnchor: [17, 10],
    }));
  }
  return busIconCache.get(key);
}

/** Keeps the view on whatever matters right now: the selected route, or origin + destination. */
/**
 * Follow me: keep the user's dot in view while walking. Dragging the map pauses
 * this (so people can look around) until they re-centre with the Follow button.
 */
function FollowCamera({ follow, paused, position, onUserPan }) {
  const map = useMap();
  useEffect(() => {
    if (!follow) return undefined;
    const onDrag = () => onUserPan?.();
    map.on('dragstart', onDrag);
    return () => map.off('dragstart', onDrag);
  }, [follow, map, onUserPan]);
  // Turning follow on (or re-centring) zooms in to street level once.
  useEffect(() => {
    if (follow && !paused && position) map.flyTo(position, Math.max(map.getZoom(), 16), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, paused]);
  // Then just glide along as the position updates.
  useEffect(() => {
    if (follow && !paused && position) map.panTo(position, { animate: true, duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1]]);
  return null;
}

/** Hands the Leaflet map to the app, and in pick mode a tap moves that spot under the centre pin. */
function MapBridge({ onReady, pickMode }) {
  const map = useMap();
  useEffect(() => { onReady?.(map); }, [map, onReady]);
  useEffect(() => {
    if (!pickMode) return undefined;
    const onClick = (e) => map.panTo(e.latlng, { animate: true });
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [map, pickMode]);
  return null;
}

function FitView({ bounds, padding, fitKey }) {
  const map = useMap();
  const key = fitKey ?? JSON.stringify(bounds);
  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    const opts = { paddingTopLeft: padding.topLeft, paddingBottomRight: padding.bottomRight, duration: 0.6, maxZoom: 16 };
    map.flyToBounds(bounds.length === 1 ? [bounds[0], bounds[0]] : bounds, opts);
    // Re-fit only when the bounds actually change, not on every bus refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, padding.bottomRight[1], padding.topLeft[0]]);
  return null;
}

export default function MapView({
  network, buses, origin, destination, focusLineIds, lineFocusId, option, lang, fitPadding,
  follow = false, followPaused = false, onUserPan, accuracyM = null, onReady, pickMode = false,
}) {
  const s = t(lang);
  const lineById = useMemo(() => new Map(network.lines.map((l) => [l.id, l])), [network]);
  const focused = (id) => !focusLineIds || focusLineIds.has(id);
  const routeLineIds = option ? new Set(option.legs.filter((l) => l.type === 'bus').map((l) => l.lineId)) : null;

  // Changes whenever a new place is suggested/chosen, which replays the reveal.
  const revealKey = destination
    ? `${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`
    : lineFocusId ? `line:${lineFocusId}` : 'none';

  // The chosen route draws leg by leg, in travel order.
  const legTimings = useMemo(() => {
    let at = 150;
    return (option?.legs ?? []).map((leg) => {
      const duration = leg.type === 'bus' ? 750 : 300;
      const timing = { delay: at, duration };
      at += duration - 80;
      return timing;
    });
  }, [option]);

  const bounds = useMemo(() => {
    if (option) return option.legs.flatMap((l) => l.geometry);
    if (destination) return [origin, destination].filter(Boolean).map((p) => [p.lat, p.lng]);
    if (lineFocusId) return lineById.get(lineFocusId)?.geometry ?? null;
    return null; // nothing chosen yet: keep the city-wide overview
  }, [option, origin, destination, lineFocusId, lineById]);

  // While following, walking must not re-fit the whole view on every step: only a new
  // route/destination/line does. (Otherwise the camera would fight the follow camera.)
  const fitKey = follow
    ? `${option?.id ?? ''}|${revealKey}`
    : undefined;

  return (
    <MapContainer center={PHNOM_PENH} zoom={12} zoomControl={false} className="h-full w-full" attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {/* Network lines: faded when a destination or route narrows the view. */}
      {network.lines.map((line) => {
        const dim = option ? true : !focused(line.id);
        // Lines that serve the new destination re-mount and draw toward it.
        const reveal = Boolean(focusLineIds && !option && focusLineIds.has(line.id) && (destination || lineFocusId));
        const dest = destination ? [destination.lat, destination.lng] : null;
        const towardEnd = !dest || sq(line.geometry.at(-1), dest) < sq(line.geometry[0], dest);
        return (
          <Polyline
            key={reveal ? `${line.id}@${revealKey}` : line.id}
            eventHandlers={reveal ? drawWhenAdded({ from: towardEnd ? 1 : -1, delay: 350 }) : undefined}
            positions={line.geometry}
            pathOptions={{
              color: line.color,
              weight: dim ? 3 : focusLineIds ? 6 : 4,
              opacity: dim ? 0.13 : 0.85,
            }}
          >
            {!dim && <Tooltip sticky>{`${line.code} · ${label(line.name, lang)}`}</Tooltip>}
          </Polyline>
        );
      })}

      {/* The chosen route on top: white casing + line colour; walking legs dotted. */}
      {option?.legs.map((leg, i) => {
        const { delay, duration } = legTimings[i];
        const k = `${option.id}-${i}`;
        return leg.type === 'bus' ? (
          [
            <Polyline key={`c${k}`} eventHandlers={drawWhenAdded({ delay, duration })} positions={leg.geometry} pathOptions={{ color: '#fff', weight: 11, opacity: 1 }} />,
            <Polyline key={`b${k}`} eventHandlers={drawWhenAdded({ delay, duration })} positions={leg.geometry} pathOptions={{ color: leg.color, weight: 7, opacity: 1 }} />,
          ]
        ) : (
          <Polyline
            key={`w${k}`}
            eventHandlers={drawWhenAdded({ delay, fade: true })}
            positions={leg.geometry}
            pathOptions={{ color: '#5b6b8a', weight: 4, dashArray: '2 8', lineCap: 'round' }}
          />
        );
      })}

      {network.stops.map((st) => {
        const onRoute = option?.legs.some((l) => l.type === 'bus' && l.stopIds.includes(st.id));
        const servesFocus = !option && focusLineIds && network.lines.some((l) => focusLineIds.has(l.id) && l.stops.includes(st.id));
        const strong = onRoute || servesFocus;
        return (
          <CircleMarker
            key={st.id}
            center={[st.lat, st.lng]}
            radius={strong ? 5 : 3.5}
            pathOptions={{ color: '#15233F', weight: strong ? 2 : 1, fillColor: '#fff', fillOpacity: 1, opacity: option && !onRoute ? 0.25 : 0.9 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>{label(st.name, lang)}</Tooltip>
          </CircleMarker>
        );
      })}

      {buses.map((b) => {
        const line = lineById.get(b.lineId);
        const hidden = routeLineIds ? !routeLineIds.has(b.lineId) : !focused(b.lineId);
        if (hidden) return null; // only show buses that matter for this trip
        const age = Math.max(1, Math.round(b.gpsAgeMin));
        const statusText = b.status === 'suspect' ? s.status.suspect(b.stillMin) : s.status[b.status](age);
        return (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={busIcon(line.code, line.color, b.status)}
            zIndexOffset={b.status === 'live' ? 600 : 400}
            keyboard={false}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{s.bus(b.busNo)}</strong> → {label(b.headsign, lang)}
              <br />
              {statusText}
              {b.status !== 'suspect' && <>, {s.late(Math.round(b.delayMin)).toLowerCase()}</>}
            </Tooltip>
          </Marker>
        );
      })}

      {/* How sure we are about your position: a soft circle around the dot. */}
      {origin && accuracyM > 15 && accuracyM < 3000 && (
        <Circle
          center={[origin.lat, origin.lng]}
          radius={accuracyM}
          interactive={false}
          pathOptions={{ color: '#2563eb', weight: 1, opacity: 0.35, fillColor: '#2563eb', fillOpacity: 0.1 }}
        />
      )}
      {origin && <Marker position={[origin.lat, origin.lng]} icon={meIcon} zIndexOffset={900} keyboard={false} />}
      {destination && (
        <Marker key={revealKey} position={[destination.lat, destination.lng]} icon={destIcon} zIndexOffset={1000} keyboard={false} />
      )}

      <MapBridge onReady={onReady} pickMode={pickMode} />
      {!pickMode && <FitView bounds={bounds} padding={fitPadding} fitKey={fitKey} />}
      <FollowCamera follow={follow} paused={followPaused} position={origin ? [origin.lat, origin.lng] : null} onUserPan={onUserPan} />
    </MapContainer>
  );
}

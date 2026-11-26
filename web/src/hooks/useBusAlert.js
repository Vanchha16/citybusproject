// "Bus is coming" alert: watch one line at one stop and notify when it is a few minutes away.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { label, t } from '../i18n.js';

export const ALERT_MINUTES = 5;

/** A system notification: through the service worker when there is one (Android needs that), else directly. */
async function notify(title, options) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return; }
  } catch { /* fall back below */ }
  try { new Notification(title, options); } catch { /* not allowed here */ }
}
const WATCH_KEY = 'citybus.watch';
const loadWatch = () => {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY)) ?? null; } catch { return null; }
};
const saveWatch = (w) => {
  try { if (w) localStorage.setItem(WATCH_KEY, JSON.stringify(w)); else localStorage.removeItem(WATCH_KEY); } catch { /* private mode */ }
};

/** "Bus is coming" alert: poll the next arrival and notify once it's ALERT_MINUTES away. */
export function useBusAlert(lineById, lang) {
  const [watch, setWatch] = useState(loadWatch);
  const [info, setInfo] = useState(null);
  const [alerting, setAlerting] = useState(false);
  const [recheck, setRecheck] = useState(0); // bump to check again now
  const alerted = useRef(null);

  useEffect(() => { saveWatch(watch); }, [watch]);

  useEffect(() => {
    if (!watch) return;
    let alive = true;
    alerted.current = null;
    setAlerting(false);
    setInfo(null);
    const check = async () => {
      try {
        const r = await api.arrivals(watch);
        if (!alive) return;
        const next = r.arrivals[0] ?? null;
        setInfo({ next, now: r.now });
        if (alerted.current && r.now - alerted.current.at > 3) {
          setWatch(null); // the bus we alerted about has come and gone
          return;
        }
        if (next && next.at - r.now <= ALERT_MINUTES && !alerted.current) {
          alerted.current = { at: next.at };
          setAlerting(true);
          const s = t(lang);
          const code = lineById.get(watch.lineId)?.code ?? '';
          const body = s.alertBody(Math.max(1, Math.round(next.at - r.now)), label(watch.stopName, lang));
          if ('Notification' in window && Notification.permission === 'granted') {
            notify(s.alertTitle(code), { body, tag: 'citybus-alert', icon: '/icons/icon-192.png' });
          }
          navigator.vibrate?.([250, 120, 250]);
        }
      } catch { /* keep the last info; try again next tick */ }
    };
    check();
    const id = setInterval(check, 15000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, recheck]);

  const toggle = useCallback((target) => {
    setWatch((cur) => {
      const same = cur && cur.stopId === target.stopId && cur.lineId === target.lineId && cur.dir === target.dir;
      if (same) return null;
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      return target;
    });
  }, []);

  /** Turn the alert on for `target` (no-op if it already is). */
  const set = useCallback((target) => {
    setWatch((cur) => (cur && cur.stopId === target.stopId && cur.lineId === target.lineId && cur.dir === target.dir ? cur : target));
  }, []);

  return { watch, info, alerting, toggle, set, stop: () => setWatch(null), recheck: () => setRecheck((n) => n + 1) };
}

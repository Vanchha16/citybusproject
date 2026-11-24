// Guided demo for the pitch: drives the real app (not a video) through a passenger's
// journey to the airport. Runs at 09:00 Phnom Penh time via the demo clock, so it
// works for rehearsals at night too. Arrow keys / Page Up / Page Down (presentation
// clickers) move between steps; Escape exits.
import { useCallback, useEffect, useRef, useState } from 'react';
import { setDemoClock } from './api.js';

export const DEMO_CLOCK_START = 9 * 60; // 09:00

// Each step runs against `a` (the app's actions). `fast` = replaying to get back to a later step.
export const DEMO_STEPS = [
  { key: 'start', run: (a) => a.reset() },
  { key: 'pick', run: (a) => a.pickAirport() },
  { key: 'lines', run: (a) => a.waitForPlan() },
  { key: 'route', run: async (a) => { await a.waitForPlan(); a.selectBestRoute(); } },
  { key: 'alert', run: (a) => a.alertFirstBus() },
  { key: 'walk', ms: 10_000, run: (a, fast) => a.walkToStop(fast) },
  { key: 'khmer', run: (a) => a.setLang('km') },
  { key: 'ask', ms: 8_000, run: (a) => a.askKhmer() },
  { key: 'end', run: () => {} },
];
const STEP_MS = 5_000;

export function useDemo(actionsRef) {
  const [step, setStep] = useState(null); // null = demo not running
  const [playing, setPlaying] = useState(true);
  const lastRun = useRef(-1);
  const runId = useRef(0);

  const goTo = useCallback(async (target) => {
    const k = Math.max(0, Math.min(DEMO_STEPS.length - 1, target));
    const id = ++runId.current;
    setStep(k);
    // Forward: run only the steps not done yet. Back: replay from the start (quickly) so the
    // screen is exactly what that step should show. Progress is recorded per finished step,
    // so a run interrupted by another key press never leaves a wrong "last step".
    const from = k > lastRun.current ? lastRun.current + 1 : 0;
    if (from === 0) lastRun.current = -1;
    for (let i = from; i <= k; i++) {
      if (runId.current !== id) return; // user already moved on
      await DEMO_STEPS[i].run(actionsRef.current, i < k);
      if (runId.current !== id) return;
      lastRun.current = i;
    }
  }, [actionsRef]);

  const start = useCallback(() => {
    setDemoClock(DEMO_CLOCK_START);
    actionsRef.current.enter();
    lastRun.current = -1;
    setPlaying(true);
    goTo(0);
  }, [actionsRef, goTo]);

  const stop = useCallback(() => {
    runId.current++;
    setDemoClock(null);
    actionsRef.current.exit();
    setStep(null);
  }, [actionsRef]);

  const next = useCallback(() => {
    if (step === null) return;
    if (step >= DEMO_STEPS.length - 1) stop();
    else goTo(step + 1);
  }, [step, goTo, stop]);
  const prev = useCallback(() => { if (step > 0) goTo(step - 1); }, [step, goTo]);

  // Auto-play.
  useEffect(() => {
    if (step === null || !playing || step >= DEMO_STEPS.length - 1) return undefined;
    const timer = setTimeout(next, DEMO_STEPS[step].ms ?? STEP_MS);
    return () => clearTimeout(timer);
  }, [step, playing, next]);

  // Keyboard and presentation clickers.
  useEffect(() => {
    if (step === null) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setPlaying(false); next(); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); setPlaying(false); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); setPlaying(false); goTo(0); }
      else if (e.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, next, prev, stop, goTo]);

  return { step, playing, setPlaying, start, stop, next, prev, total: DEMO_STEPS.length };
}

// The device: phone or desktop layout, the starting language, and installing the app.
import { useEffect, useState } from 'react';

export function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}


export const LANG_KEY = 'citybus.lang';
export function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'km' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return navigator.language?.startsWith('km') ? 'km' : 'en';
}

/** "Install the app": the browser's install prompt where there is one; iPhone gets instructions instead. */
export function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return {
    installed,
    canPrompt: Boolean(prompt),
    ios,
    install: async () => {
      if (!prompt) return;
      prompt.prompt();
      await prompt.userChoice.catch(() => {});
      setPrompt(null);
    },
  };
}

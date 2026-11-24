import { useId } from 'react';

/** Cambodia: blue–red–blue bands with a simplified white Angkor Wat. */
function CambodiaFlag() {
  return (
    <svg viewBox="0 0 60 40" className="h-full w-full" aria-hidden>
      <rect width="60" height="40" fill="#032EA1" />
      <rect y="10" width="60" height="20" fill="#E00025" />
      <g fill="#fff" stroke="#000" strokeWidth="0.35" strokeLinejoin="round">
        <rect x="17" y="26" width="26" height="2" />
        <rect x="19.5" y="21" width="21" height="5" />
        <path d="M19.6 21 L20.8 17.6 L22 21 Z" />
        <path d="M38 21 L39.2 17.6 L40.4 21 Z" />
        <path d="M22.6 21 L24.2 15.6 L25.8 21 Z" />
        <path d="M34.2 21 L35.8 15.6 L37.4 21 Z" />
        <path d="M27.6 21 L30 12.4 L32.4 21 Z" />
      </g>
    </svg>
  );
}

/** English: the United Kingdom's Union Jack. */
function EnglishFlag() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <clipPath id={`${id}-s`}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
        <clipPath id={`${id}-t`}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-s)`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-t)`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

/** Small rounded flag for a language code ('km' or 'en'). */
export default function Flag({ code, className = 'h-4 w-6' }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15 ${className}`}>
      {code === 'km' ? <CambodiaFlag /> : <EnglishFlag />}
    </span>
  );
}

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const WalkIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="13" cy="4" r="1.6" />
    <path d="M9 21l2.5-6.5L14 17v4M11.5 14.5L13 9l-3 1.5L8.5 13M13 9l2.2 3.2L18 13" />
  </svg>
);
export const PlaneIcon = ({ className = 'size-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M2.5 13.5l8-2.5V5a1.5 1.5 0 013 0v6l8 2.5v2l-8-1.5v4.5l2.5 1.8v1.7L12 21l-4 1v-1.7l2.5-1.8V14l-8 1.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const SwapIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg>
);
export const LocateIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
);
export const PinIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const SendIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
);
export const ChevronIcon = ({ className = 'size-3.5', dir = 'right' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base} style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }}><path d="M9 6l6 6-6 6" /></svg>
);
export const CloseIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const HomeIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
);
export const LinesIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M8.2 6H15a3 3 0 010 6H9a3 3 0 000 6h6.8" /></svg>
);
export const RouteIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="5.5" cy="18.5" r="2.5" /><path d="M8 18.5h7a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6" /><path d="M18 2.5l2.5 2-2.5 2" /></svg>
);
export const GearIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);
export const BellIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0" /></svg>
);
export const BusIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="4" y="3" width="16" height="15" rx="3" /><path d="M4 11h16M8 21v-3M16 21v-3" /><circle cx="8" cy="14.5" r="0.8" fill="currentColor" /><circle cx="16" cy="14.5" r="0.8" fill="currentColor" /></svg>
);
export const SparkIcon =({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
);

import { PlaneIcon } from './icons.jsx';

/** A route-number plate in the line's colour, like the sign on the front of the bus. */
export default function LineBadge({ line, size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-5 min-w-7 px-1.5 text-[11px] rounded',
    md: 'h-6 min-w-8 px-2 text-xs rounded-md',
    lg: 'h-9 min-w-12 px-2.5 text-base rounded-lg',
  };
  return (
    <span
      data-line={line.code}
      className={`inline-flex shrink-0 items-center justify-center gap-1 font-bold text-white leading-none ${sizes[size]} ${className}`}
      style={{ background: line.color }}
    >
      {line.kind === 'airport' && <PlaneIcon className={size === 'lg' ? 'size-4' : 'size-3'} />}
      {line.code}
    </span>
  );
}

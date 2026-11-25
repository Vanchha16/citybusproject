import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { label, t } from '../i18n.js';
import { CloseIcon, LocateIcon, PinIcon, PlaneIcon } from './icons.jsx';

// Plain symbols that render the same everywhere; the airport uses the SVG icon (iOS turns ✈ into a colour emoji).
const CATEGORY_GLYPH = {
  airport: <PlaneIcon className="size-3.5" />, market: '◍', mall: '▣', attraction: '★', university: '◆', hospital: '+', 'bus-stop': '●', transport: '▤',
};

/**
 * Text field with autocomplete over places and stops (English + Khmer).
 * Shows the chosen place's name when not editing.
 */
export default function PlaceSearch({ fieldLabel, value, valueText, placeholder, onSelect, onClear, near, lang, marker, myLocationOption, onMyLocation, onPickOnMap, autoFocus }) {
  const s = t(lang);
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [resultsFor, setResultsFor] = useState(''); // the query `results` belong to
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editing || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.search(query, near).then((r) => {
        if (!cancelled) {
          setResults(r);
          setResultsFor(query);
          setActive(0);
        }
      }).catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, editing, near]);

  // "My location" / "Choose on map" come first when the box is empty; while typing,
  // search results come first (so Enter picks the best match) and these follow.
  const extras = editing
    ? [
        ...(myLocationOption ? [{ id: '__me', myLocation: true }] : []),
        ...(onPickOnMap ? [{ id: '__map', pickOnMap: true }] : []),
      ]
    : [];
  // While a search is still loading, show nothing (so a fast Enter can't pick "Choose on map").
  const options = query.trim() ? (resultsFor === query ? [...results, ...extras] : []) : extras;

  const choose = (item) => {
    setEditing(false);
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
    if (item.myLocation) onMyLocation?.();
    else if (item.pickOnMap) onPickOnMap?.();
    else onSelect(item);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setEditing(false);
      inputRef.current?.blur();
    }
  };

  const shown = editing ? query : valueText ?? (value ? label(value.name, lang) : '');
  const open = editing && options.length > 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="flex items-center gap-3 rounded-xl bg-mist px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand">
        <span className="flex w-5 justify-center">{marker}</span>
        <span className="sr-only">{fieldLabel}</span>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1 text-[15px] font-medium outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-ink-faint"
          placeholder={placeholder}
          value={shown}
          onFocus={(e) => {
            setEditing(true);
            setQuery('');
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={() => setTimeout(() => setEditing(false), 150)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {value && !editing && onClear && (
          <button type="button" onClick={onClear} className="-mr-1 flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-line hover:text-ink" aria-label={s.clear}>
            <CloseIcon />
          </button>
        )}
      </label>

      {open && (
        <ul id={`${id}-list`} role="listbox" className="drop-in absolute inset-x-0 top-full z-[1200] mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {options.map((item, i) => (
            <li
              key={item.id + (item.type ?? '')}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-mist' : ''}`}
            >
              {item.myLocation ? (
                <>
                  <span className="flex w-5 justify-center text-blue-600"><LocateIcon /></span>
                  <span className="font-medium">{s.myLocation}</span>
                </>
              ) : item.pickOnMap ? (
                <>
                  <span className="flex w-5 justify-center text-ink"><PinIcon /></span>
                  <span className="font-medium">{s.chooseOnMap}</span>
                </>
              ) : (
                <>
                  <span className="flex w-5 justify-center text-sm text-ink-faint" aria-hidden>{CATEGORY_GLYPH[item.category] ?? '•'}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{label(item.name, lang)}</span>
                    <span className="block truncate text-xs text-ink-faint" lang={lang === 'en' ? 'km' : 'en'}>
                      {label(item.name, lang === 'en' ? 'km' : 'en')}
                    </span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

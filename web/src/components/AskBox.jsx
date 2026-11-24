import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { SendIcon, SparkIcon } from './icons.jsx';

/** Free-text question in Khmer or English; the answer is shown under it. */
export default function AskBox({ lang, aiEnabled, onAsk, loading, answer, autoFocus }) {
  const s = t(lang);
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (q && !loading) onAsk(q);
  };
  return (
    <section aria-labelledby="ask-h">
      <h2 id="ask-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <SparkIcon />
        {s.askShort}
      </h2>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5 pl-3 focus-within:ring-2 focus-within:ring-ink">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={s.askPlaceholder}
          aria-label={s.ask}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-ink-faint"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          <SendIcon className="size-4" />
          {s.send}
        </button>
      </form>
      {loading && <p className="mt-2 text-sm text-ink-soft" role="status">{s.thinking}</p>}
      {answer && !loading && (
        <div className="mt-3 rounded-xl bg-mist px-3.5 py-3" role="status" lang={answer.language}>
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{answer.answer}</p>
        </div>
      )}
    </section>
  );
}

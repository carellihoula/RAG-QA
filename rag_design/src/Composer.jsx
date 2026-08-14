// Composer — bottom input area with attachments, mode selector, send.

function Composer({ onSend, suggestions, streaming }) {
  const [text, setText] = React.useState('');
  const [showSuggest, setShowSuggest] = React.useState(true);
  const taRef = React.useRef(null);

  const autosize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  React.useEffect(autosize, [text]);

  const submit = () => {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText('');
    setShowSuggest(false);
    setTimeout(autosize, 0);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      {showSuggest && suggestions && suggestions.length > 0 && (
        <div className="suggest">
          <span className="suggest-label"><IconStars size={12} /> Try</span>
          <div className="suggest-chips">
            {suggestions.map((s) => (
              <button key={s} className="suggest-chip" onClick={() => { setText(s); taRef.current?.focus(); }}>
                {s}
              </button>
            ))}
          </div>
          <button className="suggest-x" onClick={() => setShowSuggest(false)} aria-label="Hide">
            <IconClose size={12} />
          </button>
        </div>
      )}

      <div className="composer">
        <div className="composer-top">
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKey} rows={1}
                    placeholder="Ask a question about your documents…" />
        </div>
        <div className="composer-bot">
          <div className="composer-left">
            <button className="icon-btn ghost" aria-label="Attach"><IconPaperclip size={15} /></button>
            <button className="icon-btn ghost" aria-label="Mention"><IconAt size={15} /></button>
            <span className="composer-sep" />
            <button className="model-chip">
              <IconBolt size={11} />
              <span>GPT-4o-mini</span>
              <IconChevDown size={10} />
            </button>
            <button className="mode-chip">
              <span className="mode-dot" />
              <span>Hybrid · BM25 + semantic</span>
            </button>
          </div>
          <div className="composer-right">
            <span className="composer-hint">
              <kbd>↵</kbd> send · <kbd>⇧↵</kbd> newline
            </span>
            <button className={'send-btn' + (text.trim() ? ' active' : '')}
                    disabled={!text.trim() || streaming}
                    onClick={submit} aria-label="Send">
              {streaming ? (
                <span className="send-loader" />
              ) : (
                <IconSend size={14} sw={2.2} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Composer });

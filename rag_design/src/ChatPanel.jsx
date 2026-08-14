// Main chat panel — modernized conversation view.
// - Refined header with doc context, model chip, view toggle
// - User/assistant messages with clear hierarchy
// - Expandable source cards (not just a count)
// - Per-message action toolbar (copy, regenerate, like)
// - Streaming/thinking indicator

function ChatPanel({ tweaks, view, onView }) {
  const data = window.RAG_DATA;
  const [messages, setMessages] = React.useState(data.messages);
  const [streaming, setStreaming] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const onSend = (text) => {
    if (!text.trim()) return;
    const userMsg = {
      id: 'u' + Date.now(),
      role: 'user',
      content: text,
      timestamp: 'now',
    };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setTimeout(() => {
      const reply = {
        id: 'a' + Date.now(),
        role: 'assistant',
        content:
          'Voici une réponse synthétique générée à partir des sources sélectionnées. Le moteur RAG combine les chunks les plus pertinents pour produire une réponse contextuelle et citable.',
        timestamp: 'now',
        sources: [{
          id: 'sx', docTitle: data.activeDoc.title,
          chunk: 'Extrait pertinent renvoyé par le moteur de recherche hybride (BM25 + sémantique).',
          page: 1, relevance: 0.84,
        }],
        model: 'GPT-4o-mini', tokens: 198, duration: '1.2s',
      };
      setMessages((m) => [...m, reply]);
      setStreaming(false);
    }, 1600);
  };

  return (
    <section className="chat">
      <ChatHeader doc={data.activeDoc} view={view} onView={onView} />

      <div ref={scrollRef} className="chat-scroll">
        <div className="chat-thread">
          {messages.map((m, i) => (
            <Message key={m.id} m={m} prev={messages[i - 1]} tweaks={tweaks} />
          ))}
          {streaming && <ThinkingBubble />}
        </div>
      </div>

      <Composer onSend={onSend} suggestions={data.suggestions} streaming={streaming} />
    </section>
  );
}

function ChatHeader({ doc, view, onView }) {
  return (
    <header className="chat-hd">
      <div className="chat-hd-left">
        <div className="chat-hd-ic"><IconWeb size={16} /></div>
        <div className="chat-hd-text">
          <div className="chat-hd-title">
            <span>{doc.title}</span>
            <span className="pill outline tiny">
              <IconExternal size={10} />
              {doc.url}
            </span>
          </div>
          <div className="chat-hd-meta">
            <span>{doc.subtitle}</span>
            <span className="dot" />
            <span>{doc.pages} page</span>
            <span className="dot" />
            <span>{doc.chunks} chunks indexed</span>
          </div>
        </div>
      </div>
      <div className="chat-hd-right">
        <div className="seg">
          <button className={view === 'chat' ? 'on' : ''} onClick={() => onView('chat')}>Chat</button>
          <button className={view === 'chunks' ? 'on' : ''} onClick={() => onView('chunks')}>Chunks</button>
        </div>
        <button className="icon-btn ghost" aria-label="Refresh"><IconRefresh size={15} /></button>
        <button className="icon-btn ghost" aria-label="More"><IconDots size={15} /></button>
      </div>
    </header>
  );
}

function Message({ m, prev, tweaks }) {
  if (m.role === 'user') return <UserMessage m={m} />;
  return <AssistantMessage m={m} tweaks={tweaks} />;
}

function UserMessage({ m }) {
  return (
    <div className="msg user-msg">
      <div className="msg-bubble user-bubble">
        <div className="msg-content">{m.content}</div>
      </div>
      <div className="msg-meta user-meta">
        <span>You</span>
        <span className="dot" />
        <span>{m.timestamp}</span>
      </div>
    </div>
  );
}

function AssistantMessage({ m, tweaks }) {
  const [showSources, setShowSources] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard?.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="msg assistant-msg">
      <div className="msg-avatar">
        <div className="ai-mark">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
          </svg>
        </div>
      </div>
      <div className="msg-body">
        <div className="msg-meta assistant-meta">
          <span className="msg-author">RAG Studio</span>
          <span className="dot" />
          <span>{m.model}</span>
          <span className="dot" />
          <span><IconClock size={10} /> {m.duration}</span>
          <span className="dot" />
          <span>{m.tokens} tok</span>
        </div>
        <div className="msg-content assistant-content">{m.content}</div>

        {m.sources && m.sources.length > 0 && (
          <div className="sources">
            <button className="sources-toggle" onClick={() => setShowSources(!showSources)}>
              <span className={'src-chev' + (showSources ? ' open' : '')}>
                <IconChevRight size={11} />
              </span>
              <span className="src-count">{m.sources.length} source{m.sources.length > 1 ? 's' : ''}</span>
              <span className="src-stack">
                {m.sources.slice(0, 3).map((s, i) => (
                  <span key={i} className="src-pip">{i + 1}</span>
                ))}
              </span>
              <span className="src-doc">{m.sources[0].docTitle}</span>
            </button>
            {showSources && (
              <div className="src-cards">
                {m.sources.map((s, i) => (
                  <div key={s.id} className="src-card">
                    <div className="src-card-hd">
                      <span className="src-card-num">{i + 1}</span>
                      <span className="src-card-title">{s.docTitle}</span>
                      <span className="pill micro relevance">{Math.round(s.relevance * 100)}% match</span>
                    </div>
                    <div className="src-card-chunk">{s.chunk}</div>
                    <div className="src-card-foot">
                      <span>Page {s.page}</span>
                      <button className="link-btn">Open in document <IconExternal size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="msg-actions">
          <button className="action-btn" onClick={onCopy}>
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="action-btn"><IconRefresh size={13} /><span>Regenerate</span></button>
          <button className="action-btn"><IconThumbUp size={13} /></button>
          <button className="action-btn"><IconThumbDown size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="msg assistant-msg">
      <div className="msg-avatar">
        <div className="ai-mark thinking">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
          </svg>
        </div>
      </div>
      <div className="msg-body">
        <div className="thinking-row">
          <div className="thinking-step active">
            <span className="step-dot" /><span>Searching knowledge base</span>
          </div>
          <div className="thinking-step active">
            <span className="step-dot" /><span>Ranking 7 chunks by relevance</span>
          </div>
          <div className="thinking-step pending">
            <span className="step-dot" /><span>Composing answer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatPanel });

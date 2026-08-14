// Knowledge / Documents middle panel.

function KnowledgePanel({ collapsed, onToggle, activeDocId, onSelect }) {
  const kb = window.RAG_DATA.knowledgeBases[0];
  const [expanded, setExpanded] = React.useState(true);
  const [query, setQuery] = React.useState('');

  const filtered = kb.docsList.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (collapsed) {
    return (
      <aside className="kbpanel collapsed">
        <button className="icon-btn ghost" onClick={onToggle} aria-label="Expand">
          <IconChevRight size={15} />
        </button>
        <div className="kb-collapsed-stack">
          {kb.docsList.slice(0, 5).map((d) => {
            const I = docTypeIcon(d.type);
            return (
              <button key={d.id} className={'kb-collapsed-doc' + (d.id === activeDocId ? ' active' : '')}
                      onClick={() => onSelect(d.id)} title={d.name}>
                <I size={15} />
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="kbpanel">
      <div className="kb-hd">
        <div className="kb-hd-row">
          <span className="kb-hd-label">Knowledge bases</span>
          <span className="pill micro">1</span>
        </div>
        <div className="kb-hd-actions">
          <button className="icon-btn ghost" aria-label="Filter"><IconFilter size={14} /></button>
          <button className="icon-btn ghost" aria-label="Add KB"><IconPlus size={14} sw={2} /></button>
          <button className="icon-btn ghost" onClick={onToggle} aria-label="Collapse">
            <IconChevLeft size={14} />
          </button>
        </div>
      </div>

      <div className="kb-search">
        <IconSearch size={13} />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder="Search documents…" />
        <kbd>/</kbd>
      </div>

      <div className="kb-tree">
        <button className="kb-tree-row" onClick={() => setExpanded(!expanded)}>
          <span className={'kb-chev' + (expanded ? ' open' : '')}>
            <IconChevRight size={12} />
          </span>
          <span className="kb-tree-name">{kb.name}</span>
          <span className="kb-tree-meta">{kb.docs} docs · {kb.size}</span>
        </button>
      </div>

      <div className="kb-docs">
        <div className="kb-docs-hd">
          <span className="kb-docs-label">Documents</span>
          <span className="kb-docs-count">{filtered.length}</span>
        </div>
        <button className="kb-add">
          <IconPlus size={14} sw={2} />
          <span>Add source</span>
        </button>
        <div className="kb-docs-list">
          {filtered.map((d) => {
            const I = docTypeIcon(d.type);
            const isActive = d.id === activeDocId;
            return (
              <button key={d.id} className={'kb-doc' + (isActive ? ' active' : '')}
                      onClick={() => onSelect(d.id)}>
                <div className="kb-doc-ic"><I size={14} /></div>
                <div className="kb-doc-body">
                  <div className="kb-doc-title">{d.name}</div>
                  <div className="kb-doc-meta">
                    <span>{d.pages}p</span>
                    <span className="kb-dot" />
                    <span>{d.chunks} chunks</span>
                    {isActive && <span className="kb-doc-flag">in context</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="kb-foot">
        <div className="kb-quota">
          <div className="kb-quota-row">
            <span>Free plan</span>
            <span className="kb-quota-val">1.3 KB · 7 of 8 docs</span>
          </div>
          <div className="kb-quota-bar"><i style={{ width: '87%' }} /></div>
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { KnowledgePanel });

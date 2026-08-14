// Left sidebar — app nav + recent chats + user.

function Sidebar({ collapsed, onToggle, tweaks }) {
  const data = window.RAG_DATA;
  return (
    <aside className="sidebar" data-collapsed={collapsed ? '1' : '0'}>
      <div className="sb-top">
        <div className="sb-brand">
          <div className="sb-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z" fill="currentColor" opacity=".9"/>
              <path d="M13 13h7v7h-7z" fill="currentColor" opacity=".4"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="sb-brand-text">
              <div className="sb-name">RAG Studio</div>
              <div className="sb-sub">Personal workspace</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="icon-btn ghost" onClick={onToggle} aria-label="Collapse">
            <IconChevLeft size={15} />
          </button>
        )}
      </div>

      {!collapsed && (
        <button className="sb-new">
          <IconPlus size={14} sw={2} />
          <span>New conversation</span>
          <kbd>⌘N</kbd>
        </button>
      )}
      {collapsed && (
        <button className="icon-btn solid sb-new-collapsed" aria-label="New">
          <IconPlus size={16} sw={2} />
        </button>
      )}

      <nav className="sb-nav">
        <NavItem icon={IconChat} label="Chat" active collapsed={collapsed} />
        <NavItem icon={IconDashboard} label="Dashboard" collapsed={collapsed} />
        <NavItem icon={IconBook} label="Knowledge" badge="7" collapsed={collapsed} />
        <NavItem icon={IconSearch} label="Search" collapsed={collapsed} kbd="⌘K" />
      </nav>

      {!collapsed && (
        <div className="sb-section">
          <div className="sb-section-hd">
            <span>Recent</span>
            <button className="link-btn">View all</button>
          </div>
          <div className="sb-chats">
            {data.recentChats.map((c) => (
              <button key={c.id} className={'sb-chat' + (c.active ? ' active' : '')}>
                <span className="sb-chat-title">{c.title}</span>
                <span className="sb-chat-time">{c.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sb-foot">
        <div className="sb-user">
          <div className="avatar" style={{ background: 'linear-gradient(135deg,#a78bfa,#6366f1)' }}>C</div>
          {!collapsed && (
            <div className="sb-user-text">
              <div className="sb-user-name">Carellihoula</div>
              <div className="sb-user-plan">Free plan · 1.3 KB</div>
            </div>
          )}
          {!collapsed && (
            <button className="icon-btn ghost" aria-label="Settings"><IconSettings size={15} /></button>
          )}
        </div>
        {!collapsed && (
          <div className="sb-quota">
            <div className="sb-quota-bar"><i style={{ width: '38%' }} /></div>
            <div className="sb-quota-text">3 of 8 docs used</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ icon: Ic, label, active, badge, collapsed, kbd }) {
  return (
    <button className={'sb-nav-item' + (active ? ' active' : '')} title={collapsed ? label : ''}>
      <Ic size={16} />
      {!collapsed && <span className="sb-nav-label">{label}</span>}
      {!collapsed && badge && <span className="sb-nav-badge">{badge}</span>}
      {!collapsed && kbd && <kbd>{kbd}</kbd>}
    </button>
  );
}

Object.assign(window, { Sidebar });

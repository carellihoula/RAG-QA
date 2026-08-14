// Main App — wires the three columns together + Tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "aesthetic": "refined",
  "dark": false,
  "accent": "#5B5BD6",
  "density": "regular",
  "sidebarCollapsed": false,
  "kbCollapsed": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeDocId, setActiveDocId] = React.useState('d3');
  const [view, setView] = React.useState('chat');

  // Apply tweaks to root element so CSS vars pick them up
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.dark ? 'dark' : 'light';
    root.dataset.aesthetic = t.aesthetic;
    root.dataset.density = t.density;
    root.style.setProperty('--accent', t.accent);
    // Derive a soft variant from the accent
    const hex = t.accent.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty('--accent-soft-2', `rgba(${r},${g},${b},0.20)`);
    // darker variant for hover
    const dark = (c) => Math.max(0, Math.round(c * 0.82));
    root.style.setProperty('--accent-2', `rgb(${dark(r)},${dark(g)},${dark(b)})`);
  }, [t.dark, t.aesthetic, t.density, t.accent]);

  return (
    <div className="app">
      <Sidebar
        collapsed={t.sidebarCollapsed}
        onToggle={() => setTweak('sidebarCollapsed', !t.sidebarCollapsed)}
        tweaks={t}
      />
      <KnowledgePanel
        collapsed={t.kbCollapsed}
        onToggle={() => setTweak('kbCollapsed', !t.kbCollapsed)}
        activeDocId={activeDocId}
        onSelect={setActiveDocId}
      />
      <ChatPanel tweaks={t} view={view} onView={setView} />

      <TweaksPanel title="Style">
        <TweakSection label="Aesthetic" />
        <TweakRadio label="Style" value={t.aesthetic}
                    options={[
                      { value: 'refined', label: 'Refined' },
                      { value: 'editorial', label: 'Editorial' },
                      { value: 'glass', label: 'Glass' },
                    ]}
                    onChange={(v) => setTweak('aesthetic', v)} />
        <TweakToggle label="Dark mode" value={t.dark}
                     onChange={(v) => setTweak('dark', v)} />
        <TweakRadio label="Density" value={t.density}
                    options={['compact', 'regular', 'comfy']}
                    onChange={(v) => setTweak('density', v)} />

        <TweakSection label="Accent" />
        <TweakColor label="Color" value={t.accent}
                    options={['#5B5BD6', '#0B57D0', '#E8714C', '#1F8A5B', '#7A5AE0', '#111110']}
                    onChange={(v) => setTweak('accent', v)} />

        <TweakSection label="Layout" />
        <TweakToggle label="Collapse sidebar" value={t.sidebarCollapsed}
                     onChange={(v) => setTweak('sidebarCollapsed', v)} />
        <TweakToggle label="Collapse documents" value={t.kbCollapsed}
                     onChange={(v) => setTweak('kbCollapsed', v)} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

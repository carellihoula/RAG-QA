// Minimal icon set — single stroke, currentColor, 1.5px lucide-style.

const Icon = ({ d, size = 16, sw = 1.6, fill = 'none', children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke="currentColor" strokeWidth={sw}
       strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const IconChat = (p) => <Icon {...p} d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />;
const IconDashboard = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.2"/><rect x="14" y="3" width="7" height="5" rx="1.2"/><rect x="14" y="12" width="7" height="9" rx="1.2"/><rect x="3" y="16" width="7" height="5" rx="1.2"/></Icon>;
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
const IconBook = (p) => <Icon {...p} d="M4 4h12a3 3 0 0 1 3 3v13a1 1 0 0 1-1.5.9L12 18l-5.5 2.9A1 1 0 0 1 5 20V7a3 3 0 0 1 3-3" />;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
const IconChevDown = (p) => <Icon {...p} d="m6 9 6 6 6-6" />;
const IconChevRight = (p) => <Icon {...p} d="m9 6 6 6-6 6" />;
const IconChevLeft = (p) => <Icon {...p} d="m15 6-6 6 6 6" />;
const IconSparkle = (p) => <Icon {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></Icon>;
const IconStars = (p) => <Icon {...p} d="M12 2 14 9l7 1-5.2 4.5L17.5 22 12 18l-5.5 4 1.7-7.5L3 10l7-1z" />;
const IconSend = (p) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Icon>;
const IconPaperclip = (p) => <Icon {...p} d="M21 12 12.5 20.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5L10.5 18.5a2 2 0 0 1-3-3L15 8" />;
const IconAt = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5 8"/></Icon>;
const IconRefresh = (p) => <Icon {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></Icon>;
const IconCopy = (p) => <Icon {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></Icon>;
const IconThumbUp = (p) => <Icon {...p} d="M7 22V11M2 13v7a2 2 0 0 0 2 2h13.4a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18.8 11H14V6a3 3 0 0 0-3-3l-4 9H2z" />;
const IconThumbDown = (p) => <Icon {...p} d="M17 2v11M22 11V4a2 2 0 0 0-2-2H6.6a2 2 0 0 0-2 1.6l-1.4 7A2 2 0 0 0 5.2 13H10v5a3 3 0 0 0 3 3l4-9h5z" />;
const IconBolt = (p) => <Icon {...p} d="M13 2 4 14h7l-1 8 9-12h-7z" />;
const IconDoc = (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></Icon>;
const IconWeb = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Icon>;
const IconSheet = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></Icon>;
const IconPdf = (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 14h1.5a1.5 1.5 0 0 1 0 3H8zM12.5 14v3M12.5 14h2M16.5 14h2M16.5 14v3M16.5 15.5h1.5"/></Icon>;
const IconClose = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.65 1.65 0 0 0-1.8-.3 1.65 1.65 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.65 1.65 0 0 0 .3-1.8 1.65 1.65 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.65 1.65 0 0 0 1.8.3h0a1.65 1.65 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.65 1.65 0 0 0 1 1.5h0a1.65 1.65 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.65 1.65 0 0 0-.3 1.8v0a1.65 1.65 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.65 1.65 0 0 0-1.5 1z"/></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>;
const IconFilter = (p) => <Icon {...p}><path d="M3 5h18M6 12h12M10 19h4"/></Icon>;
const IconExternal = (p) => <Icon {...p}><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></Icon>;
const IconMic = (p) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></Icon>;
const IconLogo = (p) => <Icon {...p}><path d="M12 2 4 7v10l8 5 8-5V7zM12 2v20M4 7l8 5 8-5"/></Icon>;
const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconDots = (p) => <Icon {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Icon>;

const docTypeIcon = (type) => ({
  sheet: IconSheet, doc: IconDoc, web: IconWeb, pdf: IconPdf,
}[type] || IconDoc);

Object.assign(window, {
  Icon, IconChat, IconDashboard, IconSearch, IconBook, IconPlus,
  IconChevDown, IconChevRight, IconChevLeft, IconSparkle, IconStars,
  IconSend, IconPaperclip, IconAt, IconRefresh, IconCopy,
  IconThumbUp, IconThumbDown, IconBolt, IconDoc, IconWeb, IconSheet, IconPdf,
  IconClose, IconSettings, IconCheck, IconFilter, IconExternal, IconMic,
  IconLogo, IconClock, IconDots, docTypeIcon,
});

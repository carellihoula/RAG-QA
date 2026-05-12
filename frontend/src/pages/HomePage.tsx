import { useNavigate } from 'react-router-dom'
import {
  FileText, MessageSquare, ArrowRight,
  Upload, Zap, Shield, Search, Check, Sparkles,
  Globe, BookOpen, Atom, Rss, Table, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'
import { cn } from '@/lib/utils'

// ── Data ──────────────────────────────────────────────────────────────────────

const SOURCE_TYPES = [
  { label: 'PDF',        icon: FileText,  color: 'text-red-400'     },
  { label: 'Word',       icon: FileText,  color: 'text-blue-400'    },
  { label: 'PowerPoint', icon: FileText,  color: 'text-orange-400'  },
  { label: 'Excel',      icon: Table,     color: 'text-green-400'   },
  { label: 'Web URL',    icon: Globe,     color: 'text-violet-400'  },
  { label: 'Wikipedia',  icon: BookOpen,  color: 'text-slate-400'   },
  { label: 'ArXiv',      icon: Atom,      color: 'text-violet-400'  },
  { label: 'RSS',        icon: Rss,       color: 'text-amber-400'   },
]

const features = [
  {
    icon: Globe,
    title: 'Multiple sources',
    description: 'PDF, Word, PowerPoint, Excel, web pages, Wikipedia articles, ArXiv papers, and RSS feeds — all in one workspace.',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: Search,
    title: 'Hybrid search',
    description: 'Combines BM25 keyword matching with semantic vector search for the most relevant results across all your sources.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: FileText,
    title: 'Cited answers',
    description: 'Every response includes the exact page numbers and excerpts used as context.',
    color: 'text-violet-500 bg-violet-500/10',
  },
  {
    icon: Zap,
    title: 'Streaming responses',
    description: 'Answers stream token by token via Server-Sent Events. No loading spinner, no waiting.',
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Session memory',
    description: 'Follow-up questions work naturally. Conversation history is maintained per source.',
    color: 'text-pink-500 bg-pink-500/10',
  },
  {
    icon: Shield,
    title: 'Secure by default',
    description: 'JWT authentication, per-user isolation, and no data sharing between accounts.',
    color: 'text-slate-500 bg-slate-500/10',
  },
]

const steps = [
  {
    step: '01',
    icon: Upload,
    title: 'Add a source',
    desc: 'Drag & drop a file or paste a URL. PDFs, Word docs, spreadsheets, web pages, Wikipedia articles, ArXiv papers — indexed in seconds.',
  },
  {
    step: '02',
    icon: MessageSquare,
    title: 'Ask a question',
    desc: 'Type your question in plain English. Hybrid search retrieves the most relevant chunks from your sources.',
  },
  {
    step: '03',
    icon: Sparkles,
    title: 'Get cited answers',
    desc: 'GPT-4o-mini generates an answer grounded in retrieved context, with source-level citations.',
  },
]

const stack = [
  'FastAPI', 'LangChain', 'FAISS', 'BM25', 'OpenAI GPT-4o-mini',
  'React', 'TypeScript', 'Tailwind CSS', 'SQLite',
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to get started with AI-powered multi-source Q&A.',
    cta: 'Get started',
    primary: false,
    badge: null,
    features: ['10 sources (PDF, web, Wikipedia…)', 'Unlimited questions', 'Hybrid BM25 + semantic search', 'Source citations', 'Streaming responses', 'Dark mode'],
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    description: 'For teams and power users who need more scale and flexibility.',
    cta: 'Coming soon',
    primary: true,
    badge: 'Soon',
    features: ['Unlimited sources', 'Priority indexing', 'REST API access', 'Custom chunk settings', 'Export conversations', 'Knowledge base grouping'],
  },
]

// ── Mock chat for hero ────────────────────────────────────────────────────────

function MockChat() {
  return (
    <div className="rounded-2xl border bg-card shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
      {/* source tabs */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 border-b bg-muted/20">
        {[
          { icon: FileText, label: 'report.pdf',    color: 'bg-red-500/10 border-red-500/20',    iconColor: 'text-red-400',    active: false },
          { icon: Globe,    label: 'arxiv.org/…',   color: 'bg-violet-500/10 border-violet-500/20', iconColor: 'text-violet-400', active: true  },
          { icon: BookOpen, label: 'Wikipedia',      color: 'bg-slate-500/10 border-slate-500/20', iconColor: 'text-slate-400',  active: false },
        ].map(({ icon: Icon, label, color, iconColor, active }) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium',
              active ? color + ' text-foreground' : 'border-transparent text-muted-foreground/50',
            )}
          >
            <Icon className={cn('h-2.5 w-2.5', iconColor)} />
            <span className="truncate max-w-[60px]">{label}</span>
          </div>
        ))}
      </div>

      {/* messages */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        {/* user */}
        <div className="flex flex-row-reverse gap-2.5">
          <div className="h-7 w-7 rounded-full bg-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[9px] font-bold text-zinc-200">You</span>
          </div>
          <div className="max-w-[78%] rounded-xl rounded-tr-sm bg-blue-600 text-white px-3 py-2 text-xs leading-relaxed">
            How do transformers handle long-range dependencies?
          </div>
        </div>

        {/* assistant */}
        <div className="flex gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="max-w-[78%] rounded-xl rounded-tl-sm bg-muted border px-3 py-2 text-xs leading-relaxed">
            <p>Transformers use <strong>self-attention</strong> to compute pairwise relationships between all tokens simultaneously, giving them O(1) path length between any two positions regardless of sequence length.</p>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40">
              <ChevronRight className="h-2.5 w-2.5 opacity-40" />
              <span className="text-[10px] opacity-50">3 sources · Section 3.2 · Section 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* input */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-background">
          <span className="flex-1 text-xs text-muted-foreground/40 select-none">
            Ask a follow-up question…
          </span>
          <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ArrowRight className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3.5">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-bold tracking-tight text-sm">RAG Q&amp;A</span>
          </button>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features"     className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing"      className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <Button size="sm" onClick={() => navigate('/app')}>
                Open app <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button>
                <Button size="sm" onClick={() => navigate('/login?tab=register')}>Get started</Button>
              </>
            )}
            <ModeToggle />
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">

          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/60 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-blue-400" />
              8+ source types · BM25 + semantic search · GPT-4o-mini
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
              Chat with any{' '}
              <span className="bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent">
                source
              </span>
              , instantly.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-md">
              Add PDFs, Word docs, web pages, Wikipedia articles, ArXiv papers, or RSS feeds.
              Ask questions in plain English and get accurate answers — with exact source citations.
            </p>

            {/* Source type pills */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {SOURCE_TYPES.map(({ label, icon: Icon, color }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border text-xs text-muted-foreground"
                >
                  <Icon className={cn('h-3 w-3', color)} />
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                className="shadow-lg shadow-blue-600/20"
                onClick={() => navigate('/login?tab=register')}
              >
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Log in
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-4">
              No credit card required · Free plan includes 10 sources
            </p>
          </div>

          {/* Right: mock UI */}
          <div className="hidden md:block">
            <MockChat />
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30 px-6 py-8">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '8+ formats',      label: 'Source types' },
            { value: 'BM25 + Semantic', label: 'Hybrid retrieval' },
            { value: 'SSE streaming',   label: 'Real-time answers' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Built for accuracy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto">
              Every component is chosen to maximize retrieval quality and answer faithfulness.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map(f => (
              <div
                key={f.title}
                className="rounded-2xl border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t bg-muted/20 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-muted-foreground text-sm">Three steps, under 30 seconds.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border z-0" />
            {steps.map(s => (
              <div key={s.step} className="relative flex flex-col items-center text-center gap-4 z-10">
                <div className="h-16 w-16 rounded-2xl bg-card border shadow-sm flex items-center justify-center">
                  <s.icon className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                    Step {s.step}
                  </span>
                  <h3 className="font-semibold mt-1 mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────── */}
      <section className="border-t px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-6">
            Tech stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {stack.map(t => (
              <span
                key={t}
                className="px-3.5 py-1.5 rounded-full border bg-muted/40 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t bg-muted/20 px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Simple pricing</h2>
            <p className="text-muted-foreground text-sm">Start for free. Scale when you need to.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={cn(
                  'rounded-2xl border p-7 flex flex-col gap-6',
                  plan.primary
                    ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white border-transparent shadow-xl shadow-blue-600/25'
                    : 'bg-card'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1.5',
                      plan.primary ? 'text-white/50' : 'text-muted-foreground')}>
                      {plan.name}
                    </p>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold">{plan.price}</span>
                      <span className={cn('text-sm mb-1.5', plan.primary ? 'text-white/50' : 'text-muted-foreground')}>
                        /{plan.period}
                      </span>
                    </div>
                  </div>
                  {plan.badge && (
                    <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <p className={cn('text-sm leading-relaxed', plan.primary ? 'text-white/70' : 'text-muted-foreground')}>
                  {plan.description}
                </p>

                <ul className="flex flex-col gap-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className={cn('h-4 w-4 flex-shrink-0', plan.primary ? 'text-white/70' : 'text-blue-500')} />
                      <span className={plan.primary ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !plan.primary && navigate('/login?tab=register')}
                  disabled={plan.primary}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
                    plan.primary
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm'
                  )}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="border-t px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/5">
            <Sparkles className="h-6 w-6 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to chat with your sources?
          </h2>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-sm mx-auto">
            Start for free — no credit card required. Your first source is indexed in under 10 seconds.
          </p>
          <Button
            size="lg"
            className="shadow-lg shadow-blue-600/20"
            onClick={() => navigate('/login?tab=register')}
          >
            Get started for free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">R</span>
            </div>
            <span className="text-sm font-semibold">RAG Q&amp;A</span>
          </button>
          <p className="text-xs text-muted-foreground">
            Built with FastAPI · LangChain · FAISS · OpenAI · React · TypeScript
          </p>
          <ModeToggle />
        </div>
      </footer>
    </div>
  )
}

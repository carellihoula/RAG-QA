import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ModeToggle } from '@/components/ModeToggle'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { cn } from '@/lib/utils'
import { ArrowLeft, Sparkles, Check, Globe, FileText, CheckCircle2 } from 'lucide-react'

// ── Left-panel feature list ───────────────────────────────────────────────────

const FEATURES = [
  { icon: FileText, text: 'PDF, Word, Excel & PowerPoint' },
  { icon: Globe,    text: 'Web pages, Wikipedia & ArXiv papers' },
  { icon: Sparkles, text: 'Hybrid BM25 + semantic search' },
  { icon: Check,    text: 'Cited answers with exact source references' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  )
  const justActivated = searchParams.get('activated') === 'true'

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/app', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700">

        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur border border-white/25 flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-base">R</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">RAG Q&amp;A</span>
          </button>
        </div>

        {/* Center content */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-3">
              Your knowledge,<br />amplified.
            </h2>
            <p className="text-white/55 text-sm leading-relaxed max-w-xs">
              Chat with documents, web pages, and research papers.
              Get accurate answers with exact source citations.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-white/80" />
                </div>
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-white/25 text-xs">
          Powered by GPT-4o-mini · FAISS · LangChain
        </p>
      </div>

      {/* ── Right panel — form shell ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>
          <ModeToggle />
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[390px]">

            {/* Mobile logo */}
            <button
              onClick={() => navigate('/')}
              className="lg:hidden flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs">R</span>
              </div>
              <span className="font-bold tracking-tight">RAG Q&amp;A</span>
            </button>

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight mb-1.5">
                {tab === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tab === 'login'
                  ? 'Sign in to continue to your workspace.'
                  : 'Start for free — no credit card required.'}
              </p>
            </div>

            {/* Account activated banner */}
            {justActivated && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg px-3 py-2.5 text-sm mb-6">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Account activated! You can now log in.
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6">
              {(['login', 'register'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    tab === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'login' ? 'Log in' : 'Register'}
                </button>
              ))}
            </div>

            {/* Form — swapped by tab */}
            {tab === 'login'
              ? <LoginForm    onSwitchTab={() => setTab('register')} />
              : <RegisterForm onSwitchTab={() => setTab('login')} />
            }
          </div>
        </div>
      </div>
    </div>
  )
}
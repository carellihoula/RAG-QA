import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, BookOpen, MessageSquare,
  LayoutDashboard, Sparkles, Library, FolderOpen, Shield,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { SidebarLayout } from '@/components/AppSidebar'
import type { NavItem } from '@/components/AppSidebar'
import { cn } from '@/lib/utils'
import { listDocuments, listKnowledgeBases, getBillingStatus, getMe } from '../api'
import type { BillingStatus } from '../api'
import type { Document, KnowledgeBase } from '../types'
import type { UserProfile } from '../types/auth'
import { AdminTab } from '@/components/admin/AdminTab'

// ── Shared nav ────────────────────────────────────────────────────────────────

export const APP_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Chat', icon: MessageSquare, href: '/app' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function nameFromEmail(email: string) {
  const prefix = email.split('@')[0]
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

const KB_COLORS: Record<string, { dot: string; bg: string; text: string; ring: string }> = {
  blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-500/8',    text: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-500/20' },
  violet:  { dot: 'bg-violet-500',  bg: 'bg-violet-500/8',  text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-500/20' },
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/8', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  amber:   { dot: 'bg-amber-500',   bg: 'bg-amber-500/8',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-500/20' },
  pink:    { dot: 'bg-pink-500',    bg: 'bg-pink-500/8',    text: 'text-pink-600 dark:text-pink-400',    ring: 'ring-pink-500/20' },
  slate:   { dot: 'bg-slate-500',   bg: 'bg-slate-500/8',   text: 'text-slate-600 dark:text-slate-400',   ring: 'ring-slate-500/20' },
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number | string
  colorClass: string
  sub?: string
}

function StatCard({ icon: Icon, label, value, colorClass, sub }: StatCardProps) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl border bg-card p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {payload[0].value} doc{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const email = localStorage.getItem('user-email') ?? ''
  const user = { name: nameFromEmail(email) || 'Utilisateur', email }

  const [documents,      setDocuments]      = useState<Document[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [billing,        setBilling]        = useState<BillingStatus | null>(null)
  const [isLoading,      setIsLoading]      = useState(true)
  const [currentUser,    setCurrentUser]    = useState<UserProfile | null>(null)
  const [activeTab,      setActiveTab]      = useState<'overview' | 'admin'>('overview')

  useEffect(() => {
    Promise.all([listDocuments(), listKnowledgeBases(), getBillingStatus(), getMe()])
      .then(([docs, kbs, bill, me]) => {
        setDocuments(docs)
        setKnowledgeBases(kbs)
        setBilling(bill)
        setCurrentUser(me)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user-email')
    navigate('/login', { replace: true })
  }

  // ── Derived stats ──────────────────────────────────────────────────────

  const totalPages  = documents.reduce((acc, d) => acc + (d.page_count ?? 0), 0)
  const msgCount    = parseInt(localStorage.getItem('msg-count') ?? '0')
  const totalKbDocs = knowledgeBases.reduce((acc, kb) => acc + kb.doc_ids.length, 0)

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const day = d.toISOString().split('T')[0]
    return {
      day,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: documents.filter(doc => doc.indexed_at?.startsWith(day)).length,
    }
  })

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const recentDocs = documents.slice(0, 5)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SidebarLayout sidebarProps={{ user, navItems: APP_NAV, onLogout: logout }}>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-7">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
            </div>
            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all shadow-sm shadow-blue-600/20"
            >
              <MessageSquare className="h-4 w-4" />
              Open Chat
            </button>
          </div>

          {/* Tab bar — only shows when user is admin */}
          {currentUser?.is_admin && (
            <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
              <button
                onClick={() => setActiveTab('overview')}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'overview'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'admin'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
            </div>
          )}

          {/* Admin tab */}
          {activeTab === 'admin' && currentUser?.is_admin && <AdminTab />}

          {/* Overview tab content */}
          {activeTab === 'overview' && <>

          {/* Stat cards — 2×2 + wide */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={FileText}
              label="Documents"
              value={isLoading ? '—' : documents.length}
              colorClass="bg-blue-500/10 text-blue-500"
              sub={billing
                ? billing.doc_limit === -1
                  ? `${documents.length} indexed · unlimited`
                  : `${Math.max(0, billing.doc_limit - documents.length)} slots left (${billing.plan})`
                : `${documents.length} indexed`}
            />
            <StatCard
              icon={Library}
              label="Knowledge Bases"
              value={isLoading ? '—' : knowledgeBases.length}
              colorClass="bg-violet-500/10 text-violet-500"
              sub={`${totalKbDocs} docs linked`}
            />
            <StatCard
              icon={BookOpen}
              label="Pages indexed"
              value={isLoading ? '—' : totalPages}
              colorClass="bg-emerald-500/10 text-emerald-500"
              sub="across all docs"
            />
            <StatCard
              icon={MessageSquare}
              label="Messages"
              value={msgCount}
              colorClass="bg-pink-500/10 text-pink-500"
              sub="total Q&A exchanges"
            />
          </div>

          {/* Chart + Recent docs */}
          <div className="grid grid-cols-3 gap-4">

            {/* Indexing activity */}
            <div className="col-span-2 rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">Indexing activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-6">
                Documents uploaded — last 7 days
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={28}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
                    content={<ChartTooltip />}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.count > 0 ? '#3b82f6' : 'hsl(var(--muted))'}
                        fillOpacity={entry.count > 0 ? 0.85 : 0.4}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent documents */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold">Recent documents</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last {recentDocs.length} indexed
                </p>
              </div>

              {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No documents yet</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {recentDocs.map(doc => (
                    <li
                      key={doc.doc_id}
                      onClick={() => navigate('/app')}
                      className="flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors group"
                    >
                      <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">
                          {doc.title ?? doc.filename}
                        </p>
                        {(doc.page_count != null || doc.chunk_count != null) && (
                          <p className="text-[10px] text-muted-foreground">
                            {doc.page_count != null ? `${doc.page_count}p` : ''}
                            {doc.page_count != null && doc.chunk_count != null ? ' · ' : ''}
                            {doc.chunk_count != null ? `${doc.chunk_count} chunks` : ''}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Knowledge Bases section */}
          {(isLoading || knowledgeBases.length > 0) && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Knowledge Bases</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {knowledgeBases.length} collection{knowledgeBases.length !== 1 ? 's' : ''} · {totalKbDocs} document{totalKbDocs !== 1 ? 's' : ''} linked
                  </p>
                </div>
                <button
                  onClick={() => navigate('/app')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Manage →
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {knowledgeBases.map(kb => {
                    const c = KB_COLORS[kb.color] ?? KB_COLORS.blue
                    return (
                      <div
                        key={kb.id}
                        onClick={() => navigate('/app')}
                        className={cn(
                          'flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
                          c.bg, `ring-1 ${c.ring}`
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', c.bg)}>
                            <Library className={cn('h-3.5 w-3.5', c.text)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-xs font-semibold truncate', c.text)}>{kb.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {kb.doc_ids.length} doc{kb.doc_ids.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {kb.description && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                            {kb.description}
                          </p>
                        )}
                        {kb.doc_ids.length === 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                            <FolderOpen className="h-3 w-3" />
                            Empty — upload PDFs via right-click
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tech stack */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mr-1">
              Powered by
            </span>
            {['FastAPI', 'OpenAI GPT-4o-mini', 'FAISS', 'BM25', 'LangChain', 'React', 'TypeScript'].map(tech => (
              <span
                key={tech}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/60"
              >
                {tech}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <Sparkles className="h-3 w-3 text-blue-400" />
              RAG Q&amp;A · Free plan
            </span>
          </div>

          </>}

        </div>
      </div>
    </SidebarLayout>
  )
}
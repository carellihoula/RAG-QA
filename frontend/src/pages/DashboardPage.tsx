import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, BookOpen, Layers, MessageSquare,
  LayoutDashboard, Sparkles,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { SidebarLayout } from '@/components/AppSidebar'
import type { NavItem } from '@/components/AppSidebar'
import { cn } from '@/lib/utils'
import { listDocuments } from '../api'
import type { Document } from '../types'

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
    <div className="rounded-xl border bg-card shadow-lg px-3 py-2 text-xs">
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

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user-email')
    navigate('/login', { replace: true })
  }

  // ── Derived stats ──────────────────────────────────────────────────────

  const totalPages = documents.reduce((acc, d) => acc + (d.page_count ?? 0), 0)
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count ?? 0), 0)
  const msgCount = parseInt(localStorage.getItem('msg-count') ?? '0')

  // Last 7 days activity chart
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

          {/* Stat cards */}
          <div className="flex gap-4">
            <StatCard
              icon={FileText}
              label="Documents"
              value={isLoading ? '—' : documents.length}
              colorClass="bg-blue-500/10 text-blue-500"
              sub={`${Math.max(0, 10 - documents.length)} slots remaining`}
            />
            <StatCard
              icon={BookOpen}
              label="Pages indexed"
              value={isLoading ? '—' : totalPages}
              colorClass="bg-violet-500/10 text-violet-500"
              sub="across all documents"
            />
            <StatCard
              icon={Layers}
              label="Chunks indexed"
              value={isLoading ? '—' : totalChunks}
              colorClass="bg-emerald-500/10 text-emerald-500"
              sub="semantic + BM25 search"
            />
            <StatCard
              icon={MessageSquare}
              label="Messages sent"
              value={msgCount}
              colorClass="bg-amber-500/10 text-amber-500"
              sub="total Q&A exchanges"
            />
          </div>

          {/* Chart + Recent docs */}
          <div className="grid grid-cols-3 gap-4">

            {/* Indexing activity bar chart */}
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

        </div>
      </div>
    </SidebarLayout>
  )
}
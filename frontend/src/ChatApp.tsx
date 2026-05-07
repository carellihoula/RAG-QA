import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, X, MessageSquare, FileText,
  Sparkles, Loader2, RotateCcw, ArrowUp, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SidebarLayout } from '@/components/AppSidebar'
import type { NavItem } from '@/components/AppSidebar'
import { cn } from '@/lib/utils'
import {
  listDocuments, uploadDocument, deleteDocument,
  streamMessage, clearSession, getChunks,
} from './api'
import type { Document, Chunk, Message } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function nameFromEmail(email: string) {
  const prefix = email.split('@')[0]
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

const APP_NAV: NavItem[] = [
  { label: 'Chat', icon: MessageSquare, href: '/app' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatApp() {
  const navigate = useNavigate()
  const email = localStorage.getItem('user-email') ?? ''
  const user = { name: nameFromEmail(email) || 'Utilisateur', email }

  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [tab, setTab] = useState<'chat' | 'chunks'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { fetchDocuments() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchDocuments() {
    try {
      setDocuments(await listDocuments())
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') logout()
      else setError('Could not load documents.')
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user-email')
    navigate('/login', { replace: true })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadDocument(file)
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(docId: string) {
    try {
      await deleteDocument(docId)
      if (selectedDoc?.doc_id === docId) selectDocument(null)
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function selectDocument(doc: Document | null) {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id)
    setSelectedDoc(doc)
    setMessages([])
    setSessionId(null)
    setChunks([])
    setTab('chat')
    setError(null)
  }

  async function switchTab(next: 'chat' | 'chunks') {
    setTab(next)
    setError(null)
    if (next === 'chunks' && chunks.length === 0 && selectedDoc) {
      setChunksLoading(true)
      try {
        setChunks(await getChunks(selectedDoc.doc_id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chunks')
      } finally {
        setChunksLoading(false)
      }
    }
  }

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  async function submitMessage() {
    if (!input.trim() || !selectedDoc || loading) return
    const question = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    setError(null)

    setMessages(prev => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '', streaming: true },
    ])

    try {
      for await (const event of streamMessage(selectedDoc.doc_id, question, sessionId)) {
        if (event.type === 'token') {
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: last.content + event.content }
            }
            return msgs
          })
        } else if (event.type === 'sources') {
          setSessionId(event.session_id)
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, sources: event.sources, streaming: false }
            }
            return msgs
          })
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    } catch (err) {
      setMessages(prev => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && !last.content) msgs.pop()
        return msgs
      })
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setMessages(prev => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (last?.streaming) msgs[msgs.length - 1] = { ...last, streaming: false }
        return msgs
      })
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitMessage()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SidebarLayout sidebarProps={{ user, navItems: APP_NAV, onLogout: logout }}>
      <div className="flex h-full overflow-hidden">

        {/* ── Document sidebar ───────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">

          {/* Upload */}
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground px-1 mb-2">
              Documents
              {documents.length > 0 && (
                <span className="ml-2 bg-sidebar-accent text-sidebar-muted-foreground rounded-full px-1.5 py-px text-[10px]">
                  {documents.length}
                </span>
              )}
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-sidebar-border',
                'py-2.5 text-xs font-medium text-sidebar-muted-foreground transition-all duration-200',
                'hover:border-blue-500/50 hover:text-blue-500 hover:bg-blue-500/5',
                uploading && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />
              }
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleUpload} />
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-0.5 scrollbar-thin">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                <FileText className="h-8 w-8 text-sidebar-muted-foreground/30" />
                <p className="text-xs text-sidebar-muted-foreground leading-relaxed">
                  No documents yet.<br />Upload a PDF to start.
                </p>
              </div>
            ) : (
              documents.map(doc => (
                <button
                  key={doc.doc_id}
                  className={cn(
                    'group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
                    selectedDoc?.doc_id === doc.doc_id
                      ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                  onClick={() => selectDocument(doc)}
                >
                  <FileText className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                    selectedDoc?.doc_id === doc.doc_id
                      ? 'text-primary'
                      : 'text-sidebar-muted-foreground/50 group-hover:text-sidebar-muted-foreground'
                  )} />
                  <span className="truncate flex-1 text-xs font-medium">
                    {doc.title ?? doc.filename}
                  </span>
                  <span
                    role="button"
                    aria-label="Delete"
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                    onClick={e => { e.stopPropagation(); handleDelete(doc.doc_id) }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Main area ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {!selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 select-none">
              <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-violet-600/10 border border-blue-500/20 flex items-center justify-center shadow-xl shadow-blue-500/5">
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2 max-w-sm">
                <h2 className="text-2xl font-bold tracking-tight">Ask your documents</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload a PDF and have an AI-powered conversation about its content.
                  Powered by hybrid search &amp; GPT-4o-mini.
                </p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
              >
                <Upload className="h-4 w-4" />
                Upload a PDF
              </button>
              <p className="text-[11px] text-muted-foreground/50">
                or select an existing document in the sidebar
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <header className="flex items-center gap-3 px-5 py-2.5 border-b bg-card/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-3 w-3 text-blue-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate leading-tight">
                      {selectedDoc.title ?? selectedDoc.filename}
                    </span>
                    {selectedDoc.title && (
                      <span className="text-[10px] text-muted-foreground/50 truncate leading-tight">
                        {selectedDoc.filename}
                      </span>
                    )}
                  </div>
                </div>
                <Tabs value={tab} onValueChange={v => switchTab(v as 'chat' | 'chunks')}>
                  <TabsList className="h-7">
                    <TabsTrigger value="chat" className="text-xs h-6 px-3">Chat</TabsTrigger>
                    <TabsTrigger value="chunks" className="text-xs h-6 px-3">Chunks</TabsTrigger>
                  </TabsList>
                </Tabs>
                {tab === 'chat' && sessionId && (
                  <button
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Clear conversation"
                    onClick={() => selectDocument(selectedDoc)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </header>

              {/* ── Chat panel ── */}
              {tab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 scrollbar-thin">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                          Ask your first question about{' '}
                          <span className="font-medium text-foreground/70">
                            {selectedDoc.title ?? selectedDoc.filename}
                          </span>
                        </p>
                      </div>
                    )}

                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-3 animate-fade-in',
                          msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        {/* Avatar */}
                        {msg.role === 'assistant' ? (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                            <span className="text-[10px] font-bold text-zinc-200 leading-none">You</span>
                          </div>
                        )}

                        {/* Bubble */}
                        <div className={cn(
                          'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-card border border-border/80 rounded-tl-sm'
                        )}>
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                            {msg.streaming && (
                              <span className="inline-block w-[2px] h-[0.85em] rounded-full bg-current align-text-bottom ml-[2px] animate-cursor-blink" />
                            )}
                          </p>

                          {/* Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <details className="mt-3">
                              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs font-medium select-none opacity-50 hover:opacity-90 transition-opacity">
                                <ChevronRight className="h-3 w-3 details-chevron transition-transform" />
                                {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} referenced
                              </summary>
                              <div className="mt-2.5 flex flex-col gap-2">
                                {msg.sources.map((s, j) => (
                                  <div key={j} className="rounded-xl bg-black/5 dark:bg-white/5 border border-border/40 p-3">
                                    <Badge variant="outline" className="text-[10px] h-4 mb-2 font-mono tracking-tight">
                                      Page {s.page}
                                    </Badge>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{s.content}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}

                    {error && (
                      <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3 animate-fade-in">
                        <span className="font-semibold shrink-0">Error:</span>
                        <span>{error}</span>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input bar */}
                  <form className="flex-shrink-0 px-5 pb-5 pt-3 border-t bg-card/40" onSubmit={handleSubmit}>
                    <div className={cn(
                      'flex items-end gap-2 bg-background border rounded-2xl px-4 py-2.5 transition-all duration-200 shadow-sm',
                      'focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-500/40 focus-within:shadow-md'
                    )}>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={e => { setInput(e.target.value); autoResize() }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question… (Enter ↵ to send)"
                        disabled={loading}
                        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32 leading-relaxed py-0.5 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className={cn(
                          'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200',
                          input.trim() && !loading
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-90'
                            : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                        )}
                      >
                        {loading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ArrowUp className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground/30 mt-2 tracking-wide">
                      GPT-4o-mini · Hybrid search (BM25 + semantic) · Shift+Enter for newline
                    </p>
                  </form>
                </>
              )}

              {/* ── Chunks panel ── */}
              {tab === 'chunks' && (
                <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 scrollbar-thin">
                  {chunksLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chunks…
                    </div>
                  )}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {!chunksLoading && chunks.length > 0 && (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
                        {chunks.length} chunks indexed
                      </p>
                      {chunks.map((chunk, i) => (
                        <div key={i} className="rounded-xl border bg-card px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px] font-mono h-5">Page {chunk.page}</Badge>
                            <span className="text-[10px] text-muted-foreground/40">#{i + 1}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {chunk.content}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </SidebarLayout>
  )
}
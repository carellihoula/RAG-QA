import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, X, MessageSquare, FileText, LayoutDashboard,
  Sparkles, Loader2, RotateCcw, ArrowUp, ChevronRight,
  Library, Plus, ChevronDown, Trash2, Pencil, Minus,
  Globe, Play, BookOpen, Atom, Rss, Table, FileCode,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SidebarLayout } from '@/components/AppSidebar'
import type { NavItem } from '@/components/AppSidebar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddSourceModal } from '@/components/AddSourceModal'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger, ContextMenuLabel,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import {
  listDocuments, uploadDocument, deleteDocument,
  streamMessage, streamKbMessage, clearSession,
  getChunks, listKnowledgeBases, createKnowledgeBase,
  deleteKnowledgeBase, updateKnowledgeBase, addDocToKb, removeDocFromKb,
  getKbDocuments,
} from './api'
import type { Document, Chunk, Message, KnowledgeBase } from './types'

// ── Constants & helpers ───────────────────────────────────────────────────────

const MAX_DOCS = 10
const MAX_KBS  = 3

const SOURCE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf:       { icon: FileText,  color: 'text-red-400' },
  docx:      { icon: FileText,  color: 'text-blue-400' },
  pptx:      { icon: FileText,  color: 'text-orange-400' },
  xlsx:      { icon: Table,     color: 'text-green-400' },
  csv:       { icon: Table,     color: 'text-emerald-400' },
  txt:       { icon: FileCode,  color: 'text-slate-400' },
  md:        { icon: FileCode,  color: 'text-slate-400' },
  html:      { icon: Globe,     color: 'text-violet-400' },
  url:       { icon: Globe,     color: 'text-blue-400' },
  youtube:   { icon: Play,      color: 'text-red-400' },
  wikipedia: { icon: BookOpen,  color: 'text-slate-400' },
  arxiv:     { icon: Atom,      color: 'text-violet-400' },
  rss:       { icon: Rss,       color: 'text-amber-400' },
}

const KB_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-500' },
  violet:  { dot: 'bg-violet-500',  bg: 'bg-violet-500/10',  text: 'text-violet-500' },
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  amber:   { dot: 'bg-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-500' },
  pink:    { dot: 'bg-pink-500',    bg: 'bg-pink-500/10',    text: 'text-pink-500' },
  slate:   { dot: 'bg-slate-500',   bg: 'bg-slate-500/10',   text: 'text-slate-500' },
}

function nameFromEmail(email: string) {
  const prefix = email.split('@')[0]
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

const APP_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Chat',      icon: MessageSquare,   href: '/app' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatApp() {
  const navigate = useNavigate()
  const email = localStorage.getItem('user-email') ?? ''
  const user  = { name: nameFromEmail(email) || 'Utilisateur', email }

  // Data
  const [documents,       setDocuments]       = useState<Document[]>([])
  const [knowledgeBases,  setKnowledgeBases]  = useState<KnowledgeBase[]>([])

  // Selection — one of the two is set at a time
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedKb,  setSelectedKb]  = useState<KnowledgeBase | null>(null)

  // Chat
  const [tab,           setTab]           = useState<'chat' | 'chunks'>('chat')
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [sessionId,     setSessionId]     = useState<string | null>(null)
  const [chunks,        setChunks]        = useState<Chunk[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [loading,       setLoading]       = useState(false)

  // Upload / drag
  const [uploading,   setUploading]   = useState(false)
  const [isDragging,  setIsDragging]  = useState(false)
  const dragCounter = useRef(0)

  // Add source modal
  const [showAddSource, setShowAddSource] = useState(false)

  // KB creation form
  const [isCreatingKb, setIsCreatingKb] = useState(false)
  const [newKbName,    setNewKbName]    = useState('')
  const [newKbColor,   setNewKbColor]   = useState('blue')

  // KB expand / rename / docs
  const [expandedKbs,  setExpandedKbs]  = useState<string[]>([])
  const [renamingKbId, setRenamingKbId] = useState<string | null>(null)
  const [renameValue,  setRenameValue]  = useState('')
  const [kbDocs,       setKbDocs]       = useState<Record<string, Document[]>>({})

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    confirmLabel: string
    variant: 'danger' | 'default'
    onConfirm: () => void
  }>({ open: false, title: '', description: '', confirmLabel: 'Confirm', variant: 'danger', onConfirm: () => {} })

  const bottomRef      = useRef<HTMLDivElement>(null)
  const kbFileRef      = useRef<HTMLInputElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const kbInputRef     = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const kbUploadTarget = useRef<string | null>(null)

  useEffect(() => { fetchDocuments(); fetchKnowledgeBases() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (isCreatingKb) kbInputRef.current?.focus() }, [isCreatingKb])
  useEffect(() => { if (renamingKbId) renameInputRef.current?.focus() }, [renamingKbId])

  // ── Data fetching ───────────────────────────────────────────────────

  async function fetchDocuments() {
    try { setDocuments(await listDocuments()) }
    catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') logout()
      else toast.error('Could not load documents.')
    }
  }

  async function fetchKnowledgeBases() {
    try { setKnowledgeBases(await listKnowledgeBases()) }
    catch { toast.error('Could not load knowledge bases.') }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user-email')
    navigate('/login', { replace: true })
  }

  // ── Upload / drag & drop ────────────────────────────────────────────


  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault(); dragCounter.current++; setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); dragCounter.current = 0; setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) {
      // Trigger upload directly for drag-and-drop (no modal needed)
      handleMultiUpload(files)
    }
  }

  async function handleMultiUpload(files: File[]) {
    if (uploading) return
    setUploading(true)
    for (const file of files) {
      try {
        const newDoc = await uploadDocument(file)
        await fetchDocuments()
        selectDocument(newDoc)
        toast.success(`"${newDoc.title ?? newDoc.filename}" uploaded`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed: ${file.name}`)
      }
    }
    setUploading(false)
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteDocument(docId)
      if (selectedDoc?.doc_id === docId) selectDocument(null)
      await fetchDocuments()
      toast.success('Document deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Confirm dialog helpers ──────────────────────────────────────────

  function showConfirm(opts: Omit<typeof confirmDialog, 'open'>) {
    setConfirmDialog({ ...opts, open: true })
  }

  function confirmDeleteDoc(doc: Document) {
    const linkedKbs = knowledgeBases.filter(kb => kb.doc_ids.includes(doc.doc_id))
    const name = doc.title ?? doc.filename
    if (linkedKbs.length > 0) {
      const kbNames = linkedKbs.map(kb => `"${kb.name}"`).join(', ')
      showConfirm({
        title: 'Remove from library',
        description: `"${name}" will be removed from your library but will stay accessible in ${kbNames}. The file and index are preserved.`,
        confirmLabel: 'Remove from library',
        variant: 'default',
        onConfirm: () => handleDeleteDoc(doc.doc_id),
      })
    } else {
      showConfirm({
        title: 'Delete document',
        description: `"${name}" will be permanently deleted along with its index. This action cannot be undone.`,
        confirmLabel: 'Delete permanently',
        variant: 'danger',
        onConfirm: () => handleDeleteDoc(doc.doc_id),
      })
    }
  }

  function confirmDeleteKb(kb: KnowledgeBase) {
    const n = kb.doc_ids.length
    showConfirm({
      title: `Delete "${kb.name}"`,
      description: n > 0
        ? `This Knowledge Base will be deleted. The ${n} linked document${n > 1 ? 's' : ''} will remain in your library.`
        : 'This Knowledge Base will be permanently deleted.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => handleDeleteKb(kb.id),
    })
  }

  function confirmRemoveFromKb(kb: KnowledgeBase, doc: Document) {
    showConfirm({
      title: 'Remove from Knowledge Base',
      description: `"${doc.title ?? doc.filename}" will be removed from "${kb.name}". The document will remain in your library.`,
      confirmLabel: 'Remove',
      variant: 'default',
      onConfirm: () => handleRemoveDocFromKb(kb.id, doc.doc_id),
    })
  }

  // ── Knowledge Base actions ──────────────────────────────────────────

  async function handleCreateKb() {
    const name = newKbName.trim()
    if (!name) return
    try {
      const kb = await createKnowledgeBase({ name, color: newKbColor })
      setKnowledgeBases(prev => [...prev, kb])
      setNewKbName('')
      setNewKbColor('blue')
      setIsCreatingKb(false)
      toast.success(`Knowledge Base "${kb.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create knowledge base')
    }
  }

  async function handleDeleteKb(kbId: string) {
    try {
      await deleteKnowledgeBase(kbId)
      if (selectedKb?.id === kbId) selectKb(null)
      await fetchKnowledgeBases()
      toast.success('Knowledge Base deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete knowledge base')
    }
  }

  async function fetchKbDocs(kbId: string) {
    try {
      const docs = await getKbDocuments(kbId)
      setKbDocs(prev => ({ ...prev, [kbId]: docs }))
    } catch { /* silent */ }
  }

  async function handleRemoveDocFromKb(kbId: string, docId: string) {
    try {
      await removeDocFromKb(kbId, docId)
      await fetchKnowledgeBases()
      await fetchKbDocs(kbId)
      toast.success('Document removed from Knowledge Base')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document')
    }
  }

  function toggleKbExpand(kbId: string) {
    setExpandedKbs(prev => {
      if (prev.includes(kbId)) return prev.filter(id => id !== kbId)
      fetchKbDocs(kbId)
      return [...prev, kbId]
    })
  }

  function startRename(kb: KnowledgeBase) {
    setRenamingKbId(kb.id)
    setRenameValue(kb.name)
  }

  async function confirmRename(kbId: string) {
    const name = renameValue.trim()
    setRenamingKbId(null)
    if (!name) return
    try {
      const updated = await updateKnowledgeBase(kbId, { name })
      setKnowledgeBases(prev => prev.map(k => k.id === kbId ? { ...k, name: updated.name } : k))
      if (selectedKb?.id === kbId) setSelectedKb(prev => prev ? { ...prev, name: updated.name } : null)
      toast.success('Knowledge Base renamed')
    } catch (err) {
      toast.error('Failed to rename')
    }
  }

  function openKbUpload(kbId: string) {
    kbUploadTarget.current = kbId
    if (kbFileRef.current) {
      kbFileRef.current.value = ''
      kbFileRef.current.click()
    }
  }

  async function handleKbFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const kbId = kbUploadTarget.current
    if (!kbId) return
    const files = Array.from(e.target.files ?? []).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) { toast.error('Only PDF files are supported'); return }

    const kb = knowledgeBases.find(k => k.id === kbId)
    const kbName = kb?.name ?? 'Knowledge Base'
    const toastId = toast.loading(`Uploading 0 / ${files.length} PDFs…`)

    let uploaded = 0
    for (const file of files) {
      try {
        const doc = await uploadDocument(file)
        await addDocToKb(kbId, doc.doc_id)
        uploaded++
        toast.loading(`Uploading ${uploaded} / ${files.length} PDFs…`, { id: toastId })
      } catch (err) {
        toast.error(`Failed: ${file.name}`)
      }
    }

    await fetchDocuments()
    await fetchKnowledgeBases()
    await fetchKbDocs(kbId)
    toast.success(`${uploaded} PDF${uploaded !== 1 ? 's' : ''} added to "${kbName}"`, { id: toastId })
    kbUploadTarget.current = null
  }

  async function handleToggleDocInKb(kbId: string, docId: string, isInKb: boolean) {
    try {
      if (isInKb) {
        await removeDocFromKb(kbId, docId)
      } else {
        await addDocToKb(kbId, docId)
      }
      await fetchKnowledgeBases()
      // Refresh selected KB if it was modified
      if (selectedKb?.id === kbId) {
        const updated = knowledgeBases.find(k => k.id === kbId)
        if (updated) {
          const newDocIds = isInKb
            ? updated.doc_ids.filter(id => id !== docId)
            : [...updated.doc_ids, docId]
          setSelectedKb({ ...updated, doc_ids: newDocIds })
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update knowledge base')
    }
  }

  // ── Selection ────────────────────────────────────────────────────────

  function resetChat() {
    setMessages([])
    setSessionId(null)
    setChunks([])
    setTab('chat')
  }

  function selectDocument(doc: Document | null) {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id)
    setSelectedKb(null)
    setSelectedDoc(doc)
    resetChat()
  }

  function selectKb(kb: KnowledgeBase | null) {
    setSelectedDoc(null)
    setSelectedKb(kb)
    resetChat()
  }

  function clearConversation() {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id)
    resetChat()
  }

  // ── Tab / chunks ─────────────────────────────────────────────────────

  async function switchTab(next: 'chat' | 'chunks') {
    setTab(next)
    if (next === 'chunks' && chunks.length === 0 && selectedDoc) {
      setChunksLoading(true)
      try { setChunks(await getChunks(selectedDoc.doc_id)) }
      catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to load chunks') }
      finally { setChunksLoading(false) }
    }
  }

  // ── Textarea ─────────────────────────────────────────────────────────

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage() }
  }

  // ── Submit message ────────────────────────────────────────────────────

  async function submitMessage() {
    if (!input.trim() || loading) return
    if (!selectedDoc && !selectedKb) return

    const question = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    setMessages(prev => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '', streaming: true },
    ])

    try {
      const stream = selectedKb
        ? streamKbMessage(selectedKb.id, question, sessionId)
        : streamMessage(selectedDoc!.doc_id, question, sessionId)

      for await (const event of stream) {
        if (event.type === 'token') {
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant')
              msgs[msgs.length - 1] = { ...last, content: last.content + event.content }
            return msgs
          })
        } else if (event.type === 'sources') {
          const prev = parseInt(localStorage.getItem('msg-count') ?? '0')
          localStorage.setItem('msg-count', String(prev + 1))
          setSessionId(event.session_id)
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant')
              msgs[msgs.length - 1] = { ...last, sources: event.sources, streaming: false }
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
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
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
    e.preventDefault(); submitMessage()
  }

  // ── Derived values ────────────────────────────────────────────────────

  const docUsagePct = Math.min((documents.length / MAX_DOCS) * 100, 100)
  const kbUsagePct  = Math.min((knowledgeBases.length / MAX_KBS) * 100, 100)
  const activeTarget = selectedKb ?? selectedDoc

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <SidebarLayout sidebarProps={{ user, navItems: APP_NAV, onLogout: logout }}>
      <div
        className="flex h-full overflow-hidden relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >

        {/* ── Drop overlay ──────────────────────────────────────────── */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-4 border-2 border-dashed border-blue-500/60 rounded-2xl px-20 py-16 bg-blue-500/5">
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Upload className="h-7 w-7 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">Drop your PDF here</p>
                <p className="text-sm text-muted-foreground mt-0.5">Release to upload and index</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Document sidebar ───────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">

          {/* ── Knowledge Bases section ── */}
          <div className="px-3 pt-4 pb-1 flex-shrink-0">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
                Knowledge Bases
                {knowledgeBases.length > 0 && (
                  <span className="ml-1.5 bg-sidebar-accent rounded-full px-1.5 py-px text-[10px]">
                    {knowledgeBases.length}
                  </span>
                )}
              </p>
              {knowledgeBases.length < MAX_KBS && (
                <button
                  onClick={() => setIsCreatingKb(v => !v)}
                  className="h-5 w-5 rounded-md flex items-center justify-center text-sidebar-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                  title="New Knowledge Base"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Create KB form */}
            {isCreatingKb && (
              <div className="mb-2 p-2.5 rounded-xl border bg-card flex flex-col gap-2 shadow-sm">
                <input
                  ref={kbInputRef}
                  value={newKbName}
                  onChange={e => setNewKbName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateKb(); if (e.key === 'Escape') setIsCreatingKb(false) }}
                  placeholder="Knowledge Base name…"
                  className="text-xs bg-transparent outline-none border-b border-border pb-1 w-full"
                />
                <div className="flex items-center gap-1">
                  {Object.entries(KB_COLORS).map(([color, cls]) => (
                    <button
                      key={color}
                      onClick={() => setNewKbColor(color)}
                      className={cn(
                        'h-3.5 w-3.5 rounded-full border-2 transition-all',
                        cls.dot,
                        newKbColor === color ? 'border-foreground scale-125' : 'border-transparent opacity-60'
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateKb}
                    disabled={!newKbName.trim()}
                    className="flex-1 text-[10px] py-1 rounded-md bg-blue-600 text-white font-medium disabled:opacity-40"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreatingKb(false); setNewKbName('') }}
                    className="flex-1 text-[10px] py-1 rounded-md bg-muted text-muted-foreground font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* KB list */}
            <div className="flex flex-col gap-0.5">
              {knowledgeBases.length === 0 && !isCreatingKb && (
                <p className="text-[10px] text-sidebar-muted-foreground/50 px-1 py-1.5 leading-relaxed">
                  Group documents by topic or team.
                </p>
              )}
              {knowledgeBases.map(kb => {
                const colors     = KB_COLORS[kb.color] ?? KB_COLORS.blue
                const isActive   = selectedKb?.id === kb.id
                const isExpanded = expandedKbs.includes(kb.id)
                return (
                  <div key={kb.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            'group flex items-center gap-1 px-1 py-1 rounded-lg transition-all duration-150 cursor-pointer',
                            isActive
                              ? `${colors.bg} ${colors.text} ring-1 ring-inset ring-current/20`
                              : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          {/* Expand toggle */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleKbExpand(kb.id) }}
                            className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', !isExpanded && '-rotate-90')} />
                          </button>

                          {/* KB row — click to select for chat */}
                          <button
                            onClick={() => selectKb(isActive ? null : kb)}
                            className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                          >
                            <Library className="h-3.5 w-3.5 flex-shrink-0" />
                            {renamingKbId === kb.id ? (
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); confirmRename(kb.id) }
                                  if (e.key === 'Escape') setRenamingKbId(null)
                                }}
                                onBlur={() => confirmRename(kb.id)}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none border-b border-current"
                              />
                            ) : (
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-xs font-medium">{kb.name}</span>
                                <span className="text-[10px] opacity-60">
                                  {kb.doc_ids.length} doc{kb.doc_ids.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </button>

                          {/* Delete on hover */}
                          <button
                            aria-label="Delete knowledge base"
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                            onClick={e => { e.stopPropagation(); confirmDeleteKb(kb) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuLabel className="truncate">{kb.name}</ContextMenuLabel>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => openKbUpload(kb.id)} className="text-xs">
                          <Upload className="h-3.5 w-3.5" />
                          Upload PDFs
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => startRename(kb)} className="text-xs">
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => confirmDeleteKb(kb)}
                          className="text-xs text-red-500 focus:text-red-500 focus:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* Expanded — list KB's PDFs */}
                    {isExpanded && (
                      <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                        {(kbDocs[kb.id] ?? []).length === 0 ? (
                          <p className="text-[10px] text-sidebar-muted-foreground/40 py-1 italic">No documents yet</p>
                        ) : (
                          (kbDocs[kb.id] ?? []).map(doc => {
                            const isDocActive = selectedDoc?.doc_id === doc.doc_id
                            const isKbOnly = doc.in_library === false
                            return (
                              <div
                                key={doc.doc_id}
                                className={cn(
                                  'group flex items-center gap-1 px-1.5 py-1 rounded-md transition-all duration-150',
                                  isDocActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                )}
                              >
                                <button
                                  onClick={() => selectDocument(isDocActive ? null : doc)}
                                  className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                                >
                                  <FileText className="h-3 w-3 flex-shrink-0 opacity-60" />
                                  <span className="truncate text-xs">{doc.title ?? doc.filename}</span>
                                  {isKbOnly && (
                                    <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">KB</span>
                                  )}
                                </button>
                                <button
                                  onClick={() => confirmRemoveFromKb(kb, doc)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                                  aria-label="Remove from KB"
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mx-3 my-1.5 border-t border-sidebar-border flex-shrink-0" />

          {/* ── Documents section ── */}
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
                Documents
                {documents.length > 0 && (
                  <span className="ml-1.5 bg-sidebar-accent rounded-full px-1.5 py-px text-[10px]">
                    {documents.length}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowAddSource(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-sidebar-border py-2 text-xs font-medium text-sidebar-muted-foreground transition-all duration-200 hover:border-blue-500/50 hover:text-blue-500 hover:bg-blue-500/5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add source
            </button>
            <input ref={kbFileRef} type="file" accept="*" multiple hidden onChange={handleKbFilesChange} />
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5 scrollbar-thin">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                <FileText className="h-7 w-7 text-sidebar-muted-foreground/30" />
                <p className="text-xs text-sidebar-muted-foreground leading-relaxed">
                  No documents yet.<br />Upload a PDF to start.
                </p>
              </div>
            ) : (
              documents.map(doc => {
                const docKbs = knowledgeBases.filter(kb => kb.doc_ids.includes(doc.doc_id))
                const isActive = selectedDoc?.doc_id === doc.doc_id
                return (
                  <button
                    key={doc.doc_id}
                    className={cn(
                      'group w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                        : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                    onClick={() => selectDocument(isActive ? null : doc)}
                  >
                    {(() => {
                      const sm = SOURCE_ICONS[doc.source_type ?? 'pdf'] ?? SOURCE_ICONS.pdf
                      return <sm.icon className={cn('h-3.5 w-3.5 flex-shrink-0 transition-colors mt-0.5', isActive ? 'text-primary' : sm.color)} />
                    })()}
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {doc.title ?? doc.filename}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {(doc.page_count != null || doc.chunk_count != null) && (
                          <span className="text-[10px] text-sidebar-muted-foreground/50">
                            {doc.page_count != null ? `${doc.page_count}p` : ''}
                            {doc.page_count != null && doc.chunk_count != null ? ' · ' : ''}
                            {doc.chunk_count != null ? `${doc.chunk_count} chunks` : ''}
                          </span>
                        )}
                        {docKbs.map(kb => {
                          const c = KB_COLORS[kb.color] ?? KB_COLORS.blue
                          return (
                            <span key={kb.id} className={cn('text-[9px] px-1 rounded font-medium', c.bg, c.text)}>
                              {kb.name}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* Actions: add to KB + delete */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 mt-0.5 transition-all">
                      {knowledgeBases.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span
                              role="button"
                              aria-label="Add to Knowledge Base"
                              className="p-0.5 rounded text-sidebar-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                              onClick={e => e.stopPropagation()}
                            >
                              <Library className="h-3 w-3" />
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" className="w-44">
                            {knowledgeBases.map(kb => {
                              const inKb = kb.doc_ids.includes(doc.doc_id)
                              const c = KB_COLORS[kb.color] ?? KB_COLORS.blue
                              return (
                                <DropdownMenuItem
                                  key={kb.id}
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleToggleDocInKb(kb.id, doc.doc_id, inKb)
                                  }}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', c.dot)} />
                                  <span className="flex-1 truncate">{kb.name}</span>
                                  {inKb && <span className="text-blue-500 text-[10px]">✓</span>}
                                </DropdownMenuItem>
                              )
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <span
                        role="button"
                        aria-label="Delete"
                        className="p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all"
                        onClick={e => { e.stopPropagation(); confirmDeleteDoc(doc) }}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Plan badge */}
          <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted-foreground">
                <Sparkles className="h-3 w-3 text-blue-400" />
                Free plan
              </span>
              <span className="text-[10px] text-sidebar-muted-foreground/50">
                {knowledgeBases.length}/{MAX_KBS} KB · {documents.length}/{MAX_DOCS} docs
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="h-0.5 rounded-full bg-sidebar-accent overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${docUsagePct}%` }} />
              </div>
              <div className="h-0.5 rounded-full bg-sidebar-accent overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${kbUsagePct}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main area ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {!activeTarget ? (
            /* ── Welcome screen ── */
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
                  Select a <strong>Knowledge Base</strong> to query multiple documents at once,
                  or pick a single document from the sidebar.
                </p>
              </div>

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-14 w-14">
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/10 border border-blue-500/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">Uploading your document…</p>
                    <p className="text-xs text-muted-foreground">AI is extracting &amp; indexing the content</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {knowledgeBases.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-muted transition-all text-sm font-medium">
                          <Library className="h-4 w-4 text-violet-500" />
                          Open a KB
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {knowledgeBases.map(kb => {
                          const c = KB_COLORS[kb.color] ?? KB_COLORS.blue
                          return (
                            <DropdownMenuItem key={kb.id} onClick={() => selectKb(kb)} className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                              {kb.name}
                              <span className="ml-auto text-[10px] text-muted-foreground">{kb.doc_ids.length} docs</span>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button
                    onClick={() => setShowAddSource(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Upload className="h-4 w-4" />
                    Add a source
                  </button>
                </div>
              )}

              {!uploading && (
                <p className="text-[11px] text-muted-foreground/50">
                  drag &amp; drop anywhere · or select from the sidebar
                </p>
              )}
            </div>

          ) : (
            <>
              {/* ── Header ── */}
              <header className="flex items-center gap-3 px-5 py-2.5 border-b bg-card/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedKb ? (
                    <>
                      <div className={cn(
                        'h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0',
                        KB_COLORS[selectedKb.color]?.bg ?? 'bg-violet-500/10'
                      )}>
                        <Library className={cn('h-3 w-3', KB_COLORS[selectedKb.color]?.text ?? 'text-violet-500')} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate leading-tight">{selectedKb.name}</span>
                        <span className="text-[10px] text-muted-foreground/50 leading-tight">
                          {selectedKb.doc_ids.length} document{selectedKb.doc_ids.length !== 1 ? 's' : ''} · Knowledge Base
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3 w-3 text-blue-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate leading-tight">
                          {selectedDoc!.title ?? selectedDoc!.filename}
                        </span>
                        {selectedDoc!.title && (
                          <span className="text-[10px] text-muted-foreground/50 truncate leading-tight">
                            {selectedDoc!.filename}
                          </span>
                        )}
                      </div>
                      {(selectedDoc!.page_count != null || selectedDoc!.chunk_count != null) && (
                        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                          {selectedDoc!.page_count != null && (
                            <Badge variant="outline" className="text-[10px] h-4 font-mono">{selectedDoc!.page_count}p</Badge>
                          )}
                          {selectedDoc!.chunk_count != null && (
                            <Badge variant="outline" className="text-[10px] h-4 font-mono">{selectedDoc!.chunk_count} chunks</Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {selectedDoc && (
                  <Tabs value={tab} onValueChange={v => switchTab(v as 'chat' | 'chunks')}>
                    <TabsList className="h-7">
                      <TabsTrigger value="chat"   className="text-xs h-6 px-3">Chat</TabsTrigger>
                      <TabsTrigger value="chunks" className="text-xs h-6 px-3">Chunks</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                {tab === 'chat' && sessionId && (
                  <button
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Clear conversation"
                    onClick={clearConversation}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </header>

              {/* ── Chat panel ── */}
              {(tab === 'chat' || selectedKb) && (
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 scrollbar-thin">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                        {selectedKb ? (
                          <Library className="h-8 w-8 text-muted-foreground/20" />
                        ) : (
                          <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                        )}
                        <p className="text-sm text-muted-foreground">
                          {selectedKb
                            ? <>Ask anything across <span className="font-medium text-foreground/70">{selectedKb.name}</span> — {selectedKb.doc_ids.length} documents indexed</>
                            : <>Ask your first question about <span className="font-medium text-foreground/70">{selectedDoc!.title ?? selectedDoc!.filename}</span></>
                          }
                        </p>
                      </div>
                    )}

                    {messages.map((msg, i) => (
                      <div key={i} className={cn('flex gap-3 animate-fade-in', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                        {msg.role === 'assistant' ? (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                            <span className="text-[10px] font-bold text-zinc-200 leading-none">You</span>
                          </div>
                        )}
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
                    <div ref={bottomRef} />
                  </div>

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
                        placeholder={selectedKb
                          ? `Ask across ${selectedKb.name}… (Enter ↵ to send)`
                          : 'Ask a question… (Enter ↵ to send)'
                        }
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
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground/30 mt-2 tracking-wide">
                      {selectedKb
                        ? `GPT-4o-mini · ${selectedKb.doc_ids.length} documents · Hybrid search`
                        : 'GPT-4o-mini · Hybrid search (BM25 + semantic) · Shift+Enter for newline'
                      }
                    </p>
                  </form>
                </>
              )}

              {/* ── Chunks panel (doc mode only) ── */}
              {tab === 'chunks' && selectedDoc && (
                <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 scrollbar-thin">
                  {chunksLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chunks…
                    </div>
                  )}
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
      <AddSourceModal
        open={showAddSource}
        onOpenChange={setShowAddSource}
        onDocumentAdded={async (doc) => {
          await fetchDocuments()
          selectDocument(doc)
        }}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </SidebarLayout>
  )
}
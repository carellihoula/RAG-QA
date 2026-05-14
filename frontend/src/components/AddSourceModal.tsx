import { useState, useRef } from 'react'
import {
  FileText, FileCode, Globe, BookOpen, Atom, Rss,
  Table, Upload, Link, Loader2, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { uploadDocument, importFromUrl, getDocumentStatus } from '../api'
import { useChatContext } from '@/context/ChatContext'
import type { Document } from '../types'

// ── Source type metadata ──────────────────────────────────────────────────────

interface SourceMeta {
  label: string
  icon: React.ElementType
  color: string
  accept?: string
  placeholder?: string
  hint?: string
  inputLabel?: string
}

const FILE_TYPES: Record<string, SourceMeta> = {
  pdf:  { label: 'PDF',        icon: FileText, color: 'text-red-500 bg-red-500/10',     accept: '.pdf' },
  docx: { label: 'Word',       icon: FileText, color: 'text-blue-500 bg-blue-500/10',   accept: '.docx,.doc' },
  pptx: { label: 'PowerPoint', icon: FileText, color: 'text-orange-500 bg-orange-500/10', accept: '.pptx,.ppt' },
  xlsx: { label: 'Excel',      icon: Table,    color: 'text-green-500 bg-green-500/10', accept: '.xlsx,.xls' },
  csv:  { label: 'CSV',        icon: Table,    color: 'text-emerald-500 bg-emerald-500/10', accept: '.csv' },
  txt:  { label: 'Text/MD',    icon: FileCode, color: 'text-slate-500 bg-slate-500/10', accept: '.txt,.md,.markdown' },
  html: { label: 'HTML',       icon: Globe,    color: 'text-violet-500 bg-violet-500/10', accept: '.html,.htm' },
}

const WEB_TYPES: Record<string, SourceMeta> = {
  url:       { label: 'Web page',  icon: Globe,    color: 'text-blue-500 bg-blue-500/10',    placeholder: 'https://example.com/article', hint: 'Any public web page will be scraped and indexed', inputLabel: 'URL' },
  wikipedia: { label: 'Wikipedia', icon: BookOpen, color: 'text-slate-500 bg-slate-500/10',  placeholder: 'Artificial intelligence', hint: 'Enter a Wikipedia article title or search query', inputLabel: 'Article title' },
  arxiv:     { label: 'arXiv',     icon: Atom,     color: 'text-violet-500 bg-violet-500/10', placeholder: '2401.12345 or https://arxiv.org/abs/...', hint: 'Enter a paper ID or arXiv URL', inputLabel: 'Paper ID or URL' },
  rss:       { label: 'RSS Feed',  icon: Rss,      color: 'text-amber-500 bg-amber-500/10',  placeholder: 'https://example.com/feed.xml', hint: 'Last 30 entries will be indexed', inputLabel: 'Feed URL' },
}

const ALL_ACCEPT = Object.values(FILE_TYPES).map(t => t.accept).join(',')

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentAdded: (doc: Document) => void
  targetKbId?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddSourceModal({ open, onOpenChange, onDocumentAdded, targetKbId }: Props) {
  const { showQuotaDialog } = useChatContext()
  const [tab, setTab]           = useState<'files' | 'web'>('files')
  const [webType, setWebType]   = useState<string>('url')
  const [urlInput, setUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState<{ done: number; total: number; phase: 'uploading' | 'indexing' } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter  = useRef(0)

  // ── Helpers ─────────────────────────────────────────────────────────

  async function pollUntilReady(docId: string): Promise<Document> {
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const s = await getDocumentStatus(docId)
      if (s.status === 'ready') return s
      if (s.status === 'error') throw new Error(s.error ?? 'Indexing failed')
    }
    throw new Error('Indexing timed out')
  }

  // ── File upload ─────────────────────────────────────────────────────

  const MAX_FILE_MB = 10
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

  async function handleFiles(files: File[]) {
    if (!files.length || uploading) return
    setUploading(true)
    let succeeded = 0

    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_FILE_BYTES) {
        toast.error(`${files[i].name} exceeds the ${MAX_FILE_MB} MB limit`)
        continue
      }
      try {
        setProgress({ done: i, total: files.length, phase: 'uploading' })
        const partial = await uploadDocument(files[i])
        setProgress({ done: i, total: files.length, phase: 'indexing' })
        const doc = await pollUntilReady(partial.doc_id)
        onDocumentAdded(doc)
        succeeded++
        setProgress({ done: succeeded, total: files.length, phase: 'indexing' })
      } catch (err) {
        const e = err as { status?: number; detail?: { code?: string; doc_limit?: number } }
        const isQuota = e.status === 402 || e.detail?.code === 'quota_exceeded'
        if (isQuota) {
          const limit = e.detail?.doc_limit ?? 5
          showQuotaDialog(limit)
          break
        }
        toast.error(err instanceof Error ? err.message : `Failed to upload ${files[i].name}`)
      }
    }

    if (succeeded > 0)
      toast.success(`${succeeded} file${succeeded > 1 ? 's' : ''} imported`)
    setUploading(false)
    setProgress(null)
    if (succeeded === 1 && files.length === 1) onOpenChange(false)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) handleFiles(files)
    e.target.value = ''
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    if (--dragCounter.current === 0) setIsDragging(false)
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  // ── Web import ──────────────────────────────────────────────────────

  async function handleWebImport() {
    const value = urlInput.trim()
    if (!value || uploading) return
    setUploading(true)
    try {
      const partial = await importFromUrl({ url: value, source_type: webType as 'url' | 'wikipedia' | 'arxiv' | 'rss' })
      const doc = await pollUntilReady(partial.doc_id)
      onDocumentAdded(doc)
      toast.success(`"${doc.title ?? doc.filename}" imported`)
      setUrlInput('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  const webMeta = WEB_TYPES[webType]

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) onOpenChange(v) }}>
      <DialogContent
        className="max-w-xl"
        onInteractOutside={(e) => { if (uploading) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (uploading) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-500" />
            Add a source
          </DialogTitle>
          <DialogDescription>
            {targetKbId ? 'Files will be added to the selected Knowledge Base.' : 'Import any document or web source to your library.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {(['files', 'web'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'files' ? 'Files' : 'Web & APIs'}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* ── Files tab ── */}
          {tab === 'files' && (
            <>
              {/* Drop zone */}
              <div
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={cn(
                  'rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
                  isDragging
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-border hover:border-blue-500/50 hover:bg-blue-500/5'
                )}
              >
                {uploading && progress ? (
                  <>
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium">
                      {progress.phase === 'uploading'
                        ? `Uploading ${progress.done + 1} / ${progress.total}…`
                        : `Indexing ${progress.done + 1} / ${progress.total}…`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {progress.phase === 'indexing' ? 'Processing with AI…' : 'Sending file…'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop files here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Multiple files supported · Max {MAX_FILE_MB} MB per file</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALL_ACCEPT}
                hidden
                onChange={onFileChange}
              />

              {/* Format pills */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Supported formats
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(FILE_TYPES).map(([key, meta]) => (
                    <div
                      key={key}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', meta.color)}
                    >
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Web tab ── */}
          {tab === 'web' && (
            <>
              {/* Source type selector */}
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(WEB_TYPES).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setWebType(key)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-medium transition-all',
                      webType === key
                        ? `border-current ${meta.color}`
                        : 'border-border text-muted-foreground hover:border-border/60 hover:bg-muted/40'
                    )}
                  >
                    <meta.icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {webMeta.inputLabel}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleWebImport()}
                      placeholder={webMeta.placeholder}
                      disabled={uploading}
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border bg-background outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40 disabled:opacity-50 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleWebImport}
                    disabled={!urlInput.trim() || uploading}
                    className={cn(
                      'px-4 rounded-xl text-sm font-medium text-white transition-all',
                      urlInput.trim() && !uploading
                        ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
                  </button>
                </div>
                {webMeta.hint && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {webMeta.hint}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Upload, X, MessageSquare, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModeToggle } from '@/components/ModeToggle'
import { cn } from '@/lib/utils'
import {
  listDocuments, uploadDocument, deleteDocument,
  streamMessage, clearSession, getChunks,
} from './api'
import type { Document, Chunk, Message } from './types'

export default function ChatApp() {
  const navigate = useNavigate()
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

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() || !selectedDoc || loading) return
    const question = input.trim()
    setInput('')
    setLoading(true)
    setError(null)

    // Add user message + empty streaming assistant message immediately
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
      // Remove empty assistant bubble on error
      setMessages(prev => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && !last.content) msgs.pop()
        return msgs
      })
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      // Ensure streaming flag is cleared even if sources event was missed
      setMessages(prev => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (last?.streaming) msgs[msgs.length - 1] = { ...last, streaming: false }
        return msgs
      })
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — always dark regardless of theme */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-zinc-900 p-4 gap-4 border-r border-zinc-800">
        <div className="flex items-center gap-1.5">
          <h1 className="font-bold tracking-wide text-white flex-1 text-base">RAG Q&A</h1>
          <ModeToggle className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800" />
          <Button
            variant="ghost" size="icon"
            onClick={logout}
            title="Log out"
            className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </Button>
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleUpload} />

        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 -mx-1">
          {documents.length === 0 && (
            <p className="text-xs text-zinc-600 text-center mt-4 px-2">No documents yet.</p>
          )}
          {documents.map(doc => (
            <div
              key={doc.doc_id}
              className={cn(
                'group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors',
                selectedDoc?.doc_id === doc.doc_id
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )}
              onClick={() => selectDocument(doc)}
            >
              <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
              <span className="truncate flex-1 text-xs">{doc.filename}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 flex-shrink-0"
                onClick={e => { e.stopPropagation(); handleDelete(doc.doc_id) }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
            <MessageSquare className="h-12 w-12 opacity-10" />
            <p className="text-sm">Select or upload a PDF to start chatting.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 px-5 py-2.5 border-b bg-card flex-shrink-0">
              <span className="font-medium text-sm flex-1 truncate">{selectedDoc.filename}</span>
              <Tabs value={tab} onValueChange={v => switchTab(v as 'chat' | 'chunks')}>
                <TabsList className="h-8">
                  <TabsTrigger value="chat" className="text-xs h-7 px-3">Chat</TabsTrigger>
                  <TabsTrigger value="chunks" className="text-xs h-7 px-3">Chunks</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === 'chat' && sessionId && (
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => selectDocument(selectedDoc)}>
                  Clear chat
                </Button>
              )}
            </header>

            {tab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed animate-fade-in',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground self-end rounded-br-sm ml-16'
                          : 'bg-card border self-start rounded-bl-sm mr-16'
                      )}
                    >
                      <p className="whitespace-pre-wrap">
                        {msg.content}
                        {msg.streaming && (
                          <span className="inline-block w-[2px] h-[0.9em] rounded-full bg-current align-text-bottom ml-[2px] animate-cursor-blink" />
                        )}
                      </p>
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer font-semibold opacity-60 hover:opacity-100 transition-opacity list-none flex items-center gap-1">
                            <span>▸</span> Sources ({msg.sources.length})
                          </summary>
                          <div className="mt-2 flex flex-col gap-2">
                            {msg.sources.map((s, j) => (
                              <div key={j} className="p-2.5 bg-muted rounded-lg border-l-2 border-primary/40">
                                <Badge variant="outline" className="text-[10px] h-4 mb-1">Page {s.page}</Badge>
                                <p className="text-muted-foreground leading-relaxed mt-1">{s.content}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                      {error}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <form className="flex gap-3 p-4 border-t bg-card flex-shrink-0" onSubmit={handleSend}>
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask a question about this document…"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !input.trim()}>Send</Button>
                </form>
              </>
            )}

            {tab === 'chunks' && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                {chunksLoading && <p className="text-sm text-muted-foreground">Loading chunks…</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
                {!chunksLoading && chunks.length > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      {chunks.length} chunks indexed
                    </p>
                    {chunks.map((chunk, i) => (
                      <div key={i} className="rounded-lg border bg-card p-4">
                        <Badge className="mb-2 text-[11px]">Page {chunk.page}</Badge>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
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
  )
}

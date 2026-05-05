import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  sendMessage,
  clearSession,
  getChunks,
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
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    setError(null)
    try {
      const res = await sendMessage(selectedDoc.doc_id, question, sessionId)
      setSessionId(res.session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer, sources: res.sources }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h1 className="logo">RAG Q&A</h1>
          <button className="btn-logout" onClick={logout} title="Log out">⏻</button>
        </div>

        <div className="upload-area">
          <button className="btn-upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleUpload} />
        </div>

        <div className="doc-list">
          {documents.length === 0 && <p className="empty">No documents yet.</p>}
          {documents.map(doc => (
            <div
              key={doc.doc_id}
              className={`doc-item ${selectedDoc?.doc_id === doc.doc_id ? 'active' : ''}`}
              onClick={() => selectDocument(doc)}
            >
              <span className="doc-name" title={doc.filename}>{doc.filename}</span>
              <button
                className="btn-delete"
                onClick={e => { e.stopPropagation(); handleDelete(doc.doc_id) }}
              >✕</button>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat">
        {!selectedDoc ? (
          <div className="placeholder">
            <p>Select or upload a PDF to start chatting.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <span className="doc-title">{selectedDoc.filename}</span>
              <div className="tabs">
                <button className={tab === 'chat' ? 'tab active' : 'tab'} onClick={() => switchTab('chat')}>Chat</button>
                <button className={tab === 'chunks' ? 'tab active' : 'tab'} onClick={() => switchTab('chunks')}>Chunks</button>
              </div>
              {tab === 'chat' && sessionId && (
                <button className="btn-clear" onClick={() => selectDocument(selectedDoc)}>Clear chat</button>
              )}
            </header>

            {tab === 'chat' && (
              <>
                <div className="messages">
                  {messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                      <p>{msg.content}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="sources">
                          <summary>Sources ({msg.sources.length})</summary>
                          {msg.sources.map((s, j) => (
                            <div key={j} className="source-chunk">
                              <strong>Page {s.page}</strong>
                              <p>{s.content}</p>
                            </div>
                          ))}
                        </details>
                      )}
                    </div>
                  ))}
                  {loading && <div className="message assistant thinking">Thinking…</div>}
                  {error && <div className="error-msg">{error}</div>}
                  <div ref={bottomRef} />
                </div>

                <form className="input-bar" onSubmit={handleSend}>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask a question about this document…"
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading || !input.trim()}>Send</button>
                </form>
              </>
            )}

            {tab === 'chunks' && (
              <div className="chunks-panel">
                {chunksLoading && <p className="empty">Loading chunks…</p>}
                {error && <div className="error-msg">{error}</div>}
                {!chunksLoading && chunks.length > 0 && (
                  <>
                    <p className="chunks-count">{chunks.length} chunks indexed</p>
                    {chunks.map((chunk, i) => (
                      <div key={i} className="chunk-card">
                        <div className="chunk-page">Page {chunk.page}</div>
                        <p className="chunk-content">{chunk.content}</p>
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
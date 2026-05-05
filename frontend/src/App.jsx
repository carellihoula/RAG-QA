import { useState, useEffect, useRef } from 'react'
import { listDocuments, uploadDocument, deleteDocument, sendMessage, clearSession } from './api'

export default function App() {
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchDocuments() {
    try {
      setDocuments(await listDocuments())
    } catch {
      setError('Could not load documents.')
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadDocument(file)
      await fetchDocuments()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      fileRef.current.value = ''
    }
  }

  async function handleDelete(docId) {
    try {
      await deleteDocument(docId)
      if (selectedDoc?.doc_id === docId) selectDocument(null)
      await fetchDocuments()
    } catch (err) {
      setError(err.message)
    }
  }

  function selectDocument(doc) {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id)
    setSelectedDoc(doc)
    setMessages([])
    setSessionId(null)
    setError(null)
  }

  async function handleSend(e) {
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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="logo">RAG Q&A</h1>

        <div className="upload-area">
          <button className="btn-upload" onClick={() => fileRef.current.click()} disabled={uploading}>
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
              <span>{selectedDoc.filename}</span>
              {sessionId && (
                <button className="btn-clear" onClick={() => selectDocument(selectedDoc)}>
                  Clear chat
                </button>
              )}
            </header>

            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <p>{msg.content}</p>
                  {msg.sources?.length > 0 && (
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
      </main>
    </div>
  )
}

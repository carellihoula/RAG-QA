const BASE = '/api/v1'

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents/`)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export async function uploadDocument(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/documents/`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function deleteDocument(docId) {
  const res = await fetch(`${BASE}/documents/${docId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function sendMessage(docId, question, sessionId) {
  const res = await fetch(`${BASE}/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id: docId, question, session_id: sessionId })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Chat request failed')
  }
  return res.json()
}

export async function clearSession(sessionId, docId) {
  await fetch(`${BASE}/chat/session/${sessionId}/${docId}`, { method: 'DELETE' })
}

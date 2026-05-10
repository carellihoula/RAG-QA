import type { Document, Chunk, Source, ChatResponse, AuthResponse, StreamEvent, KnowledgeBase } from './types'

export type { Document, Chunk, Source, ChatResponse, AuthResponse, StreamEvent, KnowledgeBase }

const BASE = '/api/v1'

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Error ${res.status}`)
  }
  if (res.status === 204) return null as unknown as T
  return res.json()
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return handleResponse<AuthResponse>(res)
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return handleResponse<AuthResponse>(res)
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents/`, { headers: authHeaders() })
  return handleResponse<Document[]>(res)
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/documents/`, {
    method: 'POST',
    headers: authHeaders(),
    body: form
  })
  return handleResponse<Document>(res)
}

export async function importFromUrl(data: {
  url: string
  source_type: 'url' | 'youtube' | 'wikipedia' | 'arxiv' | 'rss'
}): Promise<Document> {
  const res = await fetch(`${BASE}/documents/from-url`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  return handleResponse<Document>(res)
}

export async function deleteDocument(docId: string): Promise<null> {
  const res = await fetch(`${BASE}/documents/${docId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  return handleResponse<null>(res)
}

export async function getChunks(docId: string): Promise<Chunk[]> {
  const res = await fetch(`${BASE}/documents/${docId}/chunks`, { headers: authHeaders() })
  return handleResponse<Chunk[]>(res)
}

export async function sendMessage(
  docId: string,
  question: string,
  sessionId: string | null
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat/`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ doc_id: docId, question, session_id: sessionId })
  })
  return handleResponse<ChatResponse>(res)
}

export async function* streamMessage(
  docId: string,
  question: string,
  sessionId: string | null
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ doc_id: docId, question, session_id: sessionId }),
  })

  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Error ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        yield JSON.parse(data) as StreamEvent
      } catch {
        // ignore malformed frames
      }
    }
  }
}

export async function clearSession(sessionId: string, docId: string): Promise<null> {
  const res = await fetch(`${BASE}/chat/session/${sessionId}/${docId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  return handleResponse<null>(res)
}

// ── Knowledge Bases ───────────────────────────────────────────────────────────

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await fetch(`${BASE}/kb/`, { headers: authHeaders() })
  return handleResponse<KnowledgeBase[]>(res)
}

export async function createKnowledgeBase(
  data: { name: string; description?: string; system_prompt?: string; color?: string }
): Promise<KnowledgeBase> {
  const res = await fetch(`${BASE}/kb/`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  return handleResponse<KnowledgeBase>(res)
}

export async function updateKnowledgeBase(
  kbId: string,
  data: { name?: string; description?: string; system_prompt?: string; color?: string }
): Promise<KnowledgeBase> {
  const res = await fetch(`${BASE}/kb/${kbId}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  return handleResponse<KnowledgeBase>(res)
}

export async function deleteKnowledgeBase(kbId: string): Promise<null> {
  const res = await fetch(`${BASE}/kb/${kbId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function getKbDocuments(kbId: string): Promise<Document[]> {
  const res = await fetch(`${BASE}/kb/${kbId}/docs`, { headers: authHeaders() })
  return handleResponse<Document[]>(res)
}

export async function addDocToKb(kbId: string, docId: string): Promise<null> {
  const res = await fetch(`${BASE}/kb/${kbId}/docs/${docId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function removeDocFromKb(kbId: string, docId: string): Promise<null> {
  const res = await fetch(`${BASE}/kb/${kbId}/docs/${docId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function clearKbSession(kbId: string, sessionId: string): Promise<null> {
  const res = await fetch(`${BASE}/chat/kb/session/${kbId}/${sessionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function* streamKbMessage(
  kbId: string,
  question: string,
  sessionId: string | null
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE}/chat/kb/stream`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ kb_id: kbId, question, session_id: sessionId }),
  })

  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Error ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try { yield JSON.parse(data) as StreamEvent } catch { /* ignore */ }
    }
  }
}
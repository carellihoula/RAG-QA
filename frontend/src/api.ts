const BASE = '/api/v1'

export interface Document {
  doc_id: string
  filename: string
}

export interface Chunk {
  page: number
  content: string
}

export interface Source {
  page: number
  content: string
}

export interface ChatResponse {
  session_id: string
  answer: string
  sources: Source[]
}

export interface AuthResponse {
  access_token: string
}

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

export async function clearSession(sessionId: string, docId: string): Promise<null> {
  const res = await fetch(`${BASE}/chat/session/${sessionId}/${docId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  return handleResponse<null>(res)
}
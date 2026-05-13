import type {
  Document, Chunk, Source, ChatResponse, AuthResponse, StreamEvent, KnowledgeBase, UserProfile,
} from './types'

export type { Document, Chunk, Source, ChatResponse, AuthResponse, StreamEvent, KnowledgeBase, UserProfile }

const BASE = '/api/v1'

// ── Auth storage ──────────────────────────────────────────────────────────────

function getToken()   { return localStorage.getItem('token') }
function getRefresh() { return localStorage.getItem('refresh_token') }

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('token', access)
  localStorage.setItem('refresh_token', refresh)
}

function clearTokens() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user-email')
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra }
}

// ── Auto-refresh on 401 ───────────────────────────────────────────────────────

let _refreshPromise: Promise<void> | null = null

async function _doRefresh(): Promise<void> {
  const rt = getRefresh()
  if (!rt) {
    clearTokens()
    window.location.href = '/login'
    throw new Error('Session expired')
  }
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  })
  if (!res.ok) {
    clearTokens()
    window.location.href = '/login'
    throw new Error('Session expired')
  }
  const data: AuthResponse = await res.json()
  saveTokens(data.access_token, data.refresh_token)
}

/**
 * Fetch wrapper that transparently refreshes the access token on 401.
 * Multiple concurrent 401s share a single refresh call (promise deduplication).
 */
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options)
  if (res.status !== 401) return res

  // Deduplicate concurrent refresh calls
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null })
  }
  await _refreshPromise

  // Retry with new token
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getToken()}` },
  })
}

// ── Generic response handler ──────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string | Record<string, unknown> }
    const detail = err.detail
    if (typeof detail === 'object' && detail !== null) {
      const msg = (detail as Record<string, unknown>).message as string | undefined
      const e = new Error(msg ?? `Error ${res.status}`) as Error & { detail: typeof detail; status: number }
      e.detail = detail
      e.status = res.status
      throw e
    }
    throw new Error(typeof detail === 'string' ? detail : `Error ${res.status}`)
  }
  if (res.status === 204) return null as unknown as T
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await handleResponse<AuthResponse>(res)
  saveTokens(data.access_token, data.refresh_token)
  return data
}

export async function register(email: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<{ message: string }>(res)
  // No tokens saved — account must be activated first
}

export async function activateAccount(token: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/auth/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  return handleResponse<{ message: string }>(res)
}

export async function logoutApi(): Promise<void> {
  try {
    await apiFetch(`${BASE}/auth/logout`, { method: 'POST', headers: authHeaders() })
  } catch { /* best-effort */ }
  clearTokens()
}

export async function getMe(): Promise<UserProfile> {
  const res = await apiFetch(`${BASE}/auth/me`, { headers: authHeaders() })
  return handleResponse<UserProfile>(res)
}

export async function updateProfile(display_name: string | null): Promise<UserProfile> {
  const res = await apiFetch(`${BASE}/auth/me`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ display_name }),
  })
  return handleResponse<UserProfile>(res)
}

export async function changePassword(old_password: string, new_password: string): Promise<void> {
  const res = await apiFetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ old_password, new_password }),
  })
  return handleResponse<void>(res)
}

export async function forgotPassword(email: string): Promise<{ reset_token: string; email: string }> {
  const res = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

export async function resetPassword(token: string, new_password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password }),
  })
  return handleResponse(res)
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function listDocuments(): Promise<Document[]> {
  const res = await apiFetch(`${BASE}/documents/`, { headers: authHeaders() })
  return handleResponse<Document[]>(res)
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`${BASE}/documents/`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const doc = await handleResponse<Document>(res)
  window.dispatchEvent(new Event('quota:refresh'))
  return doc
}

export async function importFromUrl(data: {
  url: string
  source_type: 'url' | 'wikipedia' | 'arxiv' | 'rss'
}): Promise<Document> {
  const res = await apiFetch(`${BASE}/documents/from-url`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  const doc = await handleResponse<Document>(res)
  window.dispatchEvent(new Event('quota:refresh'))
  return doc
}

export async function deleteDocument(docId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/documents/${docId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const result = await handleResponse<null>(res)
  window.dispatchEvent(new Event('quota:refresh'))
  return result
}

export async function getChunks(docId: string): Promise<Chunk[]> {
  const res = await apiFetch(`${BASE}/documents/${docId}/chunks`, { headers: authHeaders() })
  return handleResponse<Chunk[]>(res)
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function* streamMessage(
  docId: string,
  question: string,
  sessionId: string | null
): AsyncGenerator<StreamEvent> {
  const res = await apiFetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ doc_id: docId, question, session_id: sessionId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Error ${res.status}`)
  }

  yield* _readSSE(res)
}

export async function clearSession(sessionId: string, docId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/chat/session/${sessionId}/${docId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

// ── Knowledge Bases ───────────────────────────────────────────────────────────

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await apiFetch(`${BASE}/kb/`, { headers: authHeaders() })
  return handleResponse<KnowledgeBase[]>(res)
}

export async function createKnowledgeBase(
  data: { name: string; description?: string; system_prompt?: string; color?: string }
): Promise<KnowledgeBase> {
  const res = await apiFetch(`${BASE}/kb/`, {
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
  const res = await apiFetch(`${BASE}/kb/${kbId}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  return handleResponse<KnowledgeBase>(res)
}

export async function deleteKnowledgeBase(kbId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/kb/${kbId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function getKbDocuments(kbId: string): Promise<Document[]> {
  const res = await apiFetch(`${BASE}/kb/${kbId}/docs`, { headers: authHeaders() })
  return handleResponse<Document[]>(res)
}

export async function addDocToKb(kbId: string, docId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/kb/${kbId}/docs/${docId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function removeDocFromKb(kbId: string, docId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/kb/${kbId}/docs/${docId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<null>(res)
}

export async function clearKbSession(kbId: string, sessionId: string): Promise<null> {
  const res = await apiFetch(`${BASE}/chat/kb/session/${kbId}/${sessionId}`, {
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
  const res = await apiFetch(`${BASE}/chat/kb/stream`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ kb_id: kbId, question, session_id: sessionId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Error ${res.status}`)
  }

  yield* _readSSE(res)
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillingStatus {
  plan: string
  doc_count: number
  doc_limit: number
  stripe_customer_id: string | null
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await apiFetch(`${BASE}/billing/status`, { headers: authHeaders() })
  return handleResponse<BillingStatus>(res)
}

export async function verifyCheckoutSession(sessionId: string): Promise<BillingStatus> {
  const res = await apiFetch(`${BASE}/billing/verify?session_id=${sessionId}`, { headers: authHeaders() })
  return handleResponse<BillingStatus>(res)
}

export async function createCheckoutSession(): Promise<{ url: string }> {
  const res = await apiFetch(`${BASE}/billing/checkout`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return handleResponse<{ url: string }>(res)
}

export async function createPortalSession(): Promise<{ url: string }> {
  const res = await apiFetch(`${BASE}/billing/portal`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return handleResponse<{ url: string }>(res)
}

// ── SSE reader ────────────────────────────────────────────────────────────────

async function* _readSSE(res: Response): AsyncGenerator<StreamEvent> {
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
      try { yield JSON.parse(data) as StreamEvent } catch { /* ignore malformed */ }
    }
  }
}
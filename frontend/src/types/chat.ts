export interface Source {
  page: number
  content: string
}

export interface ChatResponse {
  session_id: string
  answer: string
  sources: Source[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  streaming?: boolean
}

export interface Conversation {
  id: string
  doc_id: string | null
  kb_id: string | null
  title: string | null
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  created_at: string
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'sources'; sources: Source[]; session_id: string; conversation_id?: string }
  | { type: 'error'; message: string }
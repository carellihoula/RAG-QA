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
}
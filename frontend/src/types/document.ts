export type SourceType =
  | 'pdf' | 'xlsx' | 'csv' | 'md' | 'html'
  | 'url' | 'wikipedia'

export interface Document {
  doc_id: string
  filename: string
  title?: string
  page_count?: number
  chunk_count?: number
  indexed_at?: string
  in_library?: boolean
  source_type?: SourceType
  source_url?: string
  status?: 'processing' | 'pending_confirmation' | 'ready' | 'error'
  error?: string
}

export interface Chunk {
  page: number
  content: string
}
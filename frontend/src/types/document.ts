export interface Document {
  doc_id: string
  filename: string
  title?: string
  page_count?: number
  chunk_count?: number
  indexed_at?: string
}

export interface Chunk {
  page: number
  content: string
}
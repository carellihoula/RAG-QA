export interface Document {
  doc_id: string
  filename: string
  title?: string
}

export interface Chunk {
  page: number
  content: string
}
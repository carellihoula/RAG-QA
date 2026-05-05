export interface Document {
  doc_id: string
  filename: string
}

export interface Chunk {
  page: number
  content: string
}
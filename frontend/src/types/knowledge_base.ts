export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  system_prompt?: string
  color: string
  doc_ids: string[]
  created_at: string
}
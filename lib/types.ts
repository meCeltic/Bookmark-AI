export interface Bookmark {
  id: string
  url: string
  title?: string
  favicon?: string
  summary?: string
  tags?: string[]
  created_at: string
  user_id: string
}

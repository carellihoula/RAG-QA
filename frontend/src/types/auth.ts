export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  is_active: boolean
  created_at: string
}

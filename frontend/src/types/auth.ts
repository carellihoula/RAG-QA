export interface AuthResponse {
  /** Tokens are set as httpOnly cookies by the backend, not returned here. */
  token_type: string
}

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

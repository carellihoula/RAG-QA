import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isLoggedIn } from '@/api'

interface Props {
  children: ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}
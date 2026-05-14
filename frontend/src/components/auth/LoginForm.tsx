import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  onSwitchTab: () => void
}

export function LoginForm({ onSwitchTab }: Props) {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      localStorage.setItem('user-email', email)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleForgotPassword() {
    const params = email ? `?email=${encodeURIComponent(email)}` : ''
    navigate(`/forgot-password${params}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required autoFocus
            className="pl-9"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-password" type={showPwd ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required minLength={6}
            className="pl-9 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit" disabled={loading}
        className="w-full h-10 mt-1 font-semibold shadow-sm shadow-blue-600/20"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Please wait…</>
          : 'Log in'
        }
      </Button>

      {/* Switch to register */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-semibold text-foreground hover:text-primary transition-colors underline underline-offset-4"
        >
          Sign up free
        </button>
      </p>
    </form>
  )
}
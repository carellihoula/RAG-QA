import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModeToggle } from '@/components/ModeToggle'
import { cn } from '@/lib/utils'
import { ArrowLeft, Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Check } from 'lucide-react'

function getPwdStrength(pwd: string): number {
  if (!pwd) return 0
  let s = 0
  if (pwd.length >= 8) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return s
}

const STRENGTH_BAR  = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
const STRENGTH_TEXT = ['', 'text-red-500', 'text-orange-400', 'text-yellow-500', 'text-emerald-500']
const STRENGTH_LBL  = ['', 'Weak', 'Fair', 'Good', 'Strong']

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  const strength = getPwdStrength(password)
  const pwdMatch = confirm.length > 0 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!token) { setError('Invalid or missing reset token.'); return }
    setError(null)
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </button>
        <ModeToggle />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[390px]">

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-bold tracking-tight">RAG Q&amp;A</span>
          </button>

          {done ? (
            <div className="text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Password reset!</h1>
              <p className="text-sm text-muted-foreground">
                Your password has been updated. Redirecting to login…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight mb-1.5">Set a new password</h1>
                {email && (
                  <p className="text-sm text-muted-foreground">
                    For <span className="font-medium text-foreground">{email}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password" type={showPwd ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required minLength={6}
                      className="pl-9 pr-10" autoFocus
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300',
                            i <= strength ? STRENGTH_BAR[strength] : 'bg-muted')} />
                        ))}
                      </div>
                      <p className={cn('text-xs font-medium', STRENGTH_TEXT[strength])}>
                        {STRENGTH_LBL[strength]} password
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirm" type={showConfirm ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" required
                      className={cn('pl-9 pr-10 transition-colors',
                        confirm && !pwdMatch && 'border-red-400 focus-visible:ring-red-400',
                        confirm &&  pwdMatch && 'border-emerald-500 focus-visible:ring-emerald-500',
                      )}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm && pwdMatch && (
                    <p className="text-xs text-emerald-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-10 font-semibold mt-1">
                  {loading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</>
                    : 'Reset password'
                  }
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
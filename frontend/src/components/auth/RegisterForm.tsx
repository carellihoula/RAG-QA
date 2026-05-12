import { useState } from 'react'
import { register as registerUser } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Mail, Lock, AlertCircle, Check, Loader2, MailCheck } from 'lucide-react'

// ── Password strength ─────────────────────────────────────────────────────────

function getPwdStrength(pwd: string): number {
  if (!pwd) return 0
  let s = 0
  if (pwd.length >= 8) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return s
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_BAR   = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
const STRENGTH_TEXT  = ['', 'text-red-500', 'text-orange-400', 'text-yellow-500', 'text-emerald-500']

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onSwitchTab: () => void
}

export function RegisterForm({ onSwitchTab }: Props) {
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [registered,  setRegistered]  = useState(false)

  const strength = getPwdStrength(password)
  const pwdMatch = confirm.length > 0 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await registerUser(email, password)
      setRegistered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // ── Check-email success state ───────────────────────────────────────────────
  if (registered) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
          <MailCheck className="h-8 w-8 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight mb-1.5">Check your inbox</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent an activation link to <br />
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 border px-4 py-3 text-left space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">What's next</p>
          {[
            'Open the email from RAG Q&A',
            'Click "Activate my account"',
            'Come back here and log in',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-5 w-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Link expires in <strong>10 days</strong>. No email?{' '}
          <button
            onClick={() => setRegistered(false)}
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            Try again
          </button>
        </p>
        <button
          onClick={onSwitchTab}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors underline underline-offset-4"
        >
          Go to log in
        </button>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="reg-email" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required autoFocus
            className="pl-9"
          />
        </div>
      </div>

      {/* Password + strength meter */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="reg-password" type={showPwd ? 'text' : 'password'} value={password}
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

        {/* Strength bars */}
        {password.length > 0 && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-300',
                    i <= strength ? STRENGTH_BAR[strength] : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <p className={cn('text-xs font-medium', STRENGTH_TEXT[strength])}>
              {STRENGTH_LABEL[strength]} password
            </p>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-confirm">Confirm password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="reg-confirm" type={showConfirm ? 'text' : 'password'} value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            className={cn(
              'pl-9 pr-10 transition-colors',
              confirm && !pwdMatch && 'border-red-400 focus-visible:ring-red-400',
              confirm &&  pwdMatch && 'border-emerald-500 focus-visible:ring-emerald-500',
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && pwdMatch && (
          <p className="text-xs text-emerald-500 flex items-center gap-1">
            <Check className="h-3 w-3" /> Passwords match
          </p>
        )}
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
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account…</>
          : 'Create account'
        }
      </Button>

      {/* Switch to login */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-semibold text-foreground hover:text-primary transition-colors underline underline-offset-4"
        >
          Log in
        </button>
      </p>
    </form>
  )
}

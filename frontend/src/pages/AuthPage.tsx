import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { login, register } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { ModeToggle } from '@/components/ModeToggle'
import { cn } from '@/lib/utils'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/app', { replace: true })
  }, [navigate])

  function switchTab(t: 'login' | 'register') {
    setTab(t)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (tab === 'register' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = tab === 'login'
        ? await login(email, password)
        : await register(email, password)
      localStorage.setItem('token', res.access_token)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="pb-3">
          <button
            onClick={() => navigate('/')}
            className="text-2xl font-extrabold tracking-tight text-center w-full hover:opacity-70 transition-opacity mb-4"
          >
            RAG Q&amp;A
          </button>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  'flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                  tab === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'login' ? 'Log in' : 'Register'}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
              />
            </div>

            {tab === 'register' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <button
            onClick={() => navigate('/')}
            className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

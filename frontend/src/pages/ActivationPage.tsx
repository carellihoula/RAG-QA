import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { activateAccount } from '@/api'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function ActivationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status,  setStatus]  = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid activation link — no token found.')
      return
    }
    activateAccount(token)
      .then(data => {
        setStatus('success')
        setMessage(data.message)
        setTimeout(() => navigate('/login?activated=true'), 2500)
      })
      .catch(err => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Activation failed.')
      })
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end px-6 pt-5">
        <ModeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[390px] text-center space-y-5">

          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2 mx-auto hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-bold tracking-tight">RAG Q&amp;A</span>
          </button>

          {status === 'loading' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight mb-1.5">Activating your account…</h1>
                <p className="text-sm text-muted-foreground">Just a moment.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight mb-1.5">Account activated!</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Redirecting to login…</p>
              </div>
              <Button onClick={() => navigate('/login?activated=true')} className="w-full">
                Go to login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight mb-1.5">Activation failed</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate('/login?tab=register')} className="w-full">
                  Create a new account
                </Button>
                <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
                  Back to login
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

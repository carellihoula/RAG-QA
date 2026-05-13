import { useEffect, useState, useCallback } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { getBillingStatus, createCheckoutSession, createPortalSession } from '@/api'
import type { BillingStatus } from '@/api'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  isOpen: boolean
  /** Call after Stripe checkout to refresh status */
  refreshTrigger?: number
}

export function QuotaBar({ isOpen, refreshTrigger }: Props) {
  const [status,   setStatus]   = useState<BillingStatus | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getBillingStatus()
      setStatus(s)
    } catch { /* silent — user may not be logged in yet */ }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus, refreshTrigger])

  // Refresh when docs are added/deleted or when tab regains focus
  useEffect(() => {
    const handler = () => fetchStatus()
    window.addEventListener('quota:refresh', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('quota:refresh', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [fetchStatus])

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch { setUpgrading(false) }
  }

  async function handlePortal() {
    setUpgrading(true)
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch { setUpgrading(false) }
  }

  if (loading || !status) return null

  const { plan, doc_count, doc_limit } = status
  const isPro   = plan === 'pro'
  const pct     = Math.min((doc_count / doc_limit) * 100, 100)
  const nearMax = !isPro && pct >= 80

  // ── Collapsed: just a dot indicator ───────────────────────────────────────
  if (!isOpen) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={isPro ? handlePortal : handleUpgrade}
            className="w-full flex justify-center py-1.5"
          >
            <div className={cn(
              'h-2 w-2 rounded-full',
              isPro ? 'bg-violet-500' : nearMax ? 'bg-orange-400 animate-pulse' : 'bg-muted-foreground/40',
            )} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isPro ? 'Pro plan' : `${doc_count}/${doc_limit} docs — click to upgrade`}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── Expanded ───────────────────────────────────────────────────────────────
  return (
    <div className="px-2 pb-1">
      <div className={cn(
        'rounded-xl border px-3 py-2.5 space-y-2 transition-colors',
        nearMax
          ? 'border-orange-400/30 bg-orange-400/5'
          : 'border-sidebar-border bg-sidebar-accent/30',
      )}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-sidebar-muted-foreground uppercase tracking-widest">
              {isPro ? 'Pro' : 'Free'}
            </span>
            {isPro && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-500 uppercase tracking-wide">
                <Zap className="h-2.5 w-2.5" />Pro
              </span>
            )}
          </div>
          <span className="text-[10px] text-sidebar-muted-foreground">
            {doc_count}<span className="text-sidebar-muted-foreground/50">/{doc_limit}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-sidebar-border overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isPro ? 'bg-violet-500' : nearMax ? 'bg-orange-400' : 'bg-blue-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Upgrade / Manage button */}
        {isPro ? (
          <button
            onClick={handlePortal}
            disabled={upgrading}
            className="w-full text-[11px] font-medium text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors text-left"
          >
            {upgrading ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
            Manage subscription →
          </button>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors',
              nearMax
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-primary/10 hover:bg-primary/20 text-primary',
            )}
          >
            {upgrading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Zap className="h-3 w-3" />
            }
            {nearMax ? 'Almost full — Upgrade' : 'Upgrade to Pro'}
          </button>
        )}
      </div>
    </div>
  )
}

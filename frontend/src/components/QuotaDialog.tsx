import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Zap } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  limit: number
  onUpgrade: () => void
}

export function QuotaDialog({ open, onOpenChange, limit, onUpgrade }: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
              <Zap className="h-8 w-8 text-amber-500 fill-amber-500/20" />
            </div>
          </div>

          <div className="text-center mb-5">
            <AlertDialog.Title className="text-base font-semibold mb-2">
              Document limit reached
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground leading-relaxed">
              Your <span className="font-medium text-foreground">Free</span> plan is limited to{' '}
              <span className="font-medium text-foreground">{limit} documents</span>. Upgrade to{' '}
              <span className="font-medium text-foreground">Pro</span> to import up to 100 documents.
            </AlertDialog.Description>
          </div>

          {/* Plan comparison */}
          <div className="flex items-stretch gap-2 mb-5">
            <div className="flex-1 rounded-xl border bg-muted/40 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Free</p>
              <p className="text-2xl font-bold tabular-nums">{limit}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">documents</p>
            </div>
            <div className="flex items-center px-1 text-muted-foreground/30 text-lg font-bold select-none">→</div>
            <div className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-1.5">Pro</p>
              <p className="text-2xl font-bold tabular-nums text-blue-500">100</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">documents</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <AlertDialog.Action
              onClick={onUpgrade}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 active:scale-95 transition-all cursor-pointer text-center"
            >
              Upgrade to Pro →
            </AlertDialog.Action>
            <AlertDialog.Cancel className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors cursor-pointer text-center">
              Later
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

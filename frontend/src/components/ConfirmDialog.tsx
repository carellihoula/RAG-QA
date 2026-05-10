import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          <div className="flex items-start gap-4">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
              variant === 'danger' ? 'bg-red-500/10' : 'bg-blue-500/10'
            )}>
              {variant === 'danger'
                ? <AlertTriangle className="h-5 w-5 text-red-500" />
                : <Info className="h-5 w-5 text-blue-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialog.Title className="text-sm font-semibold leading-tight">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {description}
              </AlertDialog.Description>
            </div>
          </div>

          <div className="mt-6 flex gap-2 justify-end">
            <AlertDialog.Cancel className="px-4 py-2 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors cursor-pointer">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors cursor-pointer',
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 active:scale-95'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              )}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
import { useState } from 'react'
import { Sparkles, ChevronRight, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageBubbleProps {
  msg: Message
  docTitle?: string
}

// ── Action button ──────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, onClick, active,
}: {
  icon: React.ElementType
  label?: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
        active
          ? 'text-blue-500 bg-blue-500/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-3 w-3" />
      {label && <span>{label}</span>}
    </button>
  )
}

// ── Source cards ───────────────────────────────────────────────────────────────

function SourceCards({ sources, docTitle }: { sources: NonNullable<Message['sources']>; docTitle?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        <span className="font-medium">
          {sources.length} source{sources.length > 1 ? 's' : ''}
        </span>
        {/* numbered pips */}
        <div className="flex -space-x-1">
          {sources.slice(0, 3).map((_, i) => (
            <span
              key={i}
              className="h-4 w-4 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] font-bold text-muted-foreground"
            >
              {i + 1}
            </span>
          ))}
        </div>
        {docTitle && (
          <span className="truncate max-w-[160px] text-muted-foreground/60">{docTitle}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {sources.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border bg-muted/30 overflow-hidden"
            >
              {/* card header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
                <span className="h-5 w-5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-500 flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-medium truncate flex-1">
                  {docTitle ?? 'Source'}
                </span>
                <Badge variant="outline" className="text-[10px] h-4 font-mono flex-shrink-0">
                  p. {s.page}
                </Badge>
              </div>
              {/* chunk content */}
              <p className="px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-4">
                {s.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Thinking bubble ────────────────────────────────────────────────────────────

export function ThinkingBubble() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
        <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
      </div>
      <div className="bg-card border border-border/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MessageBubble({ msg, docTitle }: MessageBubbleProps) {
  const [copied, setCopied]     = useState(false)
  const [liked, setLiked]       = useState(false)
  const [disliked, setDisliked] = useState(false)

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg.content)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = msg.content
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard write failed — leave the button in its normal state
    }
  }

  // ── User message ─────────────────────────────────────────────────────────────
  if (msg.role === 'user') {
    return (
      <div className="flex gap-3 flex-row-reverse animate-fade-in">
        <div className="h-8 w-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
          <span className="text-[10px] font-bold text-zinc-200 leading-none">You</span>
        </div>
        <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm bg-blue-600 text-white">
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
      </div>
    )
  }

  // ── Assistant message ─────────────────────────────────────────────────────────
  return (
    <div className="flex gap-3 flex-row animate-fade-in">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="max-w-[78%] flex flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm bg-card border border-border/80">
          <p className="whitespace-pre-wrap break-words">
            {msg.content}
            {msg.streaming && (
              <span className="inline-block w-[2px] h-[0.85em] rounded-full bg-current align-text-bottom ml-[2px] animate-cursor-blink" />
            )}
          </p>

          {msg.sources && msg.sources.length > 0 && !msg.streaming && (
            <SourceCards sources={msg.sources} docTitle={docTitle} />
          )}
        </div>

        {/* Action toolbar — only when not streaming */}
        {!msg.streaming && (
          <div className="flex items-center gap-0.5 px-1">
            <ActionBtn
              icon={copied ? Check : Copy}
              label={copied ? 'Copied' : 'Copy'}
              onClick={handleCopy}
              active={copied}
            />
            <div className="ml-auto flex items-center gap-0.5">
              <ActionBtn
                icon={ThumbsUp}
                onClick={() => { setLiked(!liked); setDisliked(false) }}
                active={liked}
              />
              <ActionBtn
                icon={ThumbsDown}
                onClick={() => { setDisliked(!disliked); setLiked(false) }}
                active={disliked}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

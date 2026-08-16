import { useState, useRef } from 'react'
import { Sparkles, ChevronRight, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'
import 'highlight.js/styles/github-dark.css'

// ── Clipboard ──────────────────────────────────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    return true
  } catch {
    return false
  }
}

// ── Code block (with its own copy button) ───────────────────────────────────────

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  async function handleCopyCode() {
    const text = preRef.current?.textContent ?? ''
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="relative mb-2 last:mb-0">
      <pre ref={preRef}>
        {children}
      </pre>
      <button
        onClick={handleCopyCode}
        title={copied ? 'Copied' : 'Copy code'}
        className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

// Shown instead of the code block while its closing ``` fence hasn't arrived
// yet — avoids re-highlighting a still-changing block on every token (the
// actual cause of the flicker), and matches how ChatGPT renders code blocks.
// `!flex` is required: the message bubble wraps markdown output in a
// `[&>*:last-child]:inline` container (keeps the streaming cursor on the same
// line as the last bit of text) — while this placeholder is the last child,
// that rule would flip it to `display: inline` and break the layout.
function CodeGenerating() {
  const widths = ['w-4/5', 'w-3/5', 'w-11/12', 'w-2/5']
  return (
    <div className="mb-2 last:mb-0 !flex flex-col gap-2 rounded-lg bg-zinc-900 px-3 py-3">
      {widths.map((w, i) => (
        <div
          key={i}
          className={cn(
            'h-2.5 rounded-full bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800 bg-[length:200%_100%] animate-shimmer',
            w,
          )}
        />
      ))}
    </div>
  )
}

// ── Markdown rendering ────────────────────────────────────────────────────────
// Compact overrides so LLM markdown output fits the small chat-bubble type scale
// instead of the browser's default (large) prose spacing.

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline underline-offset-2 hover:text-blue-400">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h1 className="mb-1.5 mt-3 first:mt-0 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 first:mt-0 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 last:mb-0 border-l-2 border-border pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/60" />,
  table: ({ children }) => (
    <div className="mb-2 last:mb-0 overflow-x-auto">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '')
    if (isBlock) {
      return <code className={cn(className, 'text-xs rounded-lg')} {...props}>{children}</code>
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono" {...props}>
        {children}
      </code>
    )
  },
}

function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
  // While streaming, the *last* fenced code block may still be growing (its
  // closing ``` hasn't arrived) — highlight.js would re-tokenize it on every
  // token, causing flicker. Detect that trailing open block and render a
  // spinner in its place instead, same as ChatGPT: finished blocks (and all
  // plain text) still render/stream normally, only the in-progress block waits.
  const fenceCount = (content.match(/^\s*```/gm) ?? []).length
  const hasOpenFence = !!streaming && fenceCount % 2 === 1
  const totalCodeBlocks = Math.ceil(fenceCount / 2)
  let codeBlockIndex = 0

  const components: Components = {
    ...MARKDOWN_COMPONENTS,
    pre: ({ children }) => {
      codeBlockIndex += 1
      if (hasOpenFence && codeBlockIndex === totalCodeBlocks) return <CodeGenerating />
      return <CodeBlock>{children}</CodeBlock>
    },
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}

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

      <div className="max-w-[85%] flex flex-col gap-1">
        <div className="text-sm leading-relaxed pt-1">
          <div className="contents [&>*:last-child]:inline">
            <MarkdownContent content={msg.content} streaming={msg.streaming} />
          </div>
          {msg.streaming && (
            <span className="inline-block w-[2px] h-[0.85em] rounded-full bg-foreground align-text-bottom ml-[2px] animate-cursor-blink" />
          )}

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

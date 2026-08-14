import { useRef, useEffect, useState } from 'react'
import { MessageSquare, Library, Loader2, ArrowUp, Zap, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/context/ChatContext'
import { MessageBubble } from './MessageBubble'

const SUGGESTIONS = [
  'Summarize this document',
  'What are the key points?',
  'List the main topics covered',
  'Explain the most important concept',
]

export function ChatPanel() {
  const {
    messages,
    input,
    setInput,
    loading,
    historyLoading,
    selectedDoc,
    selectedKb,
    submitMessage,
    handleSubmit,
  } = useChatContext()

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const [showSuggest, setShowSuggest] = useState(true)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Hide suggestions once user sends first message
  useEffect(() => {
    if (messages.length > 0) setShowSuggest(false)
  }, [messages.length])

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  function pickSuggestion(s: string) {
    setInput(s)
    setShowSuggest(false)
    textareaRef.current?.focus()
  }

  // doc title to pass to source cards
  const docTitle = selectedKb?.name ?? selectedDoc?.title ?? selectedDoc?.filename

  return (
    <>
      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 flex flex-col gap-5 scrollbar-thin">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
            {historyLoading ? (
              <Loader2 className="h-6 w-6 text-muted-foreground/30 animate-spin" />
            ) : selectedKb ? (
              <Library className="h-8 w-8 text-muted-foreground/20" />
            ) : (
              <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
            )}
            {!historyLoading && (
              <p className="text-sm text-muted-foreground">
                {selectedKb ? (
                  <>
                    Ask anything across{' '}
                    <span className="font-medium text-foreground/70">{selectedKb.name}</span>
                    {' '}— {selectedKb.doc_ids.length} documents indexed
                  </>
                ) : (
                  <>
                    Ask your first question about{' '}
                    <span className="font-medium text-foreground/70">
                      {selectedDoc!.title ?? selectedDoc!.filename}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} docTitle={docTitle} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t bg-card/40">

        {/* Suggestion chips */}
        {showSuggest && messages.length === 0 && !historyLoading && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest flex-shrink-0">
              <Sparkles className="h-3 w-3" /> Try
            </span>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => pickSuggestion(s)}
                className="px-3 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setShowSuggest(false)}
              className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form
          className="px-3 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
            handleSubmit(e)
          }}
        >
          <div
            className={cn(
              'flex items-end gap-2 bg-background border rounded-2xl px-4 py-2.5 transition-all duration-200 shadow-sm',
              'focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-500/40 focus-within:shadow-md',
            )}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize() }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedKb
                  ? `Ask across ${selectedKb.name}…`
                  : 'Ask a question…'
              }
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32 leading-relaxed py-0.5 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200',
                input.trim() && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-90'
                  : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ArrowUp className="h-3.5 w-3.5" />
              }
            </button>
          </div>

          {/* Model + mode chips */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40">
              <Zap className="h-2.5 w-2.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground font-medium">GPT-4o-mini</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Hybrid · BM25 + semantic</span>
            </div>
            <span className="text-[10px] text-muted-foreground/30 hidden sm:block">
              <kbd className="font-mono">⇧↵</kbd> newline
            </span>
          </div>
        </form>
      </div>
    </>
  )
}
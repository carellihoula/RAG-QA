import { useRef, useEffect } from "react";
import { MessageSquare, Library, Loader2, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { MessageBubble } from "./MessageBubble";

export function ChatPanel() {
  const {
    messages,
    input,
    setInput,
    loading,
    selectedDoc,
    selectedKb,
    submitMessage,
    handleSubmit,
  } = useChatContext();

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
            {selectedKb ? (
              <Library className="h-8 w-8 text-muted-foreground/20" />
            ) : (
              <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
            )}
            <p className="text-sm text-muted-foreground">
              {selectedKb ? (
                <>
                  Ask anything across{" "}
                  <span className="font-medium text-foreground/70">
                    {selectedKb.name}
                  </span>{" "}
                  — {selectedKb.doc_ids.length} documents indexed
                </>
              ) : (
                <>
                  Ask your first question about{" "}
                  <span className="font-medium text-foreground/70">
                    {selectedDoc!.title ?? selectedDoc!.filename}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex-shrink-0 px-5 pb-5 pt-3 border-t bg-card/40"
        onSubmit={(e) => {
          e.preventDefault();
          if (textareaRef.current) textareaRef.current.style.height = "auto";
          handleSubmit(e);
        }}
      >
        <div
          className={cn(
            "flex items-end gap-2 bg-background border rounded-2xl px-4 py-2.5 transition-all duration-200 shadow-sm",
            "focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-500/40 focus-within:shadow-md",
          )}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedKb
                ? `Ask across ${selectedKb.name}… (Enter ↵ to send)`
                : "Ask a question… (Enter ↵ to send)"
            }
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32 leading-relaxed py-0.5 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200",
              input.trim() && !loading
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-90"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed",
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/30 mt-2 tracking-wide">
          {selectedKb
            ? `GPT-4o-mini · ${selectedKb.doc_ids.length} documents · Hybrid search`
            : "GPT-4o-mini · Hybrid search (BM25 + semantic) · Shift+Enter for newline"}
        </p>
      </form>
    </>
  );
}
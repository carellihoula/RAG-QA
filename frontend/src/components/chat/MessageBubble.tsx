import { Sparkles, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  msg: Message;
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        msg.role === "user" ? "flex-row-reverse" : "flex-row",
      )}
    >
      {msg.role === "assistant" ? (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      ) : (
        <div className="h-8 w-8 rounded-full bg-zinc-700 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
          <span className="text-[10px] font-bold text-zinc-200 leading-none">
            You
          </span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          msg.role === "user"
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-card border border-border/80 rounded-tl-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          {msg.content}
          {msg.streaming && (
            <span className="inline-block w-[2px] h-[0.85em] rounded-full bg-current align-text-bottom ml-[2px] animate-cursor-blink" />
          )}
        </p>
        {msg.sources && msg.sources.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs font-medium select-none opacity-50 hover:opacity-90 transition-opacity">
              <ChevronRight className="h-3 w-3 details-chevron transition-transform" />
              {msg.sources.length} source
              {msg.sources.length > 1 ? "s" : ""} referenced
            </summary>
            <div className="mt-2.5 flex flex-col gap-2">
              {msg.sources.map((s, j) => (
                <div
                  key={j}
                  className="rounded-xl bg-black/5 dark:bg-white/5 border border-border/40 p-3"
                >
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 mb-2 font-mono tracking-tight"
                  >
                    Page {s.page}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {s.content}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
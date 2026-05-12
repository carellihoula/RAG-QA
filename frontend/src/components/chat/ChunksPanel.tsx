import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useChatContext } from "@/context/ChatContext";

export function ChunksPanel() {
  const { chunks, chunksLoading } = useChatContext();

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3 scrollbar-thin">
      {chunksLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading chunks…
        </div>
      )}
      {!chunksLoading && chunks.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            {chunks.length} chunks indexed
          </p>
          {chunks.map((chunk, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px] font-mono h-5">
                  Page {chunk.page}
                </Badge>
                <span className="text-[10px] text-muted-foreground/40">
                  #{i + 1}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {chunk.content}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
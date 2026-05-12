import { Sparkles } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { MAX_DOCS, MAX_KBS } from "@/components/chat/constants";
import { KbSection } from "./KbSection";
import { DocSection } from "./DocSection";

export function ChatSidebar() {
  const {
    documents,
    knowledgeBases,
    docUsagePct,
    kbUsagePct,
  } = useChatContext();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">
      {/* ── Knowledge Bases section ── */}
      <KbSection />

      <div className="mx-3 my-1.5 border-t border-sidebar-border flex-shrink-0" />

      {/* ── Documents section ── */}
      <DocSection />

      {/* Plan badge */}
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted-foreground">
            <Sparkles className="h-3 w-3 text-blue-400" />
            Free plan
          </span>
          <span className="text-[10px] text-sidebar-muted-foreground/50">
            {knowledgeBases.length}/{MAX_KBS} KB · {documents.length}/{MAX_DOCS}{" "}
            docs
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="h-0.5 rounded-full bg-sidebar-accent overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{ width: `${docUsagePct}%` }}
            />
          </div>
          <div className="h-0.5 rounded-full bg-sidebar-accent overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500"
              style={{ width: `${kbUsagePct}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
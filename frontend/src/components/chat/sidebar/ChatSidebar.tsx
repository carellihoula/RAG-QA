import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { MAX_KBS } from "@/components/chat/constants";
import { KbSection } from "./KbSection";
import { DocSection } from "./DocSection";
import { cn } from "@/lib/utils";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function SidebarContent() {
  const { documents, knowledgeBases, billing, docUsagePct, kbUsagePct } = useChatContext();
  const docLimit  = billing?.doc_limit ?? 5;
  const planLabel = billing?.plan === "pro" ? "Pro plan" : "Free plan";

  return (
    <>
      <KbSection />
      <div className="mx-3 my-1.5 border-t border-sidebar-border flex-shrink-0" />
      <DocSection />
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted-foreground">
            <Sparkles className="h-3 w-3 text-blue-400" />
            {planLabel}
          </span>
          <span className="text-[10px] text-sidebar-muted-foreground/50">
            {knowledgeBases.length}/{MAX_KBS} KB · {documents.length}/{docLimit} docs
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
    </>
  );
}

export function ChatSidebar() {
  const { chatSidebarOpen, setChatSidebarOpen } = useChatContext();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {chatSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setChatSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar border-r border-sidebar-border shadow-xl overflow-hidden",
            "transition-transform duration-250 ease-in-out",
            chatSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-1 flex-shrink-0">
            <span className="text-xs font-semibold text-sidebar-muted-foreground uppercase tracking-wider">Sources</span>
            <button
              onClick={() => setChatSidebarOpen(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SidebarContent />
        </aside>
      </>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">
      <SidebarContent />
    </aside>
  );
}
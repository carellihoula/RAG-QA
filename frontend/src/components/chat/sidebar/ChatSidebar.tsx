import { Sparkles, X, Library, HelpCircle } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { KbSection } from "./KbSection";
import { DocSection } from "./DocSection";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

function SidebarContent() {
  const { documents, knowledgeBases, billing, docUsagePct } = useChatContext();
  const docLimit  = billing?.doc_limit ?? 10;
  const docCount  = billing?.doc_count ?? 0;
  const isPro     = billing?.plan === "pro";
  const isAdmin   = billing?.plan === "admin";
  const planLabel = isPro ? "Pro" : isAdmin ? "Admin" : "Free";
  const docsDisplay = isPro || isAdmin
    ? "Unlimited"
    : `${docCount}/${docLimit} uploads (24h)`;

  return (
    <>
      {/* Desktop-only header */}
      <div className="hidden md:flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0 border-b border-sidebar-border">
        <Library className="h-3.5 w-3.5 text-sidebar-muted-foreground/60 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground flex-1">
          Sources
        </span>
        <span className="text-[10px] text-sidebar-muted-foreground/40">
          {knowledgeBases.length} KB · {documents.length} docs
        </span>
        <button
          onClick={() => window.dispatchEvent(new Event('onboarding:start'))}
          title="Take a tour"
          className="h-6 w-6 rounded-md flex items-center justify-center text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <KbSection />
      <div className="mx-3 my-1.5 border-t border-sidebar-border flex-shrink-0" />
      <DocSection />

      {/* Quota footer — upload rate limit, unified across library + KBs, not tied to KB count */}
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted-foreground">
            <Sparkles className="h-3 w-3 text-blue-400" />
            {planLabel} plan
          </span>
          <span className="text-[10px] text-sidebar-muted-foreground/50">
            {docsDisplay}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-sidebar-accent overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{ width: isPro || isAdmin ? "100%" : `${docUsagePct}%` }}
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
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => window.dispatchEvent(new Event('onboarding:start'))}
                title="Take a tour"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button
                onClick={() => setChatSidebarOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
import { FileText, Library, RotateCcw, PanelLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { KB_COLORS } from "@/components/chat/constants";

export function ChatHeader() {
  const {
    selectedDoc,
    selectedKb,
    tab,
    sessionId,
    switchTab,
    clearConversation,
    chatSidebarOpen,
    setChatSidebarOpen,
  } = useChatContext();

  return (
    <header className="flex items-center gap-2 pl-14 pr-3 md:px-5 py-2.5 border-b bg-card/80 backdrop-blur-sm flex-shrink-0">
      {/* Mobile: toggle the doc/KB sidebar */}
      <button
        onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
        className="md:hidden h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        title="Toggle sources"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {selectedKb ? (
          <>
            <div
              className={cn(
                "h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0",
                KB_COLORS[selectedKb.color]?.bg ?? "bg-violet-500/10",
              )}
            >
              <Library
                className={cn(
                  "h-3 w-3",
                  KB_COLORS[selectedKb.color]?.text ?? "text-violet-500",
                )}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm truncate leading-tight">
                {selectedKb.name}
              </span>
              <span className="text-[10px] text-muted-foreground/50 leading-tight hidden sm:block">
                {selectedKb.doc_ids.length} document
                {selectedKb.doc_ids.length !== 1 ? "s" : ""} · Knowledge Base
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-3 w-3 text-blue-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm truncate leading-tight">
                {selectedDoc!.title ?? selectedDoc!.filename}
              </span>
              {selectedDoc!.title && (
                <span className="text-[10px] text-muted-foreground/50 truncate leading-tight hidden sm:block">
                  {selectedDoc!.filename}
                </span>
              )}
            </div>
            {(selectedDoc!.page_count != null || selectedDoc!.chunk_count != null) && (
              <div className="hidden sm:flex items-center gap-1 ml-1 flex-shrink-0">
                {selectedDoc!.page_count != null && (
                  <Badge variant="outline" className="text-[10px] h-4 font-mono">
                    {selectedDoc!.page_count}p
                  </Badge>
                )}
                {selectedDoc!.chunk_count != null && (
                  <Badge variant="outline" className="text-[10px] h-4 font-mono">
                    {selectedDoc!.chunk_count} chunks
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedDoc && (
        <Tabs
          value={tab}
          onValueChange={(v) => switchTab(v as "chat" | "chunks")}
        >
          <TabsList className="h-7">
            <TabsTrigger value="chat" className="text-xs h-6 px-2 sm:px-3">
              Chat
            </TabsTrigger>
            <TabsTrigger value="chunks" className="text-xs h-6 px-2 sm:px-3">
              Chunks
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {tab === "chat" && sessionId && (
        <button
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          title="Clear conversation"
          onClick={clearConversation}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </header>
  );
}
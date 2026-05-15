import { Upload, Sparkles, Loader2, Library, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { KB_COLORS } from "@/components/chat/constants";

export function WelcomeScreen() {
  const { uploading, knowledgeBases, selectKb, setShowAddSource } =
    useChatContext();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 sm:px-8 select-none">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-violet-600/10 border border-blue-500/20 flex items-center justify-center shadow-xl shadow-blue-500/5">
          <Sparkles className="h-8 w-8 text-blue-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Ask your documents
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Select a <strong>Knowledge Base</strong> or a document from the{" "}
          <span className="md:hidden">sidebar menu</span>
          <span className="hidden md:inline">sidebar</span>.
        </p>
      </div>

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/10 border border-blue-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Uploading your document…</p>
            <p className="text-xs text-muted-foreground">
              AI is extracting &amp; indexing the content
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {knowledgeBases.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-muted transition-all text-sm font-medium">
                  <Library className="h-4 w-4 text-violet-500" />
                  Open a KB
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {knowledgeBases.map((kb) => {
                  const c = KB_COLORS[kb.color] ?? KB_COLORS.blue;
                  return (
                    <DropdownMenuItem
                      key={kb.id}
                      onClick={() => selectKb(kb)}
                      className="flex items-center gap-2"
                    >
                      <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                      {kb.name}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {kb.doc_ids.length} docs
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={() => setShowAddSource(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
          >
            <Upload className="h-4 w-4" />
            Add a source
          </button>
        </div>
      )}

      {!uploading && (
        <p className="text-[11px] text-muted-foreground/50">
          drag &amp; drop anywhere · or select from the sidebar
        </p>
      )}
    </div>
  );
}

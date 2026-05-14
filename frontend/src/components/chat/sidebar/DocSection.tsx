import { FileText, Globe, BookOpen, Atom, Rss, Table, FileCode, Plus, Library, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { KB_COLORS } from "@/components/chat/constants";

const SOURCE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf:       { icon: FileText,  color: "text-red-400" },
  docx:      { icon: FileText,  color: "text-blue-400" },
  pptx:      { icon: FileText,  color: "text-orange-400" },
  xlsx:      { icon: Table,     color: "text-green-400" },
  csv:       { icon: Table,     color: "text-emerald-400" },
  txt:       { icon: FileCode,  color: "text-slate-400" },
  md:        { icon: FileCode,  color: "text-slate-400" },
  html:      { icon: Globe,     color: "text-violet-400" },
  url:       { icon: Globe,     color: "text-blue-400" },
  wikipedia: { icon: BookOpen,  color: "text-slate-400" },
  arxiv:     { icon: Atom,      color: "text-violet-400" },
  rss:       { icon: Rss,       color: "text-amber-400" },
};

export function DocSection() {
  const {
    documents,
    knowledgeBases,
    selectedDoc,
    selectDocument,
    setShowAddSource,
    confirmDeleteDoc,
    handleToggleDocInKb,
  } = useChatContext();

  return (
    <>
      {/* ── Documents section ── */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
            Documents
            {documents.length > 0 && (
              <span className="ml-1.5 bg-sidebar-accent rounded-full px-1.5 py-px text-[10px]">
                {documents.length}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddSource(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-sidebar-border py-2 text-xs font-medium text-sidebar-muted-foreground transition-all duration-200 hover:border-blue-500/50 hover:text-blue-500 hover:bg-blue-500/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add source
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5 scrollbar-thin">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <FileText className="h-7 w-7 text-sidebar-muted-foreground/30" />
            <p className="text-xs text-sidebar-muted-foreground leading-relaxed">
              No documents yet.
              <br />
              Upload a PDF to start.
            </p>
          </div>
        ) : (
          documents.map((doc) => {
            const docKbs = knowledgeBases.filter((kb) =>
              kb.doc_ids.includes(doc.doc_id),
            );
            const isActive = selectedDoc?.doc_id === doc.doc_id;
            return (
              <button
                key={doc.doc_id}
                className={cn(
                  "group w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                    : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onClick={() => selectDocument(isActive ? null : doc)}
              >
                {(() => {
                  const sm =
                    SOURCE_ICONS[doc.source_type ?? "pdf"] ?? SOURCE_ICONS.pdf;
                  return (
                    <sm.icon
                      className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 transition-colors mt-0.5",
                        isActive ? "text-primary" : sm.color,
                      )}
                    />
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {doc.title ?? doc.filename}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {(doc.page_count != null || doc.chunk_count != null) && (
                      <span className="text-[10px] text-sidebar-muted-foreground/50">
                        {doc.page_count != null ? `${doc.page_count}p` : ""}
                        {doc.page_count != null && doc.chunk_count != null
                          ? " · "
                          : ""}
                        {doc.chunk_count != null
                          ? `${doc.chunk_count} chunks`
                          : ""}
                      </span>
                    )}
                    {docKbs.map((kb) => {
                      const c = KB_COLORS[kb.color] ?? KB_COLORS.blue;
                      return (
                        <span
                          key={kb.id}
                          className={cn(
                            "text-[9px] px-1 rounded font-medium",
                            c.bg,
                            c.text,
                          )}
                        >
                          {kb.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Actions: add to KB + delete */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 mt-0.5 transition-all">
                  {knowledgeBases.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span
                          role="button"
                          aria-label="Add to Knowledge Base"
                          className="p-0.5 rounded text-sidebar-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Library className="h-3 w-3" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="right"
                        align="start"
                        className="w-44"
                      >
                        {knowledgeBases.map((kb) => {
                          const inKb = kb.doc_ids.includes(doc.doc_id);
                          const c = KB_COLORS[kb.color] ?? KB_COLORS.blue;
                          return (
                            <DropdownMenuItem
                              key={kb.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDocInKb(kb.id, doc.doc_id, inKb);
                              }}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full flex-shrink-0",
                                  c.dot,
                                )}
                              />
                              <span className="flex-1 truncate">{kb.name}</span>
                              {inKb && (
                                <span className="text-blue-500 text-[10px]">
                                  ✓
                                </span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <span
                    role="button"
                    aria-label="Delete"
                    className="p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteDoc(doc);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
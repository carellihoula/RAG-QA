import {
  Library,
  Plus,
  ChevronDown,
  Trash2,
  Pencil,
  FileText,
  Minus,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { KB_COLORS, MAX_KBS } from "@/components/chat/constants";

export function KbSection() {
  const {
    knowledgeBases,
    selectedKb,
    selectedDoc,
    selectKb,
    selectDocument,
    isCreatingKb,
    setIsCreatingKb,
    newKbName,
    setNewKbName,
    newKbColor,
    setNewKbColor,
    handleCreateKb,
    confirmDeleteKb,
    confirmRemoveFromKb,
    toggleKbExpand,
    startRename,
    expandedKbs,
    renamingKbId,
    setRenamingKbId,
    renameValue,
    setRenameValue,
    confirmRename,
    kbDocs,
    kbInputRef,
    renameInputRef,
    setAddSourceKbId,
    setShowAddSource,
  } = useChatContext();

  return (
    <div className="px-3 pt-4 pb-1 flex-shrink-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
          Knowledge Bases
          {knowledgeBases.length > 0 && (
            <span className="ml-1.5 bg-sidebar-accent rounded-full px-1.5 py-px text-[10px]">
              {knowledgeBases.length}
            </span>
          )}
        </p>
        {knowledgeBases.length < MAX_KBS && (
          <button
            onClick={() => setIsCreatingKb((v) => !v)}
            className="h-5 w-5 rounded-md flex items-center justify-center text-sidebar-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
            title="New Knowledge Base"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Create KB form */}
      {isCreatingKb && (
        <div className="mb-2 p-2.5 rounded-xl border bg-card flex flex-col gap-2 shadow-sm">
          <input
            ref={kbInputRef}
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateKb();
              if (e.key === "Escape") setIsCreatingKb(false);
            }}
            placeholder="Knowledge Base name…"
            className="text-xs bg-transparent outline-none border-b border-border pb-1 w-full"
          />
          <div className="flex items-center gap-1">
            {Object.entries(KB_COLORS).map(([color, cls]) => (
              <button
                key={color}
                onClick={() => setNewKbColor(color)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2 transition-all",
                  cls.dot,
                  newKbColor === color
                    ? "border-foreground scale-125"
                    : "border-transparent opacity-60",
                )}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleCreateKb}
              disabled={!newKbName.trim()}
              className="flex-1 text-[10px] py-1 rounded-md bg-blue-600 text-white font-medium disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingKb(false);
                setNewKbName("");
              }}
              className="flex-1 text-[10px] py-1 rounded-md bg-muted text-muted-foreground font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KB list */}
      <div className="flex flex-col gap-0.5">
        {knowledgeBases.length === 0 && !isCreatingKb && (
          <p className="text-[10px] text-sidebar-muted-foreground/50 px-1 py-1.5 leading-relaxed">
            Group documents by topic or team.
          </p>
        )}
        {knowledgeBases.map((kb) => {
          const colors = KB_COLORS[kb.color] ?? KB_COLORS.blue;
          const isActive = selectedKb?.id === kb.id;
          const isExpanded = expandedKbs.includes(kb.id);
          return (
            <div key={kb.id}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "group flex items-center gap-1 px-1 py-1 rounded-lg transition-all duration-150 cursor-pointer",
                      isActive
                        ? `${colors.bg} ${colors.text} ring-1 ring-inset ring-current/20`
                        : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {/* Expand toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleKbExpand(kb.id);
                      }}
                      className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform duration-200",
                          !isExpanded && "-rotate-90",
                        )}
                      />
                    </button>

                    {/* KB row — click to select for chat */}
                    <button
                      onClick={() => selectKb(isActive ? null : kb)}
                      className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                    >
                      <Library className="h-3.5 w-3.5 flex-shrink-0" />
                      {renamingKbId === kb.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              confirmRename(kb.id);
                            }
                            if (e.key === "Escape") setRenamingKbId(null);
                          }}
                          onBlur={() => confirmRename(kb.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none border-b border-current"
                        />
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="block truncate text-xs font-medium">
                            {kb.name}
                          </span>
                          <span className="text-[10px] opacity-60">
                            {kb.doc_ids.length} doc
                            {kb.doc_ids.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Delete on hover */}
                    <button
                      aria-label="Delete knowledge base"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteKb(kb);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuLabel className="truncate">
                    {kb.name}
                  </ContextMenuLabel>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      setAddSourceKbId(kb.id);
                      setShowAddSource(true);
                    }}
                    className="text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add source
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => startRename(kb)}
                    className="text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => confirmDeleteKb(kb)}
                    className="text-xs text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {/* Expanded — list KB's PDFs */}
              {isExpanded && (
                <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                  {(kbDocs[kb.id] ?? []).length === 0 ? (
                    <p className="text-[10px] text-sidebar-muted-foreground/40 py-1 italic">
                      No documents yet
                    </p>
                  ) : (
                    (kbDocs[kb.id] ?? []).map((doc) => {
                      const isDocActive = selectedDoc?.doc_id === doc.doc_id;
                      const isKbOnly = doc.in_library === false;
                      return (
                        <div
                          key={doc.doc_id}
                          className={cn(
                            "group flex items-center gap-1 px-1.5 py-1 rounded-md transition-all duration-150",
                            isDocActive
                              ? "bg-primary/10 text-primary"
                              : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <button
                            onClick={() =>
                              selectDocument(isDocActive ? null : doc)
                            }
                            className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                          >
                            <FileText className="h-3 w-3 flex-shrink-0 opacity-60" />
                            <span className="truncate text-xs">
                              {doc.title ?? doc.filename}
                            </span>
                            {isKbOnly && (
                              <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
                                KB
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => confirmRemoveFromKb(kb, doc)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                            aria-label="Remove from KB"
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MAX_DOCS, MAX_KBS } from "@/components/chat/constants";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  streamMessage,
  streamKbMessage,
  clearSession,
  getChunks,
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  updateKnowledgeBase,
  addDocToKb,
  removeDocFromKb,
  getKbDocuments,
} from "../api";
import type { Document, Chunk, Message, KnowledgeBase } from "../types";

function nameFromEmail(email: string) {
  const prefix = email.split("@")[0];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

// ── Context type ──────────────────────────────────────────────────────────────

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "danger" | "default";
  onConfirm: () => void;
}

interface ChatContextValue {
  // User
  user: { name: string; email: string };
  logout: () => void;

  // Data
  documents: Document[];
  knowledgeBases: KnowledgeBase[];

  // Selection
  selectedDoc: Document | null;
  selectedKb: KnowledgeBase | null;
  selectDocument: (doc: Document | null) => void;
  selectKb: (kb: KnowledgeBase | null) => void;

  // Chat
  tab: "chat" | "chunks";
  setTab: React.Dispatch<React.SetStateAction<"chat" | "chunks">>;
  messages: Message[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sessionId: string | null;
  chunks: Chunk[];
  chunksLoading: boolean;
  loading: boolean;
  switchTab: (next: "chat" | "chunks") => Promise<void>;
  submitMessage: () => Promise<void>;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  clearConversation: () => void;

  // Upload / drag
  uploading: boolean;
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleMultiUpload: (files: File[]) => Promise<void>;

  // Document actions
  handleDeleteDoc: (docId: string) => Promise<void>;
  confirmDeleteDoc: (doc: Document) => void;
  handleToggleDocInKb: (
    kbId: string,
    docId: string,
    isInKb: boolean,
  ) => Promise<void>;

  // KB actions
  isCreatingKb: boolean;
  setIsCreatingKb: React.Dispatch<React.SetStateAction<boolean>>;
  newKbName: string;
  setNewKbName: React.Dispatch<React.SetStateAction<string>>;
  newKbColor: string;
  setNewKbColor: React.Dispatch<React.SetStateAction<string>>;
  handleCreateKb: () => Promise<void>;
  handleDeleteKb: (kbId: string) => Promise<void>;
  confirmDeleteKb: (kb: KnowledgeBase) => void;
  confirmRemoveFromKb: (kb: KnowledgeBase, doc: Document) => void;
  handleRemoveDocFromKb: (kbId: string, docId: string) => Promise<void>;
  toggleKbExpand: (kbId: string) => void;
  startRename: (kb: KnowledgeBase) => void;
  confirmRename: (kbId: string) => Promise<void>;
  expandedKbs: string[];
  renamingKbId: string | null;
  setRenamingKbId: React.Dispatch<React.SetStateAction<string | null>>;
  renameValue: string;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  kbDocs: Record<string, Document[]>;

  // Refs
  kbInputRef: React.RefObject<HTMLInputElement>;
  renameInputRef: React.RefObject<HTMLInputElement>;

  // Add source modal
  showAddSource: boolean;
  setShowAddSource: React.Dispatch<React.SetStateAction<boolean>>;
  addSourceKbId: string | null;
  setAddSourceKbId: React.Dispatch<React.SetStateAction<string | null>>;

  // Confirm dialog
  confirmDialog: ConfirmDialogState;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;

  // Derived
  docUsagePct: number;
  kbUsagePct: number;
  activeTarget: Document | KnowledgeBase | null;

  // Data fetchers (needed in ChatAppInner for AddSourceModal callback)
  fetchDocuments: () => Promise<void>;
  fetchKnowledgeBases: () => Promise<void>;
  fetchKbDocs: (kbId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const email = localStorage.getItem("user-email") ?? "";
  const user = { name: nameFromEmail(email) || "Utilisateur", email };

  // Data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  // Selection — one of the two is set at a time
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);

  // Chat
  const [tab, setTab] = useState<"chat" | "chunks">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Upload / drag
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Add source modal
  const [showAddSource, setShowAddSource] = useState(false);
  const [addSourceKbId, setAddSourceKbId] = useState<string | null>(null);

  // KB creation form
  const [isCreatingKb, setIsCreatingKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbColor, setNewKbColor] = useState("blue");

  // KB expand / rename / docs
  const [expandedKbs, setExpandedKbs] = useState<string[]>([]);
  const [renamingKbId, setRenamingKbId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [kbDocs, setKbDocs] = useState<Record<string, Document[]>>({});

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "danger",
    onConfirm: () => {},
  });

  const kbInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    fetchKnowledgeBases();
  }, []);
  useEffect(() => {
    if (isCreatingKb) kbInputRef.current?.focus();
  }, [isCreatingKb]);
  useEffect(() => {
    if (renamingKbId) renameInputRef.current?.focus();
  }, [renamingKbId]);

  // ── Data fetching ───────────────────────────────────────────────────

  async function fetchDocuments() {
    try {
      setDocuments(await listDocuments());
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") logout();
      else toast.error("Could not load documents.");
    }
  }

  async function fetchKnowledgeBases() {
    try {
      setKnowledgeBases(await listKnowledgeBases());
    } catch {
      toast.error("Could not load knowledge bases.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user-email");
    navigate("/login", { replace: true });
  }

  // ── Upload / drag & drop ────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      // Trigger upload directly for drag-and-drop (no modal needed)
      handleMultiUpload(files);
    }
  }

  async function handleMultiUpload(files: File[]) {
    if (uploading) return;
    setUploading(true);
    for (const file of files) {
      try {
        const newDoc = await uploadDocument(file);
        await fetchDocuments();
        selectDocument(newDoc);
        toast.success(`"${newDoc.title ?? newDoc.filename}" uploaded`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Failed: ${file.name}`,
        );
      }
    }
    setUploading(false);
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteDocument(docId);
      if (selectedDoc?.doc_id === docId) selectDocument(null);
      await fetchDocuments();
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Confirm dialog helpers ──────────────────────────────────────────

  function showConfirm(opts: Omit<ConfirmDialogState, "open">) {
    setConfirmDialog({ ...opts, open: true });
  }

  function confirmDeleteDoc(doc: Document) {
    const linkedKbs = knowledgeBases.filter((kb) =>
      kb.doc_ids.includes(doc.doc_id),
    );
    const name = doc.title ?? doc.filename;
    if (linkedKbs.length > 0) {
      const kbNames = linkedKbs.map((kb) => `"${kb.name}"`).join(", ");
      showConfirm({
        title: "Remove from library",
        description: `"${name}" will be removed from your library but will stay accessible in ${kbNames}. The file and index are preserved.`,
        confirmLabel: "Remove from library",
        variant: "default",
        onConfirm: () => handleDeleteDoc(doc.doc_id),
      });
    } else {
      showConfirm({
        title: "Delete document",
        description: `"${name}" will be permanently deleted along with its index. This action cannot be undone.`,
        confirmLabel: "Delete permanently",
        variant: "danger",
        onConfirm: () => handleDeleteDoc(doc.doc_id),
      });
    }
  }

  function confirmDeleteKb(kb: KnowledgeBase) {
    const n = kb.doc_ids.length;
    showConfirm({
      title: `Delete "${kb.name}"`,
      description:
        n > 0
          ? `This Knowledge Base will be deleted. The ${n} linked document${n > 1 ? "s" : ""} will remain in your library.`
          : "This Knowledge Base will be permanently deleted.",
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: () => handleDeleteKb(kb.id),
    });
  }

  function confirmRemoveFromKb(kb: KnowledgeBase, doc: Document) {
    showConfirm({
      title: "Remove from Knowledge Base",
      description: `"${doc.title ?? doc.filename}" will be removed from "${kb.name}". The document will remain in your library.`,
      confirmLabel: "Remove",
      variant: "default",
      onConfirm: () => handleRemoveDocFromKb(kb.id, doc.doc_id),
    });
  }

  // ── Knowledge Base actions ──────────────────────────────────────────

  async function handleCreateKb() {
    const name = newKbName.trim();
    if (!name) return;
    try {
      const kb = await createKnowledgeBase({ name, color: newKbColor });
      setKnowledgeBases((prev) => [...prev, kb]);
      setNewKbName("");
      setNewKbColor("blue");
      setIsCreatingKb(false);
      toast.success(`Knowledge Base "${kb.name}" created`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create knowledge base",
      );
    }
  }

  async function handleDeleteKb(kbId: string) {
    try {
      await deleteKnowledgeBase(kbId);
      if (selectedKb?.id === kbId) selectKb(null);
      await fetchKnowledgeBases();
      toast.success("Knowledge Base deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete knowledge base",
      );
    }
  }

  async function fetchKbDocs(kbId: string) {
    try {
      const docs = await getKbDocuments(kbId);
      setKbDocs((prev) => ({ ...prev, [kbId]: docs }));
    } catch {
      /* silent */
    }
  }

  async function handleRemoveDocFromKb(kbId: string, docId: string) {
    try {
      await removeDocFromKb(kbId, docId);
      await fetchKnowledgeBases();
      await fetchKbDocs(kbId);
      toast.success("Document removed from Knowledge Base");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove document",
      );
    }
  }

  function toggleKbExpand(kbId: string) {
    setExpandedKbs((prev) => {
      if (prev.includes(kbId)) return prev.filter((id) => id !== kbId);
      fetchKbDocs(kbId);
      return [...prev, kbId];
    });
  }

  function startRename(kb: KnowledgeBase) {
    setRenamingKbId(kb.id);
    setRenameValue(kb.name);
  }

  async function confirmRename(kbId: string) {
    const name = renameValue.trim();
    setRenamingKbId(null);
    if (!name) return;
    try {
      const updated = await updateKnowledgeBase(kbId, { name });
      setKnowledgeBases((prev) =>
        prev.map((k) => (k.id === kbId ? { ...k, name: updated.name } : k)),
      );
      if (selectedKb?.id === kbId)
        setSelectedKb((prev) =>
          prev ? { ...prev, name: updated.name } : null,
        );
      toast.success("Knowledge Base renamed");
    } catch {
      toast.error("Failed to rename");
    }
  }

  async function handleToggleDocInKb(
    kbId: string,
    docId: string,
    isInKb: boolean,
  ) {
    try {
      if (isInKb) {
        await removeDocFromKb(kbId, docId);
      } else {
        await addDocToKb(kbId, docId);
      }
      await fetchKnowledgeBases();
      // Refresh selected KB if it was modified
      if (selectedKb?.id === kbId) {
        const updated = knowledgeBases.find((k) => k.id === kbId);
        if (updated) {
          const newDocIds = isInKb
            ? updated.doc_ids.filter((id) => id !== docId)
            : [...updated.doc_ids, docId];
          setSelectedKb({ ...updated, doc_ids: newDocIds });
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update knowledge base",
      );
    }
  }

  // ── Selection ────────────────────────────────────────────────────────

  function resetChat() {
    setMessages([]);
    setSessionId(null);
    setChunks([]);
    setTab("chat");
  }

  function selectDocument(doc: Document | null) {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id);
    setSelectedKb(null);
    setSelectedDoc(doc);
    resetChat();
  }

  function selectKb(kb: KnowledgeBase | null) {
    setSelectedDoc(null);
    setSelectedKb(kb);
    resetChat();
  }

  function clearConversation() {
    if (selectedDoc && sessionId) clearSession(sessionId, selectedDoc.doc_id);
    resetChat();
  }

  // ── Tab / chunks ─────────────────────────────────────────────────────

  async function switchTab(next: "chat" | "chunks") {
    setTab(next);
    if (next === "chunks" && chunks.length === 0 && selectedDoc) {
      setChunksLoading(true);
      try {
        setChunks(await getChunks(selectedDoc.doc_id));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load chunks",
        );
      } finally {
        setChunksLoading(false);
      }
    }
  }

  // ── Submit message ────────────────────────────────────────────────────

  async function submitMessage() {
    if (!input.trim() || loading) return;
    if (!selectedDoc && !selectedKb) return;

    const question = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const stream = selectedKb
        ? streamKbMessage(selectedKb.id, question, sessionId)
        : streamMessage(selectedDoc!.doc_id, question, sessionId);

      for await (const event of stream) {
        if (event.type === "token") {
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant")
              msgs[msgs.length - 1] = {
                ...last,
                content: last.content + event.content,
              };
            return msgs;
          });
        } else if (event.type === "sources") {
          const prev = parseInt(localStorage.getItem("msg-count") ?? "0");
          localStorage.setItem("msg-count", String(prev + 1));
          setSessionId(event.session_id);
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant")
              msgs[msgs.length - 1] = {
                ...last,
                sources: event.sources,
                streaming: false,
              };
            return msgs;
          });
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && !last.content) msgs.pop();
        return msgs;
      });
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
      );
    } finally {
      setMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.streaming)
          msgs[msgs.length - 1] = { ...last, streaming: false };
        return msgs;
      });
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitMessage();
  }

  // ── Derived values ────────────────────────────────────────────────────

  const docUsagePct = Math.min((documents.length / MAX_DOCS) * 100, 100);
  const kbUsagePct = Math.min((knowledgeBases.length / MAX_KBS) * 100, 100);
  const activeTarget = selectedKb ?? selectedDoc;

  // ── Context value ─────────────────────────────────────────────────────

  const value: ChatContextValue = {
    user,
    logout,
    documents,
    knowledgeBases,
    selectedDoc,
    selectedKb,
    selectDocument,
    selectKb,
    tab,
    setTab,
    messages,
    input,
    setInput,
    sessionId,
    chunks,
    chunksLoading,
    loading,
    switchTab,
    submitMessage,
    handleSubmit,
    clearConversation,
    uploading,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleMultiUpload,
    handleDeleteDoc,
    confirmDeleteDoc,
    handleToggleDocInKb,
    isCreatingKb,
    setIsCreatingKb,
    newKbName,
    setNewKbName,
    newKbColor,
    setNewKbColor,
    handleCreateKb,
    handleDeleteKb,
    confirmDeleteKb,
    confirmRemoveFromKb,
    handleRemoveDocFromKb,
    toggleKbExpand,
    startRename,
    confirmRename,
    expandedKbs,
    renamingKbId,
    setRenamingKbId,
    renameValue,
    setRenameValue,
    kbDocs,
    kbInputRef,
    renameInputRef,
    showAddSource,
    setShowAddSource,
    addSourceKbId,
    setAddSourceKbId,
    confirmDialog,
    setConfirmDialog,
    docUsagePct,
    kbUsagePct,
    activeTarget,
    fetchDocuments,
    fetchKnowledgeBases,
    fetchKbDocs,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
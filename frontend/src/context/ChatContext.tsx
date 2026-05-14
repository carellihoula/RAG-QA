import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MAX_DOCS, MAX_KBS } from "@/components/chat/constants";
import { QuotaDialog } from "@/components/QuotaDialog";
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
  listConversations,
  getConversationMessages,
  deleteConversation,
  getBillingStatus,
  createCheckoutSession,
} from "../api";
import type { BillingStatus } from "../api";
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
  sessionId: string | null;      // alias for conversationId (kept for compat)
  conversationId: string | null;
  historyLoading: boolean;
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

  // Quota dialog
  showQuotaDialog: (limit: number) => void;

  // Billing
  billing: BillingStatus | null;

  // Derived
  docUsagePct: number;
  kbUsagePct: number;
  activeTarget: Document | KnowledgeBase | null;

  // Data fetchers (needed in ChatAppInner for AddSourceModal callback)
  fetchDocuments: () => Promise<Document[]>;
  fetchKnowledgeBases: () => Promise<KnowledgeBase[]>;
  fetchKbDocs: (kbId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Conversation history cache (localStorage, 24 h TTL, max 60 messages) ──────

const CACHE_TTL = 24 * 60 * 60 * 1000;

function _convCacheKey(docId?: string, kbId?: string) {
  if (docId) return `conv-cache:doc:${docId}`;
  if (kbId)  return `conv-cache:kb:${kbId}`;
  return null;
}

function readConvCache(key: string): { conversationId: string; messages: Message[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { conversationId, messages, ts } = JSON.parse(raw) as {
      conversationId: string; messages: Message[]; ts: number;
    };
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return { conversationId, messages };
  } catch { return null; }
}

function writeConvCache(key: string, conversationId: string, messages: Message[]) {
  try {
    localStorage.setItem(key, JSON.stringify({
      conversationId,
      messages: messages.slice(-60),   // cap to avoid filling storage
      ts: Date.now(),
    }));
  } catch { /* storage full — ignore */ }
}

function dropConvCache(key: string) {
  localStorage.removeItem(key);
}

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
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  // Selection — one of the two is set at a time
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);

  // Chat
  const [tab, setTab] = useState<"chat" | "chunks">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // Quota dialog
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaLimit, setQuotaLimit] = useState(5);

  function showQuotaDialog(limit: number) {
    setQuotaLimit(limit);
    setQuotaDialogOpen(true);
  }

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
    getBillingStatus().then(setBilling).catch(() => {});
    Promise.all([fetchDocuments(), fetchKnowledgeBases()]).then(
      ([docs, kbs]) => {
        const saved = localStorage.getItem("last-selection");
        if (!saved) return;
        try {
          const { type, id } = JSON.parse(saved) as { type: string; id: string };
          if (type === "doc") {
            const doc = docs?.find((d) => d.doc_id === id);
            if (doc) selectDocument(doc);
          } else if (type === "kb") {
            const kb = kbs?.find((k) => k.id === id);
            if (kb) selectKb(kb);
          }
        } catch { /* ignore malformed */ }
      }
    );
  }, []);
  useEffect(() => {
    if (isCreatingKb) kbInputRef.current?.focus();
  }, [isCreatingKb]);
  useEffect(() => {
    if (renamingKbId) renameInputRef.current?.focus();
  }, [renamingKbId]);

  // ── Data fetching ───────────────────────────────────────────────────

  async function fetchDocuments(): Promise<Document[]> {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      return docs;
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") logout();
      else toast.error("Could not load documents.");
      return [];
    }
  }

  async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
    try {
      const kbs = await listKnowledgeBases();
      setKnowledgeBases(kbs);
      return kbs;
    } catch {
      toast.error("Could not load knowledge bases.");
      return [];
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
        getBillingStatus().then(setBilling).catch(() => {});
        selectDocument(newDoc);
        toast.success(`"${newDoc.title ?? newDoc.filename}" uploaded`);
      } catch (err) {
        const e = err as { status?: number; detail?: { code?: string; doc_limit?: number } };
        const isQuota = e.status === 402 || e.detail?.code === "quota_exceeded";
        if (isQuota) {
          const limit = e.detail?.doc_limit ?? billing?.doc_limit ?? 5;
          showQuotaDialog(limit);
          break;
        }
        toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteDocument(docId);
      dropConvCache(_convCacheKey(docId)!);
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

  function resetChat(newConvId: string | null = null) {
    setMessages([]);
    setConversationId(newConvId);
    setChunks([]);
    setTab("chat");
  }

  async function selectDocument(doc: Document | null) {
    if (selectedDoc && conversationId) clearSession(conversationId, selectedDoc.doc_id);

    if (doc) localStorage.setItem("last-selection", JSON.stringify({ type: "doc", id: doc.doc_id }));
    else localStorage.removeItem("last-selection");

    setSelectedKb(null);
    setSelectedDoc(doc);
    setChunks([]);
    setTab("chat");

    if (!doc) { setMessages([]); setConversationId(null); return; }

    // 1. Show cache instantly if available (zero latency)
    const key = _convCacheKey(doc.doc_id)!;
    const cached = readConvCache(key);
    if (cached) {
      setMessages(cached.messages);
      setConversationId(cached.conversationId);
    } else {
      setMessages([]);
      setConversationId(null);
      setHistoryLoading(true);
    }

    // 2. Fetch fresh data in background (stale-while-revalidate)
    try {
      const convs = await listConversations(doc.doc_id);
      if (convs.length > 0) {
        const msgs = await getConversationMessages(convs[0].id);
        const fresh = msgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources,
        }));
        setMessages(fresh);
        setConversationId(convs[0].id);
        writeConvCache(key, convs[0].id, fresh);
      } else if (cached) {
        // DB has no conversation for this doc anymore — clear stale cache
        setMessages([]);
        setConversationId(null);
        dropConvCache(key);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }

  async function selectKb(kb: KnowledgeBase | null) {
    if (kb) localStorage.setItem("last-selection", JSON.stringify({ type: "kb", id: kb.id }));
    else localStorage.removeItem("last-selection");

    setSelectedDoc(null);
    setSelectedKb(kb);
    setChunks([]);
    setTab("chat");

    if (!kb) { setMessages([]); setConversationId(null); return; }

    const key = _convCacheKey(undefined, kb.id)!;
    const cached = readConvCache(key);
    if (cached) {
      setMessages(cached.messages);
      setConversationId(cached.conversationId);
    } else {
      setMessages([]);
      setConversationId(null);
      setHistoryLoading(true);
    }

    try {
      const convs = await listConversations(undefined, kb.id);
      if (convs.length > 0) {
        const msgs = await getConversationMessages(convs[0].id);
        const fresh = msgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources,
        }));
        setMessages(fresh);
        setConversationId(convs[0].id);
        writeConvCache(key, convs[0].id, fresh);
      } else if (cached) {
        setMessages([]);
        setConversationId(null);
        dropConvCache(key);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }

  function clearConversation() {
    const key = _convCacheKey(selectedDoc?.doc_id, selectedKb?.id);
    if (key) dropConvCache(key);

    if (selectedDoc && conversationId) clearSession(conversationId, selectedDoc.doc_id);
    if (conversationId) deleteConversation(conversationId).catch(() => {});

    resetChat(null);
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
        ? streamKbMessage(selectedKb.id, question, conversationId)
        : streamMessage(selectedDoc!.doc_id, question, conversationId);

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
          const newConvId = event.conversation_id ?? event.session_id;
          const newSources = event.sources;
          setConversationId(newConvId);
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant")
              msgs[msgs.length - 1] = { ...last, sources: newSources, streaming: false };
            // Persist to cache as soon as the exchange is complete
            const cacheKey = _convCacheKey(selectedDoc?.doc_id, selectedKb?.id);
            if (cacheKey && newConvId)
              writeConvCache(cacheKey, newConvId, msgs.filter((m) => !m.streaming));
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

  const docLimit   = billing?.doc_limit ?? MAX_DOCS;
  const docUsagePct = Math.min((documents.length / docLimit) * 100, 100);
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
    sessionId: conversationId,
    conversationId,
    historyLoading,
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
    showQuotaDialog,
    billing,
    docUsagePct,
    kbUsagePct,
    activeTarget,
    fetchDocuments,
    fetchKnowledgeBases,
    fetchKbDocs,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
      <QuotaDialog
        open={quotaDialogOpen}
        onOpenChange={setQuotaDialogOpen}
        limit={quotaLimit}
        onUpgrade={() =>
          createCheckoutSession()
            .then(({ url }) => { window.location.href = url })
            .catch(() => {})
        }
      />
    </ChatContext.Provider>
  );
}
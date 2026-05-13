import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChatProvider, useChatContext } from "./context/ChatContext";
import type { NavItem } from "@/components/AppSidebar";
import { LayoutDashboard, MessageSquare } from "lucide-react";

const APP_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Chat",      icon: MessageSquare,   href: "/app" },
];
import { SidebarLayout } from "@/components/AppSidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddSourceModal } from "@/components/AddSourceModal";
import { DropOverlay } from "@/components/chat/DropOverlay";
import { ChatSidebar } from "@/components/chat/sidebar/ChatSidebar";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChunksPanel } from "@/components/chat/ChunksPanel";
import { addDocToKb, verifyCheckoutSession } from "./api";

export default function ChatApp() {
  return (
    <ChatProvider>
      <ChatAppInner />
    </ChatProvider>
  );
}

function ChatAppInner() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [quotaRefresh, setQuotaRefresh] = useState(0)
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return
    setSearchParams({}, { replace: true })
    verifyCheckoutSession(sessionId)
      .then(() => {
        toast.success('Welcome to Pro! Your quota has been upgraded.', { duration: 5000 })
        setQuotaRefresh(n => n + 1)
      })
      .catch(() => toast.error('Could not verify payment. Please contact support.'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    user,
    logout,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    showAddSource,
    setShowAddSource,
    addSourceKbId,
    setAddSourceKbId,
    confirmDialog,
    setConfirmDialog,
    activeTarget,
    tab,
    selectedDoc,
    selectedKb,
    fetchDocuments,
    fetchKnowledgeBases,
    fetchKbDocs,
    selectDocument,
  } = useChatContext();

  return (
    <SidebarLayout sidebarProps={{ user, navItems: APP_NAV, onLogout: logout, quotaRefresh }}>
      <div
        className="flex h-full overflow-hidden relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DropOverlay />
        <ChatSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {!activeTarget ? (
            <WelcomeScreen />
          ) : (
            <>
              <ChatHeader />
              {(tab === "chat" || selectedKb) && <ChatPanel />}
              {tab === "chunks" && selectedDoc && <ChunksPanel />}
            </>
          )}
        </main>
      </div>
      <AddSourceModal
        open={showAddSource}
        onOpenChange={(open) => {
          setShowAddSource(open);
          if (!open) setAddSourceKbId(null);
        }}
        targetKbId={addSourceKbId}
        onDocumentAdded={async (doc) => {
          if (addSourceKbId) {
            try {
              await addDocToKb(addSourceKbId, doc.doc_id);
            } catch {}
            await fetchKnowledgeBases();
            await fetchKbDocs(addSourceKbId);
          }
          await fetchDocuments();
          selectDocument(doc);
        }}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </SidebarLayout>
  );
}
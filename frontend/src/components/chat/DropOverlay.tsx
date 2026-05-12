import { Upload } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";

export function DropOverlay() {
  const { isDragging } = useChatContext();

  if (!isDragging) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-4 border-2 border-dashed border-blue-500/60 rounded-2xl px-20 py-16 bg-blue-500/5">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Upload className="h-7 w-7 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold">Drop your PDF here</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Release to upload and index
          </p>
        </div>
      </div>
    </div>
  );
}
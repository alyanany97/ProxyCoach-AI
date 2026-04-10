"use client";

import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface DropOverlayProps {
  isVisible: boolean;
}

/**
 * DropOverlay component
 * 
 * Shows a prominent drop zone indicator when files are being dragged over the chat area
 */
export default function DropOverlay({ isVisible }: DropOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50",
        "flex items-center justify-center",
        "bg-background/95 backdrop-blur-sm",
        "border-2 border-dashed border-primary",
        "transition-opacity duration-200",
        "pointer-events-none"
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
        <div
          className={cn(
            "w-20 h-20 rounded-full",
            "bg-primary/10 border-2 border-primary",
            "flex items-center justify-center",
            "animate-pulse"
          )}
        >
          <Upload className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            Drop files here to upload
          </h3>
          <p className="text-sm text-muted-foreground">
            Supports images, PDFs, Excel, Word, and CSV files
          </p>
        </div>
      </div>
    </div>
  );
}

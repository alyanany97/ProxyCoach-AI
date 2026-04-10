"use client";

import { FileAttachment } from "@/types/message";
import { FileText, Image, FileSpreadsheet, File, Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for FileAttachmentDisplay component
 */
interface FileAttachmentDisplayProps {
  attachment: FileAttachment;
  variant?: "inline" | "card";
  showDownload?: boolean;
  inUserMessage?: boolean; // Whether this is displayed in a user message bubble
}

/**
 * Get the appropriate icon for a file type
 */
function getFileIcon(fileType: string, fileName: string) {
  if (fileType.startsWith("image/")) {
    return Image;
  }
  if (
    fileType === "application/pdf" ||
    fileName.endsWith(".pdf")
  ) {
    return FileText;
  }
  if (
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileType === "application/vnd.ms-excel" ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".csv")
  ) {
    return FileSpreadsheet;
  }
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return FileText;
  }
  return File;
}

/**
 * Get the file type label
 */
function getFileTypeLabel(fileType: string, fileName: string): string {
  if (fileType.startsWith("image/")) {
    return "Image";
  }
  if (
    fileType === "application/pdf" ||
    fileName.endsWith(".pdf")
  ) {
    return "PDF";
  }
  if (
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileName.endsWith(".xlsx")
  ) {
    return "Excel";
  }
  if (
    fileType === "application/vnd.ms-excel" ||
    fileName.endsWith(".xls")
  ) {
    return "Excel";
  }
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return "Word";
  }
  if (
    fileType === "text/csv" ||
    fileName.endsWith(".csv")
  ) {
    return "CSV";
  }
  return "File";
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FileAttachmentDisplay component
 * 
 * Displays a file attachment with icon, name, type, and size
 * Similar to ChatGPT's file attachment display
 */
export default function FileAttachmentDisplay({
  attachment,
  variant = "card",
  showDownload = false,
  inUserMessage = false,
}: FileAttachmentDisplayProps) {
  const isImage = attachment.fileType.startsWith("image/");
  const Icon = getFileIcon(attachment.fileType, attachment.fileName);
  const fileTypeLabel = getFileTypeLabel(attachment.fileType, attachment.fileName);
  const fileSize = formatFileSize(attachment.fileSize);
  const fileUrl = attachment.fileUrl || attachment.dataUrl;

  if (variant === "inline") {
    // Compact inline display
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{attachment.fileName}</span>
        <span className="text-muted-foreground text-xs">({fileTypeLabel})</span>
      </div>
    );
  }

  // Card variant - ChatGPT style
  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden",
        "transition-colors",
        isImage && "max-w-full",
        inUserMessage
          ? "border border-primary-foreground/20 bg-primary-foreground/10"
          : "border border-border bg-background hover:border-primary/50"
      )}
    >
      {isImage && fileUrl ? (
        // Image preview
        <div className="relative">
          <img
            src={fileUrl}
            alt={attachment.fileName}
            className="max-w-full max-h-64 w-auto h-auto object-contain"
            onError={(e) => {
              console.error("Failed to load image:", fileUrl);
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 dark:from-background/60 to-transparent p-3">
            <div className="flex items-center justify-between text-primary-foreground text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Image className="w-4 h-4 flex-shrink-0" />
                <span className="truncate font-medium">{attachment.fileName}</span>
                <span className="text-primary-foreground/70 text-xs flex-shrink-0">{fileSize}</span>
              </div>
              {showDownload && fileUrl && (
                <a
                  href={fileUrl}
                  download={attachment.fileName}
                  className="flex-shrink-0 ml-2 p-1 rounded hover:bg-primary-foreground/20 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Document file card
        <div className="flex items-start gap-3 p-3">
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
              inUserMessage
                ? "bg-primary-foreground/20"
                : "bg-muted"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5",
                inUserMessage ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "font-medium text-sm truncate",
                  inUserMessage && "text-primary-foreground"
                )}
              >
                {attachment.fileName}
              </span>
              {showDownload && fileUrl && (
                <a
                  href={fileUrl}
                  download={attachment.fileName}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    inUserMessage
                      ? "text-primary-foreground/70 hover:text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
            <div
              className={cn(
                "flex items-center gap-2 text-xs",
                inUserMessage ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded font-medium",
                  inUserMessage
                    ? "bg-primary-foreground/20 text-primary-foreground/90"
                    : "bg-muted"
                )}
              >
                {fileTypeLabel}
              </span>
              <span>•</span>
              <span>{fileSize}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


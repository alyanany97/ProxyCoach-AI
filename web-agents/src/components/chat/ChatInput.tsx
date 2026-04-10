"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, DragEvent, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, StopCircle, Paperclip, X } from "lucide-react";
import { FileAttachment } from "@/types/message";
import { toast } from "sonner";

/**
 * Internal file attachment with File object for upload
 */
interface FileWithPreview extends FileAttachment {
  file?: File; // Store the actual File object for upload
  previewUrl?: string; // Data URL for preview
}

/**
 * Props for ChatInput component
 */
interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  disabled?: boolean;
  variant?: "default" | "centered";
  onFilesDropped?: (files: File[]) => Promise<void>;
}

/**
 * Methods exposed via ref
 */
export interface ChatInputRef {
  addFiles: (files: File[]) => Promise<void>;
}

/**
 * ChatInput component
 * 
 * Provides a text input area for sending messages with:
 * - Auto-resizing textarea
 * - Enter to send, Shift+Enter for new line
 * - Send button
 * - Cancel button when loading
 */
const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({
  onSend,
  isLoading = false,
  onCancel,
  disabled = false,
  variant = "default",
  onFilesDropped,
}, ref) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-resize textarea based on content
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  /**
   * Convert file to data URL for preview
   */
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Validate if a file type is acceptable
   */
  const isValidFileType = (file: File): boolean => {
    const isImage = file.type.startsWith("image/");
    const isDocument = 
      file.type === "application/pdf" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "text/csv" ||
      file.name.endsWith(".pdf") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".csv");
    
    return isImage || isDocument;
  };

  /**
   * Process and validate files
   */
  const processFiles = async (files: FileList | File[]): Promise<FileWithPreview[]> => {
    const fileArray = Array.from(files);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const newAttachments: FileWithPreview[] = [];
    const invalidFiles: string[] = [];

    for (const file of fileArray) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`"${file.name}" is too large (max 10MB)`);
        continue;
      }

      // Check file type
      if (!isValidFileType(file)) {
        invalidFiles.push(`"${file.name}" is not supported`);
        continue;
      }

      const isImage = file.type.startsWith("image/");

      try {
        // Only create preview URL for images
        let previewUrl: string | undefined;
        if (isImage) {
          previewUrl = await fileToDataUrl(file);
        }
        
        newAttachments.push({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          file, // Store the File object for upload
          previewUrl, // Store preview URL for display (images only)
        });
      } catch (error) {
        console.error("Error reading file:", error);
        // For document files, we don't need a preview, so continue
        if (isImage) {
          invalidFiles.push(`Failed to read "${file.name}"`);
          continue;
        } else {
          // Still add document files even if preview fails
          newAttachments.push({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            file,
          });
        }
      }
    }

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      if (invalidFiles.length === 1) {
        toast.error(invalidFiles[0]);
      } else {
        toast.error(`${invalidFiles.length} files could not be added. ${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? "..." : ""}`);
      }
    }

    return newAttachments;
  };

  /**
   * Handle file selection from input
   */
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = await processFiles(files);

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isLoading) {
      setIsDragOver(true);
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're actually leaving the drop zone
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  /**
   * Handle drop event
   */
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isLoading) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Process files and add to attachments
    const newAttachments = await processFiles(files);

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    // Also notify external handler if provided
    if (onFilesDropped && newAttachments.length > 0) {
      const filesToSend = newAttachments.map(att => att.file!).filter(Boolean);
      await onFilesDropped(filesToSend);
    }
  };

  /**
   * Remove an attachment
   */
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Handle send action
   */
  const handleSend = () => {
    // Allow sending if there's text OR attachments
    if ((!input.trim() && attachments.length === 0) || isLoading || disabled) return;

    const message = input.trim();
    // Extract File objects from attachments
    const filesToSend = attachments.length > 0 
      ? attachments.map(att => att.file!).filter(Boolean) 
      : undefined;
    
    setInput("");
    setAttachments([]);
    onSend(message, filesToSend);
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Expose method to add files programmatically
   */
  useImperativeHandle(ref, () => ({
    addFiles: async (files: File[]) => {
      const newAttachments = await processFiles(files);
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
  }));

  const isCentered = variant === "centered";
  const hasAttachments = attachments.length > 0;

  return (
    <div 
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        variant === "default" && "border-t border-border bg-input-background",
        isCentered && "w-full",
        isDragOver && "bg-muted/50"
      )}
    >
      <div className={cn(
        isCentered ? "p-0" : "p-4"
      )}>
        {/* File attachments preview */}
        {hasAttachments && (
          <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => {
                const isImage = attachment.fileType.startsWith("image/");
                const isDocument = !isImage;
                
                return (
                  <div
                    key={index}
                    className="relative inline-flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm"
                  >
                    {isImage && attachment.previewUrl && (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.fileName}
                        className="w-8 h-8 object-cover rounded"
                      />
                    )}
                    {isDocument && (
                      <div className="w-8 h-8 flex items-center justify-center bg-background rounded text-xs font-medium">
                        {attachment.fileName.endsWith(".pdf") && "PDF"}
                        {(attachment.fileName.endsWith(".xlsx") || attachment.fileName.endsWith(".xls")) && "XL"}
                        {attachment.fileName.endsWith(".docx") && "DOC"}
                        {attachment.fileName.endsWith(".csv") && "CSV"}
                      </div>
                    )}
                    <span className="max-w-[150px] truncate">{attachment.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled || isLoading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        <div className={cn(
          "flex gap-2",
          isCentered ? "items-center" : "items-end",
          isCentered && "relative"
        )}>
          {/* Textarea - ChatGPT style when centered */}
          <div className={cn(
            "relative",
            isCentered ? "flex-1" : "flex-1"
          )}>
            <div className={cn(
              "relative flex items-center gap-2 rounded-2xl border transition-colors",
              isCentered 
                ? "bg-input-background border-border shadow-lg px-4"
                : "border-input bg-input-background px-4 py-3",
              isDragOver && "border-primary bg-primary/5"
            )}>
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.xlsx,.xls,.docx,.csv"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                className={cn(
                  "h-8 w-8 rounded-full flex-shrink-0",
                  isCentered && "h-8 w-8"
                )}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={disabled 
                  ? "Chat is disabled" 
                  : isCentered 
                    ? "Ask anything" 
                    : "Type your message... (Enter to send, Shift+Enter for new line)"}
                disabled={disabled || isLoading}
                rows={1}
                className={cn(
                  "resize-none bg-transparent text-sm",
                  "focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "max-h-32 overflow-y-auto",
                  "leading-5",
                  isCentered ? "flex-1 min-h-[44px] py-3" : "w-full"
                )}
              />

              {/* Action Buttons */}
              <div className="flex gap-2 items-center">
                {isLoading && onCancel ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                    disabled={disabled}
                    className="h-8 w-8 rounded-full"
                  >
                    <StopCircle className="w-4 h-4" />
                  </Button>
                ) : null}

                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading || disabled}
                  size="icon"
                  className={cn(
                    isCentered && "h-8 w-8 rounded-full"
                  )}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!isCentered && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Press Enter to send, Shift+Enter for a new line
          </p>
        )}
      </div>
    </div>
  );
});

ChatInput.displayName = "ChatInput";

export default ChatInput;

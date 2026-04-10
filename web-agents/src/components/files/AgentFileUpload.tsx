"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Upload, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface UploadedFile {
  id: string;
  blobUrl: string;
  uploadedAt: string;
  fileName: string;
  fileType: string;
  companyId: string;
}

/**
 * AgentFileUpload component
 * 
 * Allows users to upload files to Azure Blob Storage for agents.
 * Files are automatically organized by company and file type.
 * 
 * Features:
 * - Drag and drop file upload
 * - File selection via button
 * - Upload progress indicator
 * - Success/error messages
 * - Company membership validation
 */
// Placeholder agents - replace with actual agent list from your system
const AGENTS = [
  { id: "agent-1", name: "Agent 1" },
  { id: "agent-2", name: "Agent 2" },
  { id: "agent-3", name: "Agent 3" },
];

export default function AgentFileUpload() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    type: "success" | "error";
    message: string;
    file?: UploadedFile;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setUploadResult({
        type: "error",
        message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!selectedAgent) {
      setUploadResult({
        type: "error",
        message: "Please select an agent before uploading",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("agentId", selectedAgent);

      const response = await fetch("/api/files/upload-agent", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      setUploadResult({
        type: "success",
        message: `File "${selectedFile.name}" uploaded successfully!`,
        file: data,
      });

      // Clear selected file after successful upload
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadResult({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to upload file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Upload Files</h1>
        </div>

        {/* Agent Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Agent</label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={isUploading}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an agent..." />
            </SelectTrigger>
            <SelectContent>
              {AGENTS.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            "cursor-pointer"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            {selectedFile ? (
              <>
                <File className="w-12 h-12 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Drag and drop a file here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported: PDF, Excel, Word, CSV, Images (Max 10MB)
                  </p>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInputChange}
            accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,image/*"
          />
        </div>

        {/* Action Buttons */}
        {selectedFile && (
          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={isUploading}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Result Message */}
        {uploadResult && (
          <div
            className={cn(
              "p-4 rounded-lg border flex items-start gap-3",
              uploadResult.type === "success"
                ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
            )}
          >
            {uploadResult.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  uploadResult.type === "success"
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                )}
              >
                {uploadResult.message}
              </p>
              {uploadResult.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  File ID: {uploadResult.file.id}
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

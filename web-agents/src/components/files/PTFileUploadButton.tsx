"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AGENTS } from "@/constants/agents";
import { cn } from "@/lib/utils";

interface PTClient {
  id: string;
  name: string | null;
  email: string | null;
}

interface PTFileUploadButtonProps {
  companyId: string;
  clients: PTClient[];
  onUploadSuccess?: () => void;
  className?: string;
}

/**
 * PT-specific file upload button.
 * Shows agent selector and client selector (PT's own clients only).
 * Files are automatically scoped to the PT's trainer profile — no trainer selector shown.
 */
export default function PTFileUploadButton({
  companyId,
  clients,
  onUploadSuccess,
  className,
}: PTFileUploadButtonProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!selectedAgentId) {
      toast.error("Please select an agent");
      return;
    }
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAgentId || !selectedClientId) return;

    setIsUploading(true);
    setError(null);

    try {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("agentId", selectedAgentId);
      // companyId is set server-side from the PT's own profile — we pass it as a hint
      formData.append("companyId", companyId);
      // "all-clients" means no specific client (visible to all this trainer's clients)
      if (selectedClientId !== "all-clients") {
        formData.append("clientId", selectedClientId);
      }

      const response = await fetch("/api/files/upload-agent", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      toast.success(`File "${file.name}" uploaded successfully`);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onUploadSuccess?.();
    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Agent Selector */}
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Select Agent:
          </label>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={isUploading}>
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

        {/* Client Selector */}
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Visible to:
          </label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={isUploading}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a client..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-clients">All My Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name || client.email || client.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClientId === "all-clients" && (
            <p className="mt-1 text-xs text-muted-foreground">
              File will be visible to all your clients
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-destructive-foreground">{error}</p>
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif"
          disabled={isUploading}
        />
        <Button
          onClick={handleUploadClick}
          disabled={isUploading || !selectedAgentId || !selectedClientId}
          className="w-full sm:w-auto"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

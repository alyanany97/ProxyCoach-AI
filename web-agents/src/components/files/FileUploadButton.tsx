"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AGENTS } from "@/constants/agents";
import { cn } from "@/lib/utils";

interface FileUploadButtonProps {
  companies: Array<{ id: string; name: string }>;
  onUploadSuccess?: () => void;
  className?: string;
}

/**
 * FileUploadButton component
 * 
 * Upload button with agent and company selection dropdowns.
 * Uploads files to blob storage following the path convention:
 * - Company-specific: agents/{agent_id}/{company_id}/{file_type}/{fileId}
 * - Shared files (All Companies): agents/shared/{agent_id}/{file_type}/{fileId}
 * 
 * The agent_id in the path allows the Azure Function app to route documents to the correct search index.
 * The Azure Function app will automatically index the file when it's uploaded.
 * Shared files have companyId set to "shared" in the database and search index.
 */
export default function FileUploadButton({
  companies,
  onUploadSuccess,
  className,
}: FileUploadButtonProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if "All Companies" is selected (shared file)
  const isShared = selectedCompanyId === "all-companies";

  const handleUploadClick = () => {
    if (!selectedAgentId) {
      toast.error("Please select an agent");
      return;
    }
    if (!selectedCompanyId) {
      toast.error("Please select a trainer");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAgentId) {
      toast.error("Please select an agent");
      return;
    }
    if (!selectedCompanyId) {
      toast.error("Please select a trainer");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Validate file size (10MB limit)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("agentId", selectedAgentId);
      formData.append("isShared", isShared ? "true" : "false");
      // Only append companyId if not shared
      if (!isShared) {
        formData.append("companyId", selectedCompanyId);
      }

      // Upload file
      const response = await fetch("/api/files/upload-agent", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      const data = await response.json();
      toast.success(`File "${file.name}" uploaded successfully`);
      
      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Call success callback to refresh file list
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
      {/* Agent and Company Selectors */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Select Agent:
          </label>
          <Select
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
            disabled={isUploading}
          >
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

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Select Trainer:
          </label>
          <Select
            value={selectedCompanyId}
            onValueChange={setSelectedCompanyId}
            disabled={isUploading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a trainer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-companies">All Trainers (Shared)</SelectItem>
              <SelectItem value="No_Company_Assigned">No Trainer Assigned</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isShared && (
            <p className="mt-1 text-xs text-muted-foreground">
              Shared files are accessible to all trainers
            </p>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Button */}
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
          disabled={isUploading || !selectedAgentId || !selectedCompanyId}
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

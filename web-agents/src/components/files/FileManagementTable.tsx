"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Download, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import FileUploadButton from "./FileUploadButton";

interface UploadedFile {
  id: string;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  blobUrl: string;
  companyId: string | null;
  company: {
    id: string;
    name: string;
  } | null;
  fileType: string;
  fileName: string;
}

interface FileManagementTableProps {
  companies: Array<{ id: string; name: string }>;
  showCompanySelector?: boolean;
  defaultCompanyId?: string | null;
}

/**
 * FileManagementTable component
 * 
 * Reusable component for managing uploaded files by company.
 * Supports viewing, downloading, and deleting files.
 */
export default function FileManagementTable({
  companies,
  showCompanySelector = true,
  defaultCompanyId = null,
}: FileManagementTableProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    defaultCompanyId || (showCompanySelector ? "all" : companies[0]?.id || "")
  );
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);

  // Fetch files when company selection changes
  useEffect(() => {
    if (selectedCompanyId) {
      fetchFiles();
    }
  }, [selectedCompanyId]);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Handle "all" companies case
      const companyParam = selectedCompanyId === "all" 
        ? "all" 
        : selectedCompanyId === "No_Company_Assigned"
        ? "No_Company_Assigned"
        : selectedCompanyId;

      const response = await fetch(`/api/files/company/${companyParam}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch files");
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (file: UploadedFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    const fileId = fileToDelete.id;
    const fileName = fileToDelete.fileName;
    
    setDeletingFileId(fileId);
    setError(null);

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      // Remove file from list
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      toast.success(`File "${fileName}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting file:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete file";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingFileId(null);
      setFileToDelete(null);
    }
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      // Create a hidden anchor element pointing to the proxy download endpoint
      // The server will stream the file with proper headers to force download
      const link = document.createElement("a");
      link.href = `/api/files/${file.id}/download`;
      link.download = file.fileName; // Set the download filename
      link.style.display = "none"; // Hidden - client never sees the blob URL
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloading "${file.fileName}"`);
    } catch (error) {
      console.error("Error downloading file:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download file";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileType = (fileType: string) => {
    return fileType.charAt(0).toUpperCase() + fileType.slice(1);
  };


  return (
    <div className="space-y-4">
      {/* File Upload Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          Upload Document
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Upload a document to be indexed for the selected trainer. The file will be automatically processed and indexed.
        </p>
        <FileUploadButton
          companies={companies}
          onUploadSuccess={fetchFiles}
        />
      </div>

      {/* Trainer Selector */}
      {showCompanySelector && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-foreground">
            Select Personal Trainer:
          </label>
          <Select
            value={selectedCompanyId}
            onValueChange={setSelectedCompanyId}
            disabled={isLoading}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a trainer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              <SelectItem value="No_Company_Assigned">No Trainer Assigned</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Files Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No files found for the selected trainer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Trainer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Uploaded At
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-border hover:bg-accent transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-foreground">
                      {file.fileName}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatFileType(file.fileType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {file.uploadedBy.name || file.uploadedBy.email || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {file.company?.name || "No Trainer Assigned"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(file.uploadedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          className="h-8 w-8 p-0"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(file)}
                          disabled={deletingFileId === file.id}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
                          title="Delete file"
                        >
                          {deletingFileId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete File"
        description={
          fileToDelete
            ? `Are you sure you want to delete "${fileToDelete.fileName}"? This action cannot be undone.`
            : "Are you sure you want to delete this file? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deletingFileId !== null}
      />
    </div>
  );
}

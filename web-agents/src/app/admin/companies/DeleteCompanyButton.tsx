"use client";

import { toast } from "sonner";
import { deleteCompany } from "@/@actions/admin/companies";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeleteCompanyButtonProps {
  companyId: string;
  companyName: string;
  userCount: number;
}

export function DeleteCompanyButton({
  companyId,
  companyName,
  userCount,
}: DeleteCompanyButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (userCount > 0) {
      toast.error("Cannot delete company with assigned users. Please remove all users first.");
      return;
    }

    startTransition(async () => {
      try {
        await deleteCompany(companyId);
        toast.success(`Company "${companyName}" deleted successfully`);
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete company";
        toast.error(errorMessage);
        setShowConfirm(false);
      }
    });
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <Button
          onClick={handleDelete}
          disabled={isPending}
          variant="destructive"
          size="sm"
        >
          {isPending ? "Deleting..." : "Confirm Delete"}
        </Button>
        <Button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowConfirm(true)}
      disabled={isPending || userCount > 0}
      variant="destructive"
      size="sm"
      title={userCount > 0 ? "Remove all users before deleting" : "Delete company"}
    >
      Delete
    </Button>
  );
}

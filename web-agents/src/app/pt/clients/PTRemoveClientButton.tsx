"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeClientFromMyCompany } from "@/@actions/pt";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, UserMinus } from "lucide-react";

interface PTRemoveClientButtonProps {
  userId: string;
  userName: string;
}

export function PTRemoveClientButton({ userId, userName }: PTRemoveClientButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeClientFromMyCompany(userId);
      if (result.success) {
        toast.success(`${userName} removed from your team`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to remove client");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
      >
        <UserMinus className="h-4 w-4 mr-1.5" />
        Remove
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove Client"
        description={`Remove ${userName} from your team? They will lose access to your coaching content but their account will not be deleted.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirm}
        isLoading={isPending}
      />
    </>
  );
}

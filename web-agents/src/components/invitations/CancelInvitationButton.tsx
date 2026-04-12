"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelInvitation } from "@/@actions/admin/invitations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, X } from "lucide-react";

interface CancelInvitationButtonProps {
  invitationId: string;
  email: string;
}

export function CancelInvitationButton({ invitationId, email }: CancelInvitationButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelInvitation(invitationId);
      if (result.success) {
        toast.success(`Invitation to ${email} cancelled`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to cancel invitation");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel Invitation"
        description={`Cancel the pending invitation for ${email}? You can reinvite them afterwards.`}
        confirmText="Cancel Invitation"
        cancelText="Keep"
        variant="destructive"
        onConfirm={handleConfirm}
        isLoading={isPending}
      />
    </>
  );
}

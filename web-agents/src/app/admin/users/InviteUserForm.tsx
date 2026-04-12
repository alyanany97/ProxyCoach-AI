"use client";

import { toast } from "sonner";
import { createInvitation } from "@/@actions/admin/invitations";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";

export function InviteUserForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      const result = await createInvitation(email.trim());
      if (result.success) {
        toast.success(`Invitation sent to ${email.trim()}`);
        setEmail("");
      } else {
        toast.error(result.error ?? "Failed to send invitation");
      }
    });
  }

  return (
    <form onSubmit={handleInvite} className="flex items-end gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="admin-invite-email">Client Email</Label>
        <Input
          id="admin-invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          disabled={isPending}
          required
        />
      </div>
      <Button type="submit" disabled={isPending || !email.trim()}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Send Invite
      </Button>
    </form>
  );
}

"use client";

import { toast } from "sonner";
import { createInvitation } from "@/@actions/admin/invitations";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteUserForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    startTransition(async () => {
      try {
        await createInvitation(email.trim());
        toast.success(`Invitation sent to ${email.trim()}`);
        setEmail("");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send invitation";
        toast.error(errorMessage);
      }
    });
  }

  return (
    <form onSubmit={handleInvite} className="flex items-center gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@example.com"
        disabled={isPending}
        className="flex-1"
        required
      />
      <Button
        type="submit"
        disabled={isPending || !email.trim()}
      >
        {isPending ? "Inviting..." : "Invite User"}
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePTProfile } from "@/@actions/pt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, X } from "lucide-react";

interface PTProfileFormProps {
  companyId: string;
  currentName: string;
  currentBillingEmail: string | null;
}

export function PTProfileForm({ companyId, currentName, currentBillingEmail }: PTProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [billingEmail, setBillingEmail] = useState(currentBillingEmail ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCancel() {
    setName(currentName);
    setBillingEmail(currentBillingEmail ?? "");
    setEditing(false);
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    startTransition(async () => {
      const result = await updatePTProfile({ name: name.trim(), billingEmail: billingEmail.trim() || undefined });
      if (result.success) {
        toast.success("Profile updated");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update profile");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Profile Name</dt>
            <dd className="font-medium text-foreground">{currentName}</dd>
          </div>
          {currentBillingEmail && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Contact Email</dt>
              <dd className="text-foreground">{currentBillingEmail}</dd>
            </div>
          )}
        </dl>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="flex-shrink-0">
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pt-name">Profile Name</Label>
        <Input
          id="pt-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. John Smith — Personal Training"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pt-billing">Contact Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="pt-billing"
          type="email"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="trainer@example.com"
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

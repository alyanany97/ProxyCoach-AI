"use client";

import { toast } from "sonner";
import { updateCompany } from "@/@actions/admin/companies";
import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditCompanyFormProps {
  companyId: string;
  currentName: string;
  currentBillingEmail: string | null;
  onCancel: () => void;
}

export function EditCompanyForm({
  companyId,
  currentName,
  currentBillingEmail,
  onCancel,
}: EditCompanyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(currentName);
  const [billingEmail, setBillingEmail] = useState(currentBillingEmail || "");
  const router = useRouter();

  useEffect(() => {
    setName(currentName);
    setBillingEmail(currentBillingEmail || "");
  }, [currentName, currentBillingEmail]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    startTransition(async () => {
      try {
        await updateCompany(companyId, {
          name: name.trim(),
          billingEmail: billingEmail.trim() || undefined,
        });
        toast.success(`Company "${name.trim()}" updated successfully`);
        router.refresh();
        onCancel();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update company";
        toast.error(errorMessage);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="edit-name" className="block text-xs font-medium text-foreground mb-1">
          Company Name *
        </Label>
        <Input
          id="edit-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          disabled={isPending}
          required
        />
      </div>
      <div>
        <Label htmlFor="edit-billingEmail" className="block text-xs font-medium text-foreground mb-1">
          Billing Email (optional)
        </Label>
        <Input
          id="edit-billingEmail"
          type="email"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="billing@example.com"
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending || !name.trim()}
          className="flex-1"
        >
          {isPending ? "Updating..." : "Update Company"}
        </Button>
      </div>
    </form>
  );
}

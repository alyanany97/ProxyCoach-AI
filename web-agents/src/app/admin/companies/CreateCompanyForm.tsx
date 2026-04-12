"use client";

import { toast } from "sonner";
import { createCompany } from "@/@actions/admin/companies";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCompanyForm() {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter a trainer name");
      return;
    }

    startTransition(async () => {
      try {
        await createCompany({
          name: name.trim(),
          billingEmail: billingEmail.trim() || undefined,
        });
        toast.success(`Trainer "${name.trim()}" created successfully`);
        setName("");
        setBillingEmail("");
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create company";
        toast.error(errorMessage);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="name" className="block text-xs font-medium text-foreground mb-1">
          Trainer Name *
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. John Smith — Personal Training"
          disabled={isPending}
          required
        />
      </div>
      <div>
        <Label htmlFor="billingEmail" className="block text-xs font-medium text-foreground mb-1">
          Billing Email (optional)
        </Label>
        <Input
          id="billingEmail"
          type="email"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="billing@example.com"
          disabled={isPending}
        />
      </div>
      <Button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full"
      >
        {isPending ? "Creating..." : "Add Trainer"}
      </Button>
    </form>
  );
}

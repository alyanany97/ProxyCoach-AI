"use client";

import { toast } from "sonner";
import { assignUserToCompany } from "@/@actions/admin/companies";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AssignUserToCompanyFormProps {
  companyId: string;
  companyName: string;
  currentUsers: Array<{ id: string; name: string | null; email: string | null }>;
  allUsers: Array<{ id: string; name: string | null; email: string | null }>;
}

export function AssignUserToCompanyForm({
  companyId,
  companyName,
  currentUsers,
  allUsers,
}: AssignUserToCompanyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const router = useRouter();

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    startTransition(async () => {
      try {
        await assignUserToCompany(selectedUserId, companyId);
        toast.success("Client assigned to trainer successfully");
        setSelectedUserId(undefined);
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to assign user to company";
        toast.error(errorMessage);
      }
    });
  }

  const currentUserIds = new Set(currentUsers.map(u => u.id));
  const availableUsers = allUsers.filter(u => !currentUserIds.has(u.id));

  return (
    <div>
      {/* Assign New User */}
      <div>
        <h5 className="mb-2 text-xs font-semibold text-foreground">
          Assign Client to Trainer
        </h5>
        {availableUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground">All clients are already assigned to this trainer</p>
        ) : (
          <form onSubmit={handleAssign} className="flex items-center gap-2">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isPending}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email || "Unknown"} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              disabled={isPending || !selectedUserId}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

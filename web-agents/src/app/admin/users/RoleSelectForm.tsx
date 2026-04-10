"use client";

import { toast } from "sonner";
import { updateUserRole } from "@/@actions/admin/roles";
import { VALID_ROLES } from "@/constants/roles";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RoleSelectForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState(currentRole);

  async function handleUpdateRole() {
    if (!selectedRole) {
      return;
    }

    if (selectedRole === currentRole) {
      return;
    }

    startTransition(async () => {
      try {
        await updateUserRole(userId, selectedRole);
        toast.success(`User role updated to ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update role";
        toast.error(errorMessage);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Select
        value={selectedRole}
        onValueChange={setSelectedRole}
        disabled={isPending}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select role..." />
        </SelectTrigger>
        <SelectContent>
          {VALID_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        onClick={handleUpdateRole}
        disabled={isPending || selectedRole === currentRole}
        size="sm"
      >
        {isPending ? "Updating..." : "Update"}
      </Button>
    </div>
  );
}

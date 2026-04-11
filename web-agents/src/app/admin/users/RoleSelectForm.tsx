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
import { Loader2 } from "lucide-react";

export function RoleSelectForm({
  userId,
  currentRole,
  isCurrentUser = false,
}: {
  userId: string;
  currentRole: string;
  isCurrentUser?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState(currentRole);

  async function handleUpdateRole() {
    if (!selectedRole || selectedRole === currentRole) return;

    startTransition(async () => {
      const result = await updateUserRole(userId, selectedRole);
      if (result.success) {
        toast.success(`Role updated to ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`);
      } else {
        toast.error(result.error ?? "Failed to update role");
        setSelectedRole(currentRole);
      }
    });
  }

  if (isCurrentUser) {
    return (
      <span className="text-xs text-muted-foreground italic">Cannot edit your own role</span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Select
        value={selectedRole}
        onValueChange={setSelectedRole}
        disabled={isPending}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Select role..." />
        </SelectTrigger>
        <SelectContent>
          {VALID_ROLES.map((role) => (
            <SelectItem key={role} value={role} className="text-xs">
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
        className="h-8 text-xs"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
      </Button>
    </div>
  );
}

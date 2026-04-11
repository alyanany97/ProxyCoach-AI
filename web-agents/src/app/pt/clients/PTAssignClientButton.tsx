"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignClientToMyCompany } from "@/@actions/pt";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

interface PTAssignClientButtonProps {
  userId: string;
  userName: string;
}

export function PTAssignClientButton({ userId, userName }: PTAssignClientButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAssign() {
    startTransition(async () => {
      const result = await assignClientToMyCompany(userId);
      if (result.success) {
        toast.success(`${userName} added to your team`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add client");
      }
    });
  }

  return (
    <Button size="sm" onClick={handleAssign} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
      ) : (
        <UserPlus className="h-4 w-4 mr-1.5" />
      )}
      Add to Team
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EditCompanyForm } from "./EditCompanyForm";
import { DeleteCompanyButton } from "./DeleteCompanyButton";
import { AssignUserToCompanyForm } from "./AssignUserToCompanyForm";
import { assignUserToCompany } from "@/@actions/admin/companies";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    billingEmail: string | null;
    createdAt: Date;
    formattedCreatedAt?: string;
    users: Array<{ id: string; name: string | null; email: string | null }>;
  };
  allUsers: Array<{ id: string; name: string | null; email: string | null }>;
}

function RemoveUserButton({
  userId,
  userName,
  companyId,
}: {
  userId: string;
  userName: string;
  companyId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleRemove() {
    startTransition(async () => {
      try {
        await assignUserToCompany(userId, null);
        toast.success(`User "${userName}" removed from company successfully`);
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to remove user from company";
        toast.error(errorMessage);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={isPending}
      className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
      title="Remove user from company"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </Button>
  );
}

export function CompanyCard({ company, allUsers }: CompanyCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-muted border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Edit Company
          </h3>
          <EditCompanyForm
            companyId={company.id}
            currentName={company.name}
            currentBillingEmail={company.billingEmail}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Company Header */}
      <div className="bg-muted border-b border-border px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {company.name}
            </h3>
            {company.billingEmail && (
              <p className="mt-1 text-sm text-muted-foreground">
                Billing: {company.billingEmail}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Created: {company.formattedCreatedAt || new Date(company.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {company.users.length} {company.users.length === 1 ? "user" : "users"}
            </span>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              Edit
            </Button>
            <DeleteCompanyButton
              companyId={company.id}
              companyName={company.name}
              userCount={company.users.length}
            />
          </div>
        </div>
      </div>

      {/* Company Users and Assignment */}
      <div className="px-6 py-4 space-y-4">
        {/* Assigned Users Table */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            Assigned Users
          </h4>
          {company.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {company.users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-accent"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        {user.name || "No name"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.email || "No email"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RemoveUserButton
                          userId={user.id}
                          userName={user.name || user.email || "Unknown"}
                          companyId={company.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users assigned to this company.</p>
          )}
        </div>

        {/* User Assignment Form */}
        <div className="border-t border-border pt-4">
          <AssignUserToCompanyForm
            companyId={company.id}
            companyName={company.name}
            currentUsers={company.users}
            allUsers={allUsers}
          />
        </div>
      </div>
    </div>
  );
}

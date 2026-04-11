import { getAllUsers } from "@/@actions/admin/roles";
import { getAllInvitations } from "@/@actions/admin/invitations";
import { ROLES } from "@/constants/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RoleSelectForm } from "./RoleSelectForm";
import { InviteUserForm } from "./InviteUserForm";
import { cn } from "@/lib/utils";

export default async function AdminUsersPage() {
  const result = await getAllUsers();
  const invitationsResult = await getAllInvitations();

  if (!result.success) {
    redirect("/admin");
  }

  const { users } = result;
  const invitations = invitationsResult.success ? invitationsResult.invitations : [];

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Back to Admin Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">Client Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite clients, manage their roles, and control access to ProxyCoach AI.
        </p>
      </div>

      {/* Invite User Section */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-card-foreground">
          Invite Client
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Invite clients to ProxyCoach AI. They will sign in with their Microsoft account.
        </p>
        <InviteUserForm />
      </div>

      {/* Pending Invitations */}
      {invitations.filter((inv) => inv.status === "pending" && new Date(inv.expiresAt) > new Date()).length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Pending Invitations</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse">
              <thead className="bg-muted">
                <tr>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Email
                  </th>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Invited By
                  </th>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Expires
                  </th>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations
                  .filter((inv) => inv.status === "pending" && new Date(inv.expiresAt) > new Date())
                  .map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-accent">
                      <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                        {invitation.email}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                        {invitation.inviter?.name || invitation.inviter?.email || "Unknown"}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Pending
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Section */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">All Clients</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-muted">
            <tr>
              <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                User
              </th>
              <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                Email
              </th>
              <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                Role
              </th>
              <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-accent">
                  <td className="border-b border-border px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || user.email || "User"}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {(user.name || user.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-foreground">
                        {user.name || "No name"}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                    {user.email || "No email"}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-sm">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                        user.role === ROLES.ADMIN
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-sm">
                    <RoleSelectForm userId={user.id} currentRole={user.role} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </main>
  );
}


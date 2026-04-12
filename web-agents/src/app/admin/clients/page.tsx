import { getAllUsers } from "@/@actions/admin/roles";
import { getAllInvitations } from "@/@actions/admin/invitations";
import { auth } from "@/auth";
import { ROLES } from "@/constants/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RoleSelectForm } from "../users/RoleSelectForm";
import { InviteUserForm } from "../users/InviteUserForm";
import { cn } from "@/lib/utils";
import { Users, Clock, ShieldCheck } from "lucide-react";
import { CancelInvitationButton } from "@/components/invitations/CancelInvitationButton";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
  pt: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  user: "bg-muted text-muted-foreground border border-border",
};

export default async function AdminClientsPage() {
  const [result, invitationsResult, session] = await Promise.all([
    getAllUsers(),
    getAllInvitations(),
    auth(),
  ]);

  if (!result.success) redirect("/admin");

  const { users } = result;
  const invitations = invitationsResult.success ? invitationsResult.invitations : [];
  const currentUserId = session?.user?.id;

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending" && new Date(inv.expiresAt) > new Date()
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Admin Panel
          </Link>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Client Management</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Clients", value: users.length, icon: Users, color: "text-primary" },
            { label: "Pending Invites", value: pendingInvitations.length, icon: Clock, color: "text-amber-500" },
            { label: "Admins", value: users.filter((u) => u.role === ROLES.ADMIN).length, icon: ShieldCheck, color: "text-violet-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4">
              <div className="rounded-lg bg-muted p-2.5">
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Invite Client */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted px-6 py-4">
            <h2 className="text-sm font-semibold">Invite Client</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Send a Microsoft sign-in invitation. Clients sign in with their Microsoft account.
            </p>
          </div>
          <div className="p-6">
            <InviteUserForm />
          </div>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pending Invitations</h2>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {pendingInvitations.length} pending
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invited By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-accent">
                      <td className="px-6 py-3 font-medium text-foreground">{inv.email}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {inv.inviter?.name || inv.inviter?.email || "Unknown"}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Pending
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <CancelInvitationButton invitationId={inv.id} email={inv.email} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Clients */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted px-6 py-4">
            <h2 className="text-sm font-semibold">
              All Clients{" "}
              {users.length > 0 && (
                <span className="text-muted-foreground font-normal">({users.length})</span>
              )}
            </h2>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No users yet. Invite someone above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const isMe = user.id === currentUserId;
                    return (
                      <tr key={user.id} className={cn("hover:bg-accent", isMe && "bg-primary/5")}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-foreground">
                                {user.name ?? "No name"}
                              </span>
                              {isMe && (
                                <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                        <td className="px-6 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              ROLE_STYLES[user.role] ?? ROLE_STYLES.user
                            )}
                          >
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <RoleSelectForm
                            userId={user.id}
                            currentRole={user.role}
                            isCurrentUser={isMe}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

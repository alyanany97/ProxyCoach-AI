import { getPTClients, getPTInvitations } from "@/@actions/pt";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PTInviteForm } from "./PTInviteForm";
import { PTAssignClientButton } from "./PTAssignClientButton";
import { PTRemoveClientButton } from "./PTRemoveClientButton";

export default async function PTClientsPage() {
  const clientsResult = await getPTClients();
  const invitationsResult = await getPTInvitations();

  const clients = clientsResult.success ? clientsResult.clients : [];
  const invitations = invitationsResult.success ? invitationsResult.invitations : [];
  const acceptedUsers = invitationsResult.success ? invitationsResult.acceptedUsers : [];

  const pendingInvitations = invitations.filter(
    (i) => i.status === "pending" && new Date(i.expiresAt) > new Date()
  );

  // Accepted invitations where the user exists but has no company yet
  const unassignedAccepted = acceptedUsers.filter((u) => !u.companyId);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/pt" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← PT Panel
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">My Clients</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">

        {/* Error */}
        {!clientsResult.success && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {clientsResult.error}
          </div>
        )}

        {/* Invite Client */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted px-6 py-4">
            <h2 className="text-sm font-semibold">Invite a Client</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Send a Microsoft sign-in invitation to a new client. Once they accept and sign in, add them to your team below.
            </p>
          </div>
          <div className="p-6">
            <PTInviteForm />
          </div>
        </div>

        {/* Ready to add (accepted + unassigned) */}
        {unassignedAccepted.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
            <div className="border-b border-primary/20 px-6 py-4">
              <h2 className="text-sm font-semibold text-primary">
                Ready to Add ({unassignedAccepted.length})
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                These clients have accepted their invitation and signed in. Add them to your team.
              </p>
            </div>
            <div className="divide-y divide-border">
              {unassignedAccepted.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-6 py-3 bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name ?? "No name"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <PTAssignClientButton userId={user.id} userName={user.name ?? user.email ?? "Client"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted px-6 py-4">
              <h2 className="text-sm font-semibold">Pending Invitations ({pendingInvitations.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-accent">
                      <td className="px-6 py-3 text-foreground">{inv.email}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
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

        {/* Active Clients */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted px-6 py-4">
            <h2 className="text-sm font-semibold">
              Active Clients {clients.length > 0 && <span className="text-muted-foreground font-normal">({clients.length})</span>}
            </h2>
          </div>

          {clients.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No clients yet. Invite someone above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-accent">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {client.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={client.image} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {(client.name ?? client.email ?? "?")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-foreground">{client.name ?? "No name"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{client.email ?? "—"}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <PTRemoveClientButton
                          userId={client.id}
                          userName={client.name ?? client.email ?? "Client"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

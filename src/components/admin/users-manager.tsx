"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Search, SearchX, UserCheck, UserX, X } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/constants";
import { useRepoQuery } from "@/lib/data/hooks";
import { formatDate } from "@/lib/format";
import {
  approveUser,
  changeUserRole,
  disableUser,
  listUsersForAdmin,
  reEnableUser,
  rejectUser,
} from "@/lib/services/admin/users";
import { canChangeUserRole, canChangeUserStatus, denialReason } from "@/lib/services/permissions";
import type { PublicUser, Role, UserStatus } from "@/lib/types";

const ROLES = Object.keys(ROLE_LABELS) as Role[];
const STATUS_FILTERS: { value: UserStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "DISABLED", label: "Disabled" },
];

type Confirmation = { kind: "reject" | "disable"; user: PublicUser } | null;

export function UsersManager() {
  const actor = useCurrentUser();
  const query = useRepoQuery(["users", "admin"], () => listUsersForAdmin(actor));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  const invalidates = [["users"]];
  const approve = useAdminAction((a, u: PublicUser) => approveUser(a, u.id), {
    success: (u) => `${u.name} approved`,
    invalidates,
  });
  const reject = useAdminAction((a, u: PublicUser) => rejectUser(a, u.id), {
    success: (u) => `${u.name}'s request rejected`,
    invalidates,
  });
  const disable = useAdminAction((a, u: PublicUser) => disableUser(a, u.id), {
    success: (u) => `${u.name} disabled`,
    invalidates,
  });
  const reEnable = useAdminAction((a, u: PublicUser) => reEnableUser(a, u.id), {
    success: (u) => `${u.name} re-enabled`,
    invalidates,
  });
  const setRole = useAdminAction((a, v: { user: PublicUser; role: Role }) => changeUserRole(a, v.user.id, v.role), {
    success: (u) => `${u.name}'s role changed to ${ROLE_LABELS[u.role]}`,
    invalidates,
  });

  const activeAdmins = useMemo(
    () => (query.data ?? []).filter((u) => u.role === "ADMIN" && u.status === "ACTIVE").length,
    [query.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Approve new accounts, change roles and disable access." />

      <QueryState query={query}>
        {(all) => {
          const pending = all.filter((u) => u.status === "PENDING");
          const term = search.trim().toLowerCase();
          const shown = all.filter(
            (u) =>
              (!status || u.status === status) &&
              (!term || [u.name, u.email, u.company, u.position].some((f) => f.toLowerCase().includes(term))),
          );

          const rowActions = (user: PublicUser) => {
            const roleDecision = (role: Role) => canChangeUserRole(actor, user, role, activeAdmins);
            const statusDecision = canChangeUserStatus(
              actor,
              user,
              user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
              activeAdmins,
            );
            const roleLocked = ROLES.every((role) => role === user.role || !roleDecision(role).allowed);
            return (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  aria-label={`Role for ${user.name}`}
                  className="h-9 w-36"
                  value={user.role}
                  disabled={roleLocked || setRole.isPending}
                  title={roleLocked ? denialReason(roleDecision(ROLES.find((r) => r !== user.role)!)) : undefined}
                  onChange={(event) => setRole.mutate({ user, role: event.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role} disabled={role !== user.role && !roleDecision(role).allowed}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </NativeSelect>
                {user.status === "ACTIVE" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={!statusDecision.allowed}
                    title={denialReason(statusDecision)}
                    onClick={() => setConfirmation({ kind: "disable", user })}
                  >
                    <UserX /> Disable
                  </Button>
                )}
                {user.status === "DISABLED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={reEnable.isPending}
                    onClick={() => reEnable.mutate(user)}
                  >
                    <UserCheck /> Re-enable
                  </Button>
                )}
                {user.id === actor.id && (
                  <p className="w-full text-xs text-muted-foreground">
                    You can&apos;t change your own role or disable your own account.
                  </p>
                )}
              </div>
            );
          };

          const nameCell = (user: PublicUser) => (
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <span className="truncate">{user.name}</span>
                {user.id === actor.id && <Badge variant="outline">You</Badge>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          );

          return (
            <>
              {pending.length > 0 && (
                <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <h2 className="flex items-center gap-2 font-medium">
                    <Clock className="size-4 text-amber-700" aria-hidden />
                    Awaiting approval
                    <Badge className="bg-amber-100 text-amber-900">{pending.length}</Badge>
                  </h2>
                  <ul className="divide-y divide-amber-200">
                    {pending.map((user) => (
                      <li key={user.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-sm">
                          {nameCell(user)}
                          <div className="text-xs text-muted-foreground">
                            {user.position} · {user.company} · requested {ROLE_LABELS[user.role]} · {formatDate(user.createdAt)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button className="h-10 flex-1 sm:flex-none" disabled={approve.isPending} onClick={() => approve.mutate(user)}>
                            <Check /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 flex-1 sm:flex-none"
                            onClick={() => setConfirmation({ kind: "reject", user })}
                          >
                            <X /> Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search users"
                    placeholder="Search name, email, company…"
                    className={`${INPUT_CLASS} pl-9`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <NativeSelect
                  aria-label="Filter by status"
                  className="sm:w-44"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus | "")}
                >
                  {STATUS_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {shown.length === 0 ? (
                <EmptyState icon={SearchX} title="No users match your search">
                  Check the spelling or change the status filter.
                </EmptyState>
              ) : (
                <>
                  {/* Phones: cards */}
                  <ul className="space-y-3 md:hidden">
                    {shown.map((user) => (
                      <li key={user.id} className="space-y-3 rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                          {nameCell(user)}
                          <StatusBadge status={user.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {user.position} · {user.company}
                        </p>
                        {user.status !== "PENDING" && rowActions(user)}
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: table */}
                  <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Company · position</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Role & access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {shown.map((user) => (
                          <tr key={user.id}>
                            <td className="max-w-56 px-4 py-3">{nameCell(user)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div>{user.company}</div>
                              <div className="text-xs">{user.position}</div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={user.status} />
                            </td>
                            <td className="px-4 py-3">
                              {user.status === "PENDING" ? (
                                <span className="text-xs text-muted-foreground">Approve or reject above</span>
                              ) : (
                                rowActions(user)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        }}
      </QueryState>

      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation?.kind === "reject" ? "Reject this request?" : "Disable this account?"}
        description={
          confirmation?.kind === "reject"
            ? `${confirmation.user.name} will not be able to log in. You can re-enable the account later.`
            : `${confirmation?.user.name} will be signed out and unable to log in until re-enabled.`
        }
        confirmLabel={confirmation?.kind === "reject" ? "Reject" : "Disable"}
        destructive
        onConfirm={() =>
          confirmation!.kind === "reject"
            ? reject.mutateAsync(confirmation!.user)
            : disable.mutateAsync(confirmation!.user)
        }
      />
    </div>
  );
}

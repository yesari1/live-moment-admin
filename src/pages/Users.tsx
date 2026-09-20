import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Coins,
  MoreHorizontal,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { CostDisplay } from "@/components/shared/cost-display";
import {
  AccountStatusBadge,
  GenerationStatusBadge,
  PlanBadge,
} from "@/components/shared/status-badge";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteUser,
  fetchGenerations,
  fetchUsage,
  fetchUsers,
  mergeUserStats,
  updateUser,
} from "@/services/data-service";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  truncateMiddle,
} from "@/lib/format";
import { PLAN_LABELS, PLAN_ORDER } from "@/data/plans";
import type { AdminUser, AccountPlan } from "@/types";

type PlanFilter = AccountPlan | "all";
type StatusFilter = AdminUser["status"] | "all";

export function UsersPage() {
  const { user: actor, getIdToken } = useAuth();
  const usersQuery = useAsyncData(fetchUsers);
  const generationsQuery = useAsyncData(fetchGenerations);
  const usageQuery = useAsyncData(fetchUsage);

  const [planFilter, setPlanFilter] = React.useState<PlanFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedUid, setSelectedUid] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<AdminUser | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const users = React.useMemo(
    () =>
      usersQuery.data && generationsQuery.data && usageQuery.data
        ? mergeUserStats(
            usersQuery.data,
            generationsQuery.data,
            usageQuery.data,
          )
        : [],
    [usersQuery.data, generationsQuery.data, usageQuery.data],
  );

  const filtered = React.useMemo(
    () =>
      users.filter((user) => {
        if (planFilter !== "all" && user.plan !== planFilter) return false;
        if (statusFilter !== "all" && user.status !== statusFilter) return false;
        return true;
      }),
    [users, planFilter, statusFilter],
  );

  const selected = React.useMemo(
    () => users.find((u) => u.uid === selectedUid) ?? null,
    [users, selectedUid],
  );

  const loading =
    usersQuery.loading || generationsQuery.loading || usageQuery.loading;
  const error = usersQuery.error ?? generationsQuery.error ?? usageQuery.error;

  const refreshAll = () => {
    void usersQuery.refresh();
    void generationsQuery.refresh();
    void usageQuery.refresh();
  };

  const confirmDelete = async () => {
    if (!pending || !actor) return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      await deleteUser(pending.uid, { uid: actor.uid, email: actor.email }, token);
      toast.success("User deleted.");
      setPending(null);
      setSelectedUid(null);
      await usersQuery.refresh();
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = React.useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.email ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {truncateMiddle(row.original.uid, 20)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "plan",
        header: "Plan",
        cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <AccountStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Registered",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "lastActiveAt",
        header: "Last activity",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelative(row.original.lastActiveAt ?? row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        accessorKey: "imageGenerationCount",
        header: "Images",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.imageGenerationCount)}
          </span>
        ),
      },
      {
        accessorKey: "videoGenerationCount",
        header: "Videos",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.videoGenerationCount)}
          </span>
        ),
      },
      {
        accessorKey: "credits",
        header: "Credits",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.credits)}</span>
        ),
      },
      {
        accessorKey: "estimatedTotalCost",
        header: "Est. cost",
        cell: ({ row }) => <CostDisplay value={row.original.estimatedTotalCost} />,
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Row actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedUid(row.original.uid)}>
                  <UserRound className="h-4 w-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void handlePatchFor(
                      row.original,
                      { disabled: row.original.status !== "disabled" },
                      row.original.status === "disabled"
                        ? "User enabled."
                        : "User disabled.",
                      actor,
                      usersQuery.refresh,
                    )
                  }
                >
                  {row.original.status === "disabled" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  {row.original.status === "disabled" ? "Enable" : "Disable"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setPending(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actor],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Search, inspect and manage Live Moment accounts."
        />
        <ErrorState message={error} onRetry={refreshAll} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Search, inspect and manage Live Moment accounts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={formatNumber(users.length)} loading={loading} />
        <StatCard
          label="Active"
          value={formatNumber(users.filter((u) => u.status === "active").length)}
          loading={loading}
        />
        <StatCard
          label="Disabled"
          value={formatNumber(users.filter((u) => u.status === "disabled").length)}
          loading={loading}
        />
        <StatCard
          label="Paid plans"
          value={formatNumber(users.filter((u) => u.plan !== "free").length)}
          loading={loading}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchPlaceholder="Search by email or user ID…"
        emptyTitle="No users match these filters"
        emptyDescription="Try clearing the plan or status filters, or adjusting your search."
        getRowId={(row) => row.uid}
        onRowClick={(row) => setSelectedUid(row.uid)}
        toolbar={
          <>
            <Select
              value={planFilter}
              onValueChange={(value) => setPlanFilter(value as PlanFilter)}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {PLAN_ORDER.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {PLAN_LABELS[plan]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="review">Support review</SelectItem>
                <SelectItem value="deletion_pending">Deletion pending</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <UserDetailDrawer
        user={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedUid(null)}
        actor={actor}
        onChanged={usersQuery.refresh}
        onRequestDelete={(user) => setPending(user)}
      />

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete this user permanently?"
        destructive
        confirmLabel="Delete permanently"
        loading={deleting}
        onConfirm={confirmDelete}
        description={
          <div className="space-y-2">
            <p>
              This removes the account and its data for{" "}
              <span className="font-medium text-foreground">
                {pending?.email ?? pending?.uid}
              </span>
              :
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Firebase Authentication account</li>
              <li>Firestore profile and generation history</li>
              <li>Stored media and related metadata</li>
            </ul>
            <p className="font-medium text-destructive">This action cannot be undone.</p>
          </div>
        }
      />
    </div>
  );
}

async function handlePatchFor(
  user: AdminUser,
  patch: Parameters<typeof updateUser>[1],
  message: string,
  actor: { uid: string; email: string | null } | null,
  refresh: () => Promise<void>,
) {
  if (!actor) return;
  try {
    await updateUser(user.uid, patch, { uid: actor.uid, email: actor.email });
    toast.success(message);
    await refresh();
  } catch (err) {
    toast.error("Action failed", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}

function UserDetailDrawer({
  user,
  open,
  onOpenChange,
  actor,
  onChanged,
  onRequestDelete,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor: { uid: string; email: string | null } | null;
  onChanged: () => Promise<void>;
  onRequestDelete: (user: AdminUser) => void;
}) {
  const generations = useAsyncData(fetchGenerations);
  const [creditsInput, setCreditsInput] = React.useState("");

  React.useEffect(() => {
    if (user) setCreditsInput(String(user.credits));
  }, [user]);

  if (!user) return null;

  const userGenerations = (generations.data ?? []).filter(
    (g) => g.uid === user.uid,
  );
  const failures = userGenerations.filter((g) => g.status === "failed");

  const patch = async (
    changes: Parameters<typeof updateUser>[1],
    message: string,
  ) => {
    if (!actor) return;
    try {
      await updateUser(user.uid, changes, {
        uid: actor.uid,
        email: actor.email,
      });
      toast.success(message);
      await onChanged();
    } catch (err) {
      toast.error("Action failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.email ?? user.uid}
            <PlanBadge plan={user.plan} />
            <AccountStatusBadge status={user.status} />
          </SheetTitle>
          <SheetDescription>
            UID {user.uid} · registered {formatDate(user.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 px-6">
          <MiniStat label="Images" value={formatNumber(user.imageGenerationCount)} />
          <MiniStat label="Videos" value={formatNumber(user.videoGenerationCount)} />
          <MiniStat label="Credits" value={formatNumber(user.credits)} />
        </div>

        <Tabs defaultValue="overview" className="px-6 pb-6">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="generations" className="flex-1">
              Generations
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex-1">
              Credits
            </TabsTrigger>
            <TabsTrigger value="failures" className="flex-1">
              Failures
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Detail label="Plan" value={PLAN_LABELS[user.plan]} />
              <Detail label="Status" value={user.status} />
              <Detail label="Registered" value={formatDateTime(user.createdAt)} />
              <Detail
                label="Last login"
                value={formatDateTime(user.lastLoginAt)}
              />
              <Detail
                label="Last activity"
                value={formatDateTime(user.lastActiveAt)}
              />
              <Detail
                label="Last generation"
                value={formatDateTime(user.lastGenerationAt)}
              />
              <Detail
                label="Billing verified"
                value={user.billingVerified ? "Yes" : "No"}
              />
              <Detail
                label="Free preview used"
                value={user.freePreviewUsed ? "Yes" : "No"}
              />
              <Detail
                label="Est. total cost"
                value={<CostDisplay value={user.estimatedTotalCost} />}
              />
              <Detail
                label="Providers"
                value={user.providers.join(", ") || "—"}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Administrative actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void patch(
                      { disabled: user.status !== "disabled" },
                      user.status === "disabled" ? "User enabled." : "User disabled.",
                    )
                  }
                >
                  {user.status === "disabled" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Enable user
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" /> Disable user
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void patch(
                      { supportReview: user.status !== "review" },
                      user.status === "review"
                        ? "Review flag cleared."
                        : "Marked for support review.",
                    )
                  }
                >
                  <ShieldAlert className="h-4 w-4" /> Mark for review
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRequestDelete(user)}
                >
                  <Trash2 className="h-4 w-4" /> Delete account
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="generations" className="space-y-2">
            {userGenerations.length ? (
              userGenerations.slice(0, 30).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {g.type === "image" ? "Image" : "Video"} ·{" "}
                      {g.model ?? "unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(g.createdAt)} ·{" "}
                      {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CostDisplay value={g.estimatedCost} muted />
                    <GenerationStatusBadge status={g.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No generations yet"
                description="This user has not generated any image or video."
                className="border-0 bg-transparent"
              />
            )}
          </TabsContent>

          <TabsContent value="credits" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Current balance</p>
              <p className="text-3xl font-semibold tabular-nums">{user.credits}</p>
              <p className="text-xs text-muted-foreground">
                Stored as <code>standaloneWallpapersGranted</code> on the user profile.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium" htmlFor="credits-input">
                  Set credits
                </label>
                <input
                  id="credits-input"
                  type="number"
                  min={0}
                  value={creditsInput}
                  onChange={(e) => setCreditsInput(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={() =>
                  void patch(
                    { credits: Math.max(0, Number(creditsInput) || 0) },
                    "Credits updated.",
                  )
                }
              >
                <Coins className="h-4 w-4" /> Update credits
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Billing-sensitive changes should be treated as sensitive
              configuration and are recorded in the audit trail.
            </p>
          </TabsContent>

          <TabsContent value="failures" className="space-y-2">
            {failures.length ? (
              failures.map((g) => (
                <div key={g.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{g.errorCode ?? "FAILED"}</p>
                    <GenerationStatusBadge status={g.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {g.errorMessage ?? "No additional detail available."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(g.createdAt)} · retries {g.retryCount}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No failures"
                description="This user has no failed generations."
                className="border-0 bg-transparent"
              />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm capitalize">{value}</div>
    </div>
  );
}

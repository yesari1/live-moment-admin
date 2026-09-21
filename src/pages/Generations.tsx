import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { CostDisplay } from "@/components/shared/cost-display";
import {
  FallbackBadge,
  GenerationStatusBadge,
  MediaTypeBadge,
} from "@/components/shared/status-badge";
import { DateRangeFilter, resolveDateRange } from "@/components/shared/date-range-filter";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchGenerations } from "@/services/data-service";
import {
  formatCost,
  formatDateTime,
  formatDurationMs,
  formatNumber,
} from "@/lib/format";
import {
  getModelDisplayName,
  getProviderDisplayName,
} from "@/data/providers";
import type { DateRange, GenerationRecord, GenerationStatus, GenerationType } from "@/types";

type TypeFilter = GenerationType | "all";
type StatusFilter = GenerationStatus | "all";

export function GenerationsPage() {
  const query = useAsyncData(fetchGenerations);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [providerFilter, setProviderFilter] = React.useState("all");
  const [fallbackOnly, setFallbackOnly] = React.useState(false);
  const [range, setRange] = React.useState<DateRange>({
    preset: "30d",
    from: null,
    to: null,
  });
  const [selected, setSelected] = React.useState<GenerationRecord | null>(null);

  const providers = React.useMemo(
    () =>
      [...new Set((query.data ?? []).map((g) => g.actualProvider ?? g.provider))]
        .filter(Boolean)
        .sort() as string[],
    [query.data],
  );

  const filtered = React.useMemo(() => {
    const { from, to } = resolveDateRange(range);
    const start = from?.getTime() ?? 0;
    const end = to?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return (query.data ?? []).filter((g) => {
      if (typeFilter !== "all" && g.type !== typeFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (
        providerFilter !== "all" &&
        (g.actualProvider ?? g.provider) !== providerFilter
      )
        return false;
      if (fallbackOnly && !g.fallbackUsed) return false;
      const t = g.createdAt?.getTime() ?? 0;
      return t >= start && t <= end;
    });
  }, [query.data, typeFilter, statusFilter, providerFilter, fallbackOnly, range]);

  const totals = React.useMemo(() => {
    const cost = filtered.reduce((sum, g) => sum + (g.estimatedCost ?? 0), 0);
    const failed = filtered.filter((g) => g.status === "failed").length;
    return { cost, failed };
  }, [filtered]);

  const columns = React.useMemo<ColumnDef<GenerationRecord, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Generation ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id}
          </span>
        ),
      },
      {
        accessorKey: "userEmail",
        header: "User",
        cell: ({ row }) => (
          <span className="truncate text-sm">
            {row.original.userEmail ?? row.original.uid}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <MediaTypeBadge type={row.original.type} />,
      },
      {
        accessorKey: "model",
        header: "Provider / Model",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">
              {getModelDisplayName(row.original.model)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {getProviderDisplayName(row.original.actualProvider ?? row.original.provider)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <GenerationStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Started",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "durationMs",
        header: "Duration",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatDurationMs(row.original.durationMs)}
          </span>
        ),
      },
      {
        accessorKey: "estimatedCost",
        header: "Est. cost",
        cell: ({ row }) => <CostDisplay value={row.original.estimatedCost} />,
      },
      {
        accessorKey: "retryCount",
        header: "Retries",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.original.retryCount}</span>
        ),
      },
      {
        accessorKey: "fallbackUsed",
        header: "Fallback",
        cell: ({ row }) => <FallbackBadge used={row.original.fallbackUsed} />,
      },
      {
        accessorKey: "errorCode",
        header: "Error",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.errorCode ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Generations"
          description="Operational history of every AI generation job."
        />
        <ErrorState message={query.error} onRetry={query.refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generations"
        description="Operational history of every image and video generation job."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jobs in period"
          value={formatNumber(filtered.length)}
          loading={query.loading}
        />
        <StatCard
          label="Failed"
          value={formatNumber(totals.failed)}
          loading={query.loading}
        />
        <StatCard
          label="Estimated cost"
          value={formatCost(totals.cost)}
          loading={query.loading}
        />
        <StatCard
          label="Fallback used"
          value={formatNumber(filtered.filter((g) => g.fallbackUsed).length)}
          loading={query.loading}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={query.loading}
        searchPlaceholder="Search by generation ID, user or model…"
        emptyTitle="No generations found"
        emptyDescription="No jobs match the current filters in this period."
        initialPageSize={20}
        getRowId={(row) => row.id}
        onRowClick={(row) => setSelected(row)}
        toolbar={
          <>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {getProviderDisplayName(provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={fallbackOnly ? "secondary" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setFallbackOnly((prev) => !prev)}
            >
              Fallback only
            </Button>
          </>
        }
      />

      <GenerationDetailDrawer
        generation={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function GenerationDetailDrawer({
  generation,
  open,
  onOpenChange,
}: {
  generation: GenerationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = React.useState(false);
  if (!generation) return null;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(generation.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{generation.id}</span>
            <GenerationStatusBadge status={generation.status} />
          </SheetTitle>
          <SheetDescription>
            {generation.type === "image" ? "Image" : "Video"} generation ·{" "}
            {generation.userEmail ?? generation.uid}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 pb-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyId()}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy ID
            </Button>
            {generation.providerRequestId && (
              <Badge variant="muted" className="h-8 px-3 font-mono">
                req {generation.providerRequestId}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Detail label="Type" value={generation.type} />
            <Detail label="Context" value={generation.routingContext ?? "—"} />
            <Detail label="User" value={generation.userEmail ?? generation.uid} />
            <Detail label="Template" value={generation.presetId ?? "—"} />
            <Detail
              label="Primary provider"
              value={getProviderDisplayName(generation.primaryProvider)}
            />
            <Detail
              label="Primary model"
              value={getModelDisplayName(generation.primaryModel)}
            />
            <Detail
              label="Fallback provider"
              value={getProviderDisplayName(generation.fallbackProvider)}
            />
            <Detail
              label="Fallback model"
              value={getModelDisplayName(generation.fallbackModel)}
            />
            <Detail
              label="Actual provider"
              value={getProviderDisplayName(generation.actualProvider)}
            />
            <Detail
              label="Actual model"
              value={getModelDisplayName(generation.model)}
            />
            <Detail label="Fallback used" value={generation.fallbackUsed ? "Yes" : "No"} />
            <Detail label="Retries" value={String(generation.retryCount)} />
            <Detail label="Duration" value={formatDurationMs(generation.durationMs)} />
            <Detail
              label="Estimated cost"
              value={<CostDisplay value={generation.estimatedCost} />}
            />
            <Detail label="Created" value={formatDateTime(generation.createdAt)} />
            <Detail label="Completed" value={formatDateTime(generation.completedAt)} />
            <Detail label="Person type" value={generation.personType ?? "—"} />
            <Detail label="Timeout" value={generation.timeout ? "Yes" : "No"} />
          </div>

          {generation.status === "failed" && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Failure detail
                </p>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <p className="font-mono text-xs text-destructive">
                    {generation.errorCode ?? "UNKNOWN_ERROR"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {generation.errorMessage ?? "No readable error message."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">
                      retries: {generation.retryCount}
                    </Badge>
                    <Badge variant="muted">
                      timeout: {generation.timeout ? "yes" : "no"}
                    </Badge>
                    <Badge variant="muted">
                      fallback: {generation.fallbackUsed ? "used" : "not used"}
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            Provider secret keys and credentials are never shown here.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="truncate text-sm capitalize">{value}</div>
    </div>
  );
}

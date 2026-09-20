import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Copy, ScrollText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { SeverityBadge } from "@/components/shared/status-badge";
import { DateRangeFilter, resolveDateRange } from "@/components/shared/date-range-filter";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchAuditLogs, fetchErrorLogs } from "@/services/data-service";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  getModelDisplayName,
  getProviderDisplayName,
} from "@/data/providers";
import type {
  AuditLog,
  DateRange,
  ErrorLog,
  LogCategory,
  LogSeverity,
} from "@/types";

const CATEGORY_LABELS: Record<LogCategory, string> = {
  image_provider: "Image provider",
  video_provider: "Video provider",
  backend: "Backend",
  authentication: "Authentication",
  firestore: "Firestore",
  storage: "Storage",
  timeout: "Timeout",
  fallback: "Fallback",
  config_change: "Config change",
};

export function LogsPage() {
  const errors = useAsyncData(fetchErrorLogs);
  const audit = useAsyncData(fetchAuditLogs);

  const [severity, setSeverity] = React.useState<LogSeverity | "all">("all");
  const [category, setCategory] = React.useState<LogCategory | "all">("all");
  const [range, setRange] = React.useState<DateRange>({
    preset: "30d",
    from: null,
    to: null,
  });
  const [selectedLog, setSelectedLog] = React.useState<ErrorLog | null>(null);
  const [selectedAudit, setSelectedAudit] = React.useState<AuditLog | null>(null);

  const filteredLogs = React.useMemo(() => {
    const { from, to } = resolveDateRange(range);
    const start = from?.getTime() ?? 0;
    const end = to?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return (errors.data ?? []).filter((log) => {
      if (severity !== "all" && log.severity !== severity) return false;
      if (category !== "all" && log.category !== category) return false;
      const t = log.timestamp?.getTime() ?? 0;
      return t >= start && t <= end;
    });
  }, [errors.data, severity, category, range]);

  const logColumns = React.useMemo<ColumnDef<ErrorLog, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: "severity",
        header: "Severity",
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="muted">
            {CATEGORY_LABELS[row.original.category] ?? row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: "errorCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.errorCode ?? "—"}</span>
        ),
      },
      {
        accessorKey: "message",
        header: "Message",
        cell: ({ row }) => (
          <span className="line-clamp-1 text-sm text-muted-foreground">
            {row.original.message}
          </span>
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider / Model",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {getProviderDisplayName(row.original.provider)} ·{" "}
            {getModelDisplayName(row.original.model)}
          </span>
        ),
      },
    ],
    [],
  );

  const auditColumns = React.useMemo<ColumnDef<AuditLog, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="info">{row.original.action.replace(/_/g, " ")}</Badge>
        ),
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.target}</span>
        ),
      },
      {
        accessorKey: "adminEmail",
        header: "Admin",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.adminEmail ?? row.original.adminUid}
          </span>
        ),
      },
    ],
    [],
  );

  if (errors.error && audit.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Logs"
          description="Operational failures and the admin audit trail."
        />
        <ErrorState
          message={errors.error}
          onRetry={() => {
            void errors.refresh();
            void audit.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        description="Operational view of failures and a complete audit trail of sensitive admin actions."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Logs in period" value={formatNumber(filteredLogs.length)} loading={errors.loading} />
        <StatCard
          label="Errors"
          value={formatNumber(filteredLogs.filter((l) => l.severity === "error").length)}
          loading={errors.loading}
        />
        <StatCard
          label="Critical"
          value={formatNumber(filteredLogs.filter((l) => l.severity === "critical").length)}
          loading={errors.loading}
        />
        <StatCard
          label="Audit records"
          value={formatNumber((audit.data ?? []).length)}
          loading={audit.loading}
        />
      </div>

      <Tabs defaultValue="failures">
        <TabsList>
          <TabsTrigger value="failures">
            <ScrollText className="mr-1.5 h-4 w-4" />
            Failures &amp; errors
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Audit trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="failures" className="mt-4">
          <DataTable
            columns={logColumns}
            data={filteredLogs}
            loading={errors.loading}
            searchPlaceholder="Search logs by code, message, user or generation…"
            emptyTitle="No logs available"
            emptyDescription="No operational logs match the current filters."
            initialPageSize={20}
            getRowId={(row) => row.id}
            onRowClick={(row) => setSelectedLog(row)}
            toolbar={
              <>
                <Select
                  value={severity}
                  onValueChange={(value) => setSeverity(value as LogSeverity | "all")}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as LogCategory | "all")}
                >
                  <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <DataTable
            columns={auditColumns}
            data={audit.data ?? []}
            loading={audit.loading}
            searchPlaceholder="Search audit trail…"
            emptyTitle="No audit records"
            emptyDescription="Sensitive admin actions will be recorded here."
            initialPageSize={20}
            getRowId={(row) => row.id}
            onRowClick={(row) => setSelectedAudit(row)}
          />
        </TabsContent>
      </Tabs>

      <LogDetailDrawer
        log={selectedLog}
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
      <AuditDetailDrawer
        entry={selectedAudit}
        open={selectedAudit !== null}
        onOpenChange={(open) => !open && setSelectedAudit(null)}
      />
    </div>
  );
}

function LogDetailDrawer({
  log,
  open,
  onOpenChange,
}: {
  log: ErrorLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SeverityBadge severity={log.severity} />
            <span className="font-mono text-sm">{log.errorCode ?? "LOG"}</span>
          </SheetTitle>
          <SheetDescription>{formatDateTime(log.timestamp)}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-6">
          <p className="rounded-md border bg-muted/30 p-3 text-sm">
            {log.message}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Detail
              label="Category"
              value={CATEGORY_LABELS[log.category] ?? log.category}
            />
            <Detail label="Severity" value={log.severity} />
            <Detail label="Provider" value={getProviderDisplayName(log.provider)} />
            <Detail label="Model" value={getModelDisplayName(log.model)} />
            <Detail label="User" value={log.userId ?? "—"} />
            <Detail label="Generation" value={log.generationId ?? "—"} />
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            User-visible log output is sanitized. Provider secrets and
            credentials are never stored or displayed.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AuditDetailDrawer({
  entry,
  open,
  onOpenChange,
}: {
  entry: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      toast.success("Audit record copied.");
    } catch {
      toast.error("Clipboard unavailable.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{entry.action.replace(/_/g, " ")}</SheetTitle>
          <SheetDescription>
            {entry.target} · {formatDateTime(entry.createdAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Admin" value={entry.adminEmail ?? entry.adminUid} />
            <Detail label="Target" value={entry.target} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Before
            </p>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(entry.before ?? null, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              After
            </p>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(entry.after ?? null, null, 2)}
            </pre>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <Copy className="h-4 w-4" />
            Copy record
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="break-all text-sm capitalize">{value}</div>
    </div>
  );
}

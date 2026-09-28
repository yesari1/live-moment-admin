import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquare, Sparkles, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { DateRangeFilter, resolveDateRange } from "@/components/shared/date-range-filter";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchFeedback } from "@/services/data-service";
import { planLabel } from "@/data/plans";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import type { DateRange, FeedbackRecord } from "@/types";

const PLAN_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All plans" },
  { id: "free", label: "Free" },
  { id: "single", label: "Single" },
  { id: "live_weather", label: "LiveWeather" },
  { id: "live_weather_plus", label: "LiveWeather Plus" },
];

export function FeedbackPage() {
  const query = useAsyncData(fetchFeedback);
  const [planFilter, setPlanFilter] = React.useState("all");
  const [range, setRange] = React.useState<DateRange>({
    preset: "30d",
    from: null,
    to: null,
  });
  const [selected, setSelected] = React.useState<FeedbackRecord | null>(null);

  const filtered = React.useMemo(() => {
    const { from, to } = resolveDateRange(range);
    const start = from?.getTime() ?? 0;
    const end = to?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return (query.data ?? []).filter((item) => {
      if (planFilter !== "all" && (item.plan ?? "free") !== planFilter) {
        return false;
      }
      const t = item.createdAt?.getTime() ?? 0;
      return t >= start && t <= end;
    });
  }, [query.data, planFilter, range]);

  const stats = React.useMemo(() => {
    const senders = new Set(filtered.map((item) => item.uid).filter(Boolean));
    const last = filtered.reduce<Date | null>(
      (latest, item) =>
        !latest || (item.createdAt?.getTime() ?? 0) > latest.getTime()
          ? (item.createdAt ?? latest)
          : latest,
      null,
    );
    return { total: filtered.length, senders: senders.size, last };
  }, [filtered]);

  const columns = React.useMemo<ColumnDef<FeedbackRecord, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Received",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "User",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">
              {row.original.email ?? "—"}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.uid}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "plan",
        header: "Plan",
        cell: ({ row }) => (
          <Badge variant="muted">{planLabel(row.original.plan)}</Badge>
        ),
      },
      {
        accessorKey: "message",
        header: "Message",
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {row.original.message}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Messages users send from the Send feedback screen in the Live Moment app. Read-only: the backend stores them, nothing is editable here."
      />

      {query.error ? (
        <ErrorState message={query.error} onRetry={query.refresh} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Messages"
              value={formatNumber(stats.total)}
              icon={MessageSquare}
              loading={query.loading}
              hint="in the selected period"
            />
            <StatCard
              label="Unique senders"
              value={formatNumber(stats.senders)}
              icon={Users}
              loading={query.loading}
            />
            <StatCard
              label="Latest message"
              value={stats.last ? formatRelative(stats.last) : "—"}
              icon={Sparkles}
              loading={query.loading}
            />
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            loading={query.loading}
            searchPlaceholder="Search messages or users…"
            emptyTitle="No feedback yet"
            emptyDescription="Messages sent from the app's Send feedback screen will appear here."
            initialPageSize={20}
            onRowClick={setSelected}
            toolbar={
              <>
                <DateRangeFilter value={range} onChange={setRange} />
                <Select
                  value={planFilter}
                  onValueChange={setPlanFilter}
                >
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_FILTERS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />
        </>
      )}

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Feedback message</SheetTitle>
                <SheetDescription>
                  {selected.email ?? selected.uid} ·{" "}
                  {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-6 pb-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">{planLabel(selected.plan)}</Badge>
                  {selected.standaloneWallpapersGranted > 0 && (
                    <Badge variant="muted">
                      {selected.standaloneWallpapersGranted} standalone
                      wallpaper
                      {selected.standaloneWallpapersGranted === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {selected.message}
                  </p>
                </div>
                <Separator />
                <p className="font-mono text-xs text-muted-foreground">
                  uid {selected.uid}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPlanFilter(selected.plan ?? "free")
                  }
                >
                  Filter by this plan
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

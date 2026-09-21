import * as React from "react";
import {
  Activity,
  BadgeDollarSign,
  CircleX,
  Image as ImageIcon,
  TrendingUp,
  UserPlus,
  Users as UsersIcon,
  Video,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DateRangeFilter, resolveDateRange } from "@/components/shared/date-range-filter";
import { ChartSkeleton } from "@/components/shared/loading-skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { GenerationStatusBadge } from "@/components/shared/status-badge";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  fetchAuditLogs,
  fetchGenerations,
  fetchUsage,
  fetchUsers,
  mergeUserStats,
} from "@/services/data-service";
import {
  breakdown,
  buildCostSeries,
  buildDailySeries,
  buildUserSeries,
  computeMetrics,
  costByKey,
} from "@/services/analytics";
import {
  formatCost,
  formatDate,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import {
  getModelDisplayName,
  getProviderDisplayName,
} from "@/data/providers";
import { planLabel } from "@/data/plans";
import type { AuditLog, DateRange, GenerationRecord } from "@/types";

const costConfig = {
  cost: { label: "AI cost", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const volumeConfig = {
  image: { label: "Image", color: "hsl(var(--chart-1))" },
  video: { label: "Video", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const outcomeConfig = {
  success: { label: "Success", color: "hsl(var(--chart-2))" },
  failed: { label: "Failed", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const usersConfig = {
  value: { label: "Signups", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DashboardPage() {
  const [range, setRange] = React.useState<DateRange>({
    preset: "30d",
    from: null,
    to: null,
  });
  const rangeDates = React.useMemo(() => resolveDateRange(range), [range]);
  const days = React.useMemo(() => {
    if (range.preset === "today") return 1;
    if (range.preset === "7d") return 7;
    if (range.preset === "30d") return 30;
    const { from, to } = rangeDates;
    if (from && to) {
      const diff = Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1;
      return Math.min(90, Math.max(1, diff));
    }
    return 30;
  }, [range.preset, rangeDates]);

  const users = useAsyncData(fetchUsers);
  const generations = useAsyncData(fetchGenerations);
  const usage = useAsyncData(fetchUsage);
  const audit = useAsyncData(fetchAuditLogs);

  const loading = users.loading || generations.loading || usage.loading;
  const error = users.error ?? generations.error ?? usage.error;

  const enrichedUsers = React.useMemo(
    () =>
      users.data && generations.data && usage.data
        ? mergeUserStats(users.data, generations.data, usage.data)
        : [],
    [users.data, generations.data, usage.data],
  );

  const metrics = React.useMemo(() => {
    if (!generations.data || !usage.data) return null;
    return computeMetrics(enrichedUsers, generations.data, usage.data);
  }, [enrichedUsers, generations.data, usage.data]);

  const series = React.useMemo(
    () => buildDailySeries(generations.data ?? [], days),
    [generations.data, days],
  );
  const userSeries = React.useMemo(
    () => buildUserSeries(enrichedUsers, days),
    [enrichedUsers, days],
  );
  // Same source (generationUsageEvents.estimatedCostUsd) as the "AI cost today"
  // card, so the chart's most recent bucket matches the card value.
  const costSeries = React.useMemo(
    () => buildCostSeries(usage.data ?? [], days),
    [usage.data, days],
  );

  const rangeFiltered = React.useMemo(() => {
    const { from, to } = rangeDates;
    if (!from || !to) return generations.data ?? [];
    const start = from.getTime();
    const end = to.getTime();
    return (generations.data ?? []).filter((g) => {
      const t = g.createdAt?.getTime() ?? 0;
      return t >= start && t <= end;
    });
  }, [generations.data, rangeDates]);

  const byPlan = React.useMemo(
    () => breakdown(rangeFiltered.map((g) => planLabel(planForGeneration(g, enrichedUsers)))),
    [rangeFiltered, enrichedUsers],
  );
  const byModel = React.useMemo(
    () =>
      costByKey(rangeFiltered, (g) => getModelDisplayName(g.model))
        .slice(0, 7)
        .map((b) => ({ name: b.name, value: b.value })),
    [rangeFiltered],
  );
  const byProvider = React.useMemo(
    () =>
      breakdown(rangeFiltered.map((g) => getProviderDisplayName(g.actualProvider ?? g.provider))),
    [rangeFiltered],
  );

  const todaysGenerations = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return (generations.data ?? []).filter(
      (g) => (g.createdAt?.getTime() ?? 0) >= start.getTime(),
    );
  }, [generations.data]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Live overview of users, generations and estimated AI cost."
        />
        <ErrorState
          message={error}
          onRetry={() => {
            void users.refresh();
            void generations.refresh();
            void usage.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live overview of Live Moment users, generation activity and estimated AI cost."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {/* Row 1 — audience and top-line activity. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={formatNumber(metrics?.totalUsers)}
          icon={UsersIcon}
          hint={`${formatNumber(metrics?.activeUsers7d)} active this week`}
          loading={loading}
        />
        <StatCard
          label="New users today"
          value={formatNumber(metrics?.newUsersToday)}
          icon={UserPlus}
          hint={`${formatNumber(metrics?.newUsers7d)} in last 7 days`}
          loading={loading}
        />
        <StatCard
          label="Generations today"
          value={formatNumber(
            (metrics?.imageGenerationsToday ?? 0) +
              (metrics?.videoGenerationsToday ?? 0),
          )}
          icon={Activity}
          hint={`${formatNumber(metrics?.imageGenerationsToday)} image · ${formatNumber(metrics?.videoGenerationsToday)} video`}
          loading={loading}
        />
        <StatCard
          label="AI cost today"
          value={formatCost(metrics?.estimatedCostToday)}
          icon={BadgeDollarSign}
          hint={`${formatCost(metrics?.estimatedCostMonth)} this month`}
          loading={loading}
        />
      </div>

      {/* Row 2 — operational generation health. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active users today"
          value={formatNumber(metrics?.activeUsersToday)}
          icon={TrendingUp}
          hint={`${formatNumber(metrics?.activeUsers7d)} in last 7 days`}
          loading={loading}
        />
        <StatCard
          label="Image generations today"
          value={formatNumber(metrics?.imageGenerationsToday)}
          icon={ImageIcon}
          loading={loading}
        />
        <StatCard
          label="Video generations today"
          value={formatNumber(metrics?.videoGenerationsToday)}
          icon={Video}
          loading={loading}
        />
        <StatCard
          label="Failed generations today"
          value={formatNumber(metrics?.failedGenerationsToday)}
          icon={CircleX}
          hint={`${formatNumber(metrics?.successfulGenerationsToday)} succeeded`}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Generations over time"
          description="Image vs video generations per day."
          loading={loading}
          config={volumeConfig}
        >
          <AreaChart data={series}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="image"
              type="monotone"
              stackId="1"
              stroke="var(--color-image)"
              fill="var(--color-image)"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Area
              dataKey="video"
              type="monotone"
              stackId="1"
              stroke="var(--color-video)"
              fill="var(--color-video)"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>

        <ChartCard
          title="New users"
          description="Daily registrations in the selected period."
          loading={loading}
          config={usersConfig}
        >
          <LineChart data={userSeries}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Success vs failure"
          description="Generation outcomes per day."
          loading={loading}
          config={outcomeConfig}
        >
          <BarChart data={series}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="success" stackId="a" fill="var(--color-success)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Generations by plan"
          description="Selected period."
          loading={loading}
          config={{ value: { label: "Generations", color: "hsl(var(--chart-1))" } }}
        >
          <BarChart data={byPlan} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Generations by model"
          description="Top models in the selected period."
          loading={loading}
          config={{ value: { label: "Generations", color: "hsl(var(--chart-3))" } }}
        >
          <BarChart data={byModel} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={150}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Generations by provider"
          description="Selected period."
          loading={loading}
          config={{ value: { label: "Generations" } }}
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie
              data={byProvider}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {byProvider.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartCard>

        <ChartCard
          title="Recent activity"
          description="Latest generations and admin changes."
          loading={audit.loading}
        >
          <RecentActivity
            generations={todaysGenerations.length ? todaysGenerations : generations.data ?? []}
            audit={audit.data ?? []}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="AI Cost Trend"
        description={`Daily estimated provider cost from usage events (USD) · last ${days} day${
          days === 1 ? "" : "s"
        }`}
        loading={loading}
        config={costConfig}
      >
        <AreaChart data={costSeries}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value) => formatCost(Number(value))}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCost(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="cost"
            type="monotone"
            stroke="var(--color-cost)"
            fill="var(--color-cost)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartCard>
    </div>
  );
}

function planForGeneration(
  generation: GenerationRecord,
  users: { uid: string; plan: string }[],
) {
  return users.find((u) => u.uid === generation.uid)?.plan ?? "free";
}

function ChartCard({
  title,
  description,
  config,
  loading,
  children,
}: {
  title: string;
  description?: string;
  config?: ChartConfig;
  loading?: boolean;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : config ? (
          <ChartContainer config={config} className="h-[260px] w-full">
            {children}
          </ChartContainer>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({
  generations,
  audit,
}: {
  generations: GenerationRecord[];
  audit: AuditLog[];
}) {
  const sorted = [...generations]
    .filter((g) => g.createdAt)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 5);

  const sortedAudit = [...audit]
    .filter((a) => a.createdAt)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 4);

  if (!sorted.length && !sortedAudit.length) {
    return (
      <EmptyState
        title="No recent activity"
        description="Activity will appear here as generations and admin changes occur."
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent generations
        </p>
        {sorted.length ? (
          sorted.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {g.userEmail ?? g.uid}
                </p>
                <p className="text-xs text-muted-foreground">
                  {g.type === "image" ? "Image" : "Video"} ·{" "}
                  {getModelDisplayName(g.model)} · {formatRelative(g.createdAt)}
                </p>
              </div>
              <GenerationStatusBadge status={g.status} />
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No generations yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent admin changes
        </p>
        {sortedAudit.length ? (
          sortedAudit.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{entry.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.target} · {formatDate(entry.createdAt)}
                </p>
              </div>
              <Badge variant="muted" className="shrink-0">
                Audit
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No configuration changes recorded.
          </p>
        )}
      </div>
    </div>
  );
}

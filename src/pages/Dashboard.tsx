import * as React from "react";
import {
  BadgeDollarSign,
  CreditCard,
  RefreshCw,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DateRangeFilter,
  resolveDateRange,
} from "@/components/shared/date-range-filter";
import { ChartSkeleton } from "@/components/shared/loading-skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  fetchGenerations,
  fetchUsage,
  fetchUsers,
  mergeUserStats,
} from "@/services/data-service";
import {
  buildCostSeries,
  buildDailySeries,
  buildUserSeries,
  computeMetrics,
} from "@/services/analytics";
import {
  fetchPurchases,
  isGrantedPurchase,
  purchaseLabel,
  purchasesInRange,
  summarizePurchases,
} from "@/services/purchases";
import {
  formatCost,
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "@/lib/format";
import { isTestAccount } from "@/lib/test-accounts";
import { isInReportingPeriod, reportingDayStart } from "@/lib/reporting";
import type { DateRange } from "@/types";

const volumeConfig = {
  image: { label: "Image", color: "hsl(var(--chart-1))" },
  video: { label: "Video", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;
const costConfig = {
  cost: { label: "AI cost (USD)", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;
const usersConfig = {
  value: { label: "Signups", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;
const poll = { pollIntervalMs: 60_000 };

export function DashboardPage() {
  const [range, setRange] = React.useState<DateRange>({
    preset: "today",
    from: null,
    to: null,
  });
  const [purchaseType, setPurchaseType] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const users = useAsyncData(fetchUsers, [], poll);
  const generations = useAsyncData(fetchGenerations, [], poll);
  const usage = useAsyncData(fetchUsage, [], poll);
  const purchases = useAsyncData(fetchPurchases, [], poll);
  const loading = users.loading || generations.loading || usage.loading;
  const error = users.error ?? generations.error ?? usage.error;
  // Resolve on every render, including background refreshes and midnight rollover.
  const rangeDates = resolveDateRange(range);
  const today = reportingDayStart();
  const now = new Date();
  const enrichedUsers = React.useMemo(
    () =>
      mergeUserStats(
        users.data ?? [],
        generations.data ?? [],
        usage.data ?? [],
      ),
    [users.data, generations.data, usage.data],
  );
  const metrics = computeMetrics(
    enrichedUsers,
    generations.data ?? [],
    usage.data ?? [],
  );
  const realUsers = enrichedUsers.filter((user) => !isTestAccount(user));
  const memberUids = new Set(
    summarizePurchases(purchases.data ?? []).subscriptions.map((p) => p.uid),
  );
  const paidMembers = realUsers.filter(
    (user) => user.plan !== "free" && memberUids.has(user.uid),
  );
  const userById = new Map(enrichedUsers.map((user) => [user.uid, user]));
  const todaysPurchases = purchasesInRange(purchases.data ?? [], today, now);
  const sales = summarizePurchases(todaysPurchases);
  const selectedPurchases = purchasesInRange(
    purchases.data ?? [],
    rangeDates.from,
    rangeDates.to,
  );
  const selectedSales = summarizePurchases(selectedPurchases);
  const filteredPurchases = selectedPurchases.filter(
    (p) =>
      purchaseType === "all" ||
      (purchaseType === "subscription"
        ? p.type === "subscription"
        : p.type === "consumable" || p.type === "non_consumable"),
  );
  const pageCount = Math.max(1, Math.ceil(filteredPurchases.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const products = [...new Set(selectedSales.granted.map((p) => p.productId))]
    .map((productId) => {
      const records = selectedSales.granted.filter(
        (p) => p.productId === productId,
      );
      return {
        productId,
        count: records.length,
        buyers: new Set(records.map((p) => p.uid)).size,
      };
    })
    .sort((a, b) => b.count - a.count);
  const days =
    range.preset === "today"
      ? 1
      : range.preset === "7d"
        ? 7
        : range.preset === "30d"
          ? 30
          : Math.max(
              1,
              Math.ceil(
                ((rangeDates.to?.getTime() ?? now.getTime()) -
                  (rangeDates.from?.getTime() ?? today.getTime())) /
                  86_400_000,
              ),
            );
  const seriesEnd = rangeDates.to ?? now;
  const series = buildDailySeries(generations.data ?? [], days, seriesEnd);
  const costSeries = buildCostSeries(usage.data ?? [], days, seriesEnd);
  const userSeries = buildUserSeries(enrichedUsers, days, seriesEnd);
  const refresh = () => {
    void users.refresh();
    void generations.refresh();
    void usage.refresh();
    void purchases.refresh();
  };
  const purchaseValue = (value: number | string) =>
    purchases.error ? "Unavailable" : String(value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Today's sales, audience and AI spend at a glance."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading || purchases.loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {error && <ErrorState message={error} onRetry={refresh} />}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">
          Today ·{" "}
          {today.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span>Daily totals · Europe/Istanbul · refreshes every minute</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue today"
          value={purchaseValue(sales.revenue)}
          icon={Wallet}
          loading={purchases.loading}
          hint={
            purchases.error
              ? "Purchase data could not be loaded"
              : sales.missingAmounts
                ? `${sales.missingAmounts} purchases have no recorded amount`
                : `${sales.granted.length} granted purchases · gross recorded amount`
          }
        />
        <StatCard
          label="AI cost today"
          value={error ? "Unavailable" : formatCost(metrics.estimatedCostToday)}
          icon={BadgeDollarSign}
          loading={loading}
          hint={`${formatCost(metrics.estimatedCostMonth)} this month · estimated USD`}
        />
        <StatCard
          label="Membership buyers today"
          value={purchaseValue(sales.subscriptionBuyers)}
          icon={CreditCard}
          loading={purchases.loading}
          hint={`${sales.subscriptions.length} subscription purchases · ${paidMembers.length} current paid-plan users`}
        />
        <StatCard
          label="New users today"
          value={
            users.error ? "Unavailable" : formatNumber(metrics.newUsersToday)
          }
          icon={UserPlus}
          loading={loading}
          hint={`${formatNumber(metrics.totalUsers)} registered since 12 Oct · test accounts excluded`}
        />
      </div>
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:divide-x">
          <div className="space-y-1 sm:pr-4">
            <p className="text-xs text-muted-foreground">
              One-time purchases today
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {purchases.loading ? "—" : purchaseValue(sales.oneTime.length)}
            </p>
            <p className="text-xs text-muted-foreground">
              {sales.oneTime.filter((p) => p.productId === "one_time_1").length}{" "}
              single wallpapers ·{" "}
              {sales.oneTime.filter((p) => p.productId === "one_time_3").length}{" "}
              3-packs
            </p>
          </div>
          <div className="space-y-1 sm:px-4">
            <p className="text-xs text-muted-foreground">Active users today</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading
                ? "—"
                : users.error
                  ? "Unavailable"
                  : metrics.activeUsersToday}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.activeUsers7d} active in the last 7 days
            </p>
          </div>
          <div className="space-y-1 sm:pl-4">
            <p className="text-xs text-muted-foreground">Generations today</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading
                ? "—"
                : error
                  ? "Unavailable"
                  : metrics.imageGenerationsToday +
                    metrics.videoGenerationsToday}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.imageGenerationsToday} image ·{" "}
              {metrics.videoGenerationsToday} video ·{" "}
              {metrics.failedGenerationsToday} failed
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <div>
          <h2 className="font-semibold">Purchase activity & trends</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The date filter applies below. Today's cards stay fixed.
          </p>
        </div>
        <DateRangeFilter
          value={range}
          onChange={(value) => {
            setRange(value);
            setPage(0);
          }}
        />
      </div>
      {purchases.error ? (
        <ErrorState
          message={`Purchases could not be loaded: ${purchases.error}`}
          onRetry={() => void purchases.refresh()}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm">Purchases</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedSales.granted.length} granted ·{" "}
                    {selectedSales.buyers} buyers · {selectedPurchases.length}{" "}
                    records in selected period
                  </p>
                </div>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label="Purchase type"
                >
                  {[
                    ["all", "All"],
                    ["subscription", "Memberships"],
                    ["one_time", "One-time"],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={purchaseType === value ? "secondary" : "ghost"}
                      aria-pressed={purchaseType === value}
                      onClick={() => {
                        setPurchaseType(value);
                        setPage(0);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {purchases.loading ? (
                  <ChartSkeleton />
                ) : !filteredPurchases.length ? (
                  <EmptyState
                    title="No purchases in this period"
                    description="Verified membership and one-time purchases will appear here."
                    className="border-0"
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer / first recorded</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchases
                          .slice(currentPage * 10, currentPage * 10 + 10)
                          .map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <Link
                                  to={`/users?uid=${encodeURIComponent(p.uid)}`}
                                  className="block max-w-[220px] truncate font-medium"
                                  title={p.uid}
                                >
                                  {userById.get(p.uid)?.email ??
                                    (p.uid || "Unknown user")}
                                </Link>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(p.purchasedAt)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="block whitespace-nowrap">
                                  {purchaseLabel(p)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {p.type === "subscription"
                                    ? "Membership"
                                    : "One-time"}
                                  {p.credits > 0
                                    ? ` · ${p.credits} credits`
                                    : ""}
                                </span>
                                {p.orderId && (
                                  <span className="block text-xs text-muted-foreground font-mono">
                                    {p.orderId}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    isGrantedPurchase(p) ? "muted" : "outline"
                                  }
                                >
                                  {p.state}
                                </Badge>
                                {p.testPurchase && (
                                  <Badge variant="outline" className="ml-1">
                                    Test
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums whitespace-nowrap">
                                {p.amount !== null && p.currency ? (
                                  formatCurrency(p.amount, p.currency)
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Not recorded
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Page {currentPage + 1} of {pageCount}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 0}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage + 1 >= pageCount}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Verified Google Play orders use their transaction dates and
                  include separate subscription renewals. Legacy records use
                  their first recorded date. Test payments, pending, cancelled
                  and refunded orders are excluded from sales totals.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Purchased products</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Granted purchases in the selected period
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {purchases.loading ? (
                  <ChartSkeleton />
                ) : !products.length ? (
                  <p className="text-sm text-muted-foreground">
                    No granted purchases.
                  </p>
                ) : (
                  products.map((product) => (
                    <div key={product.productId} className="space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span>{purchaseLabel(product)}</span>
                        <span className="font-semibold tabular-nums">
                          {product.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${(product.count / selectedSales.granted.length) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {product.buyers} unique buyers
                      </p>
                    </div>
                  ))
                )}
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Recorded revenue
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {selectedSales.revenue}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {selectedSales.missingAmounts
                      ? "Some purchases have no recoverable payment amount. Revenue is incomplete; catalog prices are not substituted for actual payments."
                      : "Gross recorded amounts, grouped by currency. Store fees and taxes are not deducted."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="AI cost"
          description="Daily estimated spend in USD from usage events."
          loading={loading}
          config={costConfig}
        >
          <AreaChart data={costSeries}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCost(Number(value))}
                />
              }
            />
            <Area
              dataKey="cost"
              dot={days === 1}
              type="linear"
              stroke="var(--color-cost)"
              fill="var(--color-cost)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>
        <ChartCard
          title="Generations"
          description="Image and video volume in the selected period."
          loading={loading}
          config={volumeConfig}
        >
          <AreaChart data={series}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              width={32}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="image"
              dot={days === 1}
              type="linear"
              stackId="1"
              stroke="var(--color-image)"
              fill="var(--color-image)"
              fillOpacity={0.2}
            />
            <Area
              dataKey="video"
              dot={days === 1}
              type="linear"
              stackId="1"
              stroke="var(--color-video)"
              fill="var(--color-video)"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ChartCard>
        <ChartCard
          title="New users"
          description="Daily registrations; test accounts excluded."
          loading={loading}
          config={usersConfig}
        >
          <LineChart data={userSeries}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              width={32}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="value"
              type="linear"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={days === 1}
            />
          </LineChart>
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Memberships since 12 Oct</CardTitle>
            <p className="text-xs text-muted-foreground">
              Paid members require a real purchase since 12 Oct; free users
              registered since 12 Oct
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["live_weather", "LiveWeather"],
              ["live_weather_plus", "LiveWeather Plus"],
              ["free", "Free"],
            ].map(([plan, label]) => (
              <div
                key={plan}
                className="flex justify-between border-b pb-3 text-sm"
              >
                <span>{label}</span>
                <span className="font-semibold tabular-nums">
                  {loading
                    ? "—"
                    : (plan === "free"
                        ? realUsers.filter((user) =>
                            isInReportingPeriod(user.createdAt),
                          )
                        : paidMembers
                      ).filter((user) => user.plan === plan).length}
                </span>
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link to="/users">View users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  config,
  loading,
  children,
}: {
  title: string;
  description: string;
  config: ChartConfig;
  loading: boolean;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ChartContainer config={config} className="h-[240px] w-full">
            {children}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

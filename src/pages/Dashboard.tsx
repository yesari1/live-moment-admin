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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  computeRangeMetrics,
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
import { amountInUsd, fetchExchangeRates, usdRevenue } from "@/services/exchange-rates";
import { reportingDayStart } from "@/lib/reporting";
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
  const [view, setView] = React.useState("trends");
  const [purchaseType, setPurchaseType] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const users = useAsyncData(fetchUsers, [], poll);
  const generations = useAsyncData(fetchGenerations, [], poll);
  const usage = useAsyncData(fetchUsage, [], poll);
  const purchases = useAsyncData(fetchPurchases, [], poll);
  const exchangeRates = useAsyncData(fetchExchangeRates, [], { pollIntervalMs: 3_600_000 });
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
  const metrics = computeRangeMetrics(
    enrichedUsers,
    generations.data ?? [],
    usage.data ?? [],
    rangeDates.from,
    rangeDates.to,
  );
  const userById = new Map(enrichedUsers.map((user) => [user.uid, user]));
  const selectedPurchases = purchasesInRange(
    purchases.data ?? [],
    rangeDates.from,
    rangeDates.to,
  );
  const selectedSales = summarizePurchases(selectedPurchases);
  const sales = selectedSales;
  const selectedUsd = usdRevenue(selectedPurchases, exchangeRates.data);
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
  const days = Math.max(
    1,
    Math.round(
      (reportingDayStart(rangeDates.to ?? now).getTime() -
        reportingDayStart(rangeDates.from ?? today).getTime()) /
        86_400_000,
    ) + 1,
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
    void exchangeRates.refresh();
  };
  const purchaseValue = (value: number | string) =>
    purchases.error ? "Unavailable" : String(value);

  const periodName = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", custom: "Custom range" }[range.preset];
  const dateLabel = (date: Date) => date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "Europe/Istanbul",
  });
  const periodDates = rangeDates.from && rangeDates.to && rangeDates.from <= rangeDates.to
    ? reportingDayStart(rangeDates.from).getTime() === reportingDayStart(rangeDates.to).getTime()
      ? dateLabel(rangeDates.from)
      : `${dateLabel(rangeDates.from)} – ${dateLabel(rangeDates.to)}`
    : "No reporting data for this period";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
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
      <section aria-label="Dashboard reporting period" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{periodName} <span className="font-normal text-muted-foreground">· {periodDates}</span></p>
          <p className="text-xs text-muted-foreground">Applies to all metrics, charts and purchases · Istanbul time</p>
        </div>
        <DateRangeFilter
          value={range}
          includeYesterday
          onChange={(value) => {
            setRange(value);
            setPage(0);
          }}
        />
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (USD)"
          value={purchaseValue(exchangeRates.loading ? "—" : selectedUsd.value)}
          icon={Wallet}
          loading={purchases.loading}
          hint={
            purchases.error
              ? "Purchase data could not be loaded"
              : sales.missingAmounts
                ? `${sales.missingAmounts} purchases have no recorded amount`
                : undefined
          }
        />
        <StatCard
          label="AI cost"
          value={error ? "Unavailable" : formatCost(metrics.estimatedCost)}
          icon={BadgeDollarSign}
          loading={loading}
          hint="Total for the selected period"
        />
        <StatCard
          label="Membership buyers"
          value={purchaseValue(sales.subscriptionBuyers)}
          icon={CreditCard}
          loading={purchases.loading}
          hint="Unique buyers in the selected period"
        />
        <StatCard
          label="New users"
          value={
            users.error ? "Unavailable" : formatNumber(metrics.newUsers)
          }
          icon={UserPlus}
          loading={loading}
        />
      </div>
      <div className="grid gap-4 rounded-lg bg-muted/30 p-4 sm:grid-cols-3 sm:divide-x">
          <div className="space-y-1 sm:pr-4">
            <p className="text-xs text-muted-foreground">
              One-time purchases
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
            <p className="text-xs text-muted-foreground">Active users</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading
                ? "—"
                : users.error
                  ? "Unavailable"
                  : metrics.activeUsers}
            </p>
            <p className="text-xs text-muted-foreground">
              Recorded activity in the selected period
            </p>
          </div>
          <div className="space-y-1 sm:pl-4">
            <p className="text-xs text-muted-foreground">Generations</p>
            <p className="text-xl font-semibold tabular-nums">
              {loading
                ? "—"
                : error
                  ? "Unavailable"
                  : metrics.imageGenerations +
                    metrics.videoGenerations}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.imageGenerations} image ·{" "}
              {metrics.videoGenerations} video ·{" "}
              {metrics.failedGenerations} failed
            </p>
          </div>
      </div>
      <Tabs value={view} onValueChange={setView} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-9">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="memberships">Memberships</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="purchases" className="mt-0">
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
                      {selectedSales.granted.length} purchases · {selectedSales.buyers} buyers
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
                      className="border-0"
                    />
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount (USD)</TableHead>
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
                                    <>
                                      <span className="block">{amountInUsd(p.amount, p.currency, exchangeRates.data) === null
                                        ? (exchangeRates.loading ? "—" : "Unavailable")
                                        : formatCurrency(amountInUsd(p.amount, p.currency, exchangeRates.data), "USD")}</span>
                                      {p.currency !== "USD" && <span className="block text-xs text-muted-foreground">{formatCurrency(p.amount, p.currency)} original</span>}
                                    </>
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
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Purchased products</CardTitle>
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
                      Revenue (USD)
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {exchangeRates.loading ? "—" : selectedUsd.value}
                    </p>
                    {selectedSales.missingAmounts > 0 && (
                      <p className="mt-2 text-xs text-warning">{selectedSales.missingAmounts} purchases missing amounts</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        </TabsContent>
        <TabsContent value="trends" className="mt-0">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title="AI cost (USD)"
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
        </div>
        </TabsContent>
        <TabsContent value="memberships" className="mt-0">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm">Membership buyers</CardTitle>
              <p className="text-xs text-muted-foreground">Unique buyers by product in the selected period</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["live_weather_monthly", "LiveWeather"],
                ["live_weather_plus_monthly", "LiveWeather Plus"],
              ].map(([plan, label]) => (
                <div
                  key={plan}
                  className="flex justify-between border-b pb-3 text-sm"
                >
                  <span>{label}</span>
                  <span className="font-semibold tabular-nums">
                    {purchases.loading
                      ? "—"
                      : purchaseValue(new Set(selectedSales.subscriptions
                          .filter((purchase) => purchase.productId === plan)
                          .map((purchase) => purchase.uid).filter(Boolean)).size)}
                  </span>
                </div>
              ))}
              <Button variant="outline" size="sm" asChild>
                <Link to="/users">View users</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartCard({
  title,
  config,
  loading,
  children,
}: {
  title: string;
  config: ChartConfig;
  loading: boolean;
  children: React.ReactElement;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[240px] min-w-0 w-full">
            {children}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

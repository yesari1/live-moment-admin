import * as React from "react";
import { RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ChartSkeleton } from "@/components/shared/loading-skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/lib/format";
import { buildFunnelRows, formatPercent } from "@/lib/funnel";
import {
  BackendError,
  backendGetAnalyticsFunnel,
  type AnalyticsFunnel,
} from "@/services/backend";

const LAUNCH_DATE = "2026-10-12";
const dailyConfig = {
  installs: { label: "Installs", color: "hsl(var(--chart-2))" },
  activeDevices: { label: "Active devices", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

type Preset = "all" | "7d" | "custom";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return date < LAUNCH_DATE ? LAUNCH_DATE : date;
}

export function FunnelPage() {
  const { getIdToken, demoMode } = useAuth();
  const [preset, setPreset] = React.useState<Preset>("all");
  const [from, setFrom] = React.useState(LAUNCH_DATE);
  const [to, setTo] = React.useState(todayIso());

  const choose = (next: Preset) => {
    setPreset(next);
    if (next === "all") {
      setFrom(LAUNCH_DATE);
      setTo(todayIso());
    } else if (next === "7d") {
      setFrom(daysAgoIso(6));
      setTo(todayIso());
    }
  };

  const invalid = from > to;
  const fetcher = React.useCallback(async (): Promise<AnalyticsFunnel | null> => {
    if (demoMode || invalid) return null;
    const token = await getIdToken();
    if (!token) throw new BackendError("Sign in again.", 401, "AUTH_REQUIRED");
    return backendGetAnalyticsFunnel(token, { from, to });
  }, [demoMode, invalid, getIdToken, from, to]);
  const state = useAsyncData(fetcher, [fetcher]);
  const data = state.data ?? undefined;
  const rows = React.useMemo(() => buildFunnelRows(data?.funnel ?? []), [data]);
  const installs = rows[0]?.devices ?? 0;
  const maxLast = Math.max(1, ...(data?.lastScreen ?? []).map((item) => item.devices));

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Funnel"
        description="Where new devices stop, from install to purchase, including people who never signed in."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void state.refresh()}
            disabled={state.loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <section
        aria-label="Funnel date range"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
      >
        <div className="flex gap-1" role="group" aria-label="Range preset">
          <Button size="sm" variant={preset === "all" ? "default" : "outline"} onClick={() => choose("all")}>
            Since launch
          </Button>
          <Button size="sm" variant={preset === "7d" ? "default" : "outline"} onClick={() => choose("7d")}>
            Last 7 days
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            aria-label="From date"
            className="h-9 rounded-md border bg-background px-2"
            value={from}
            min={LAUNCH_DATE}
            max={to}
            onChange={(event) => {
              setPreset("custom");
              setFrom(event.target.value);
            }}
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="To date"
            className="h-9 rounded-md border bg-background px-2"
            value={to}
            min={from}
            max={todayIso()}
            onChange={(event) => {
              setPreset("custom");
              setTo(event.target.value);
            }}
          />
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        User = device · data ~1 day behind · EU devices without analytics consent are not shown
      </p>
      {demoMode ? (
        <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          The App Funnel reads the Firebase Analytics BigQuery export through the backend and is not available in demo mode.
        </p>
      ) : invalid ? (
        <ErrorState message="The start date must not be after the end date." />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={() => void state.refresh()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="New devices" value={formatNumber(installs)} loading={state.loading} hint="First open in the range" />
            <StatCard
              label="Reached the paywall"
              value={formatPercent(rows.find((row) => row.key === "paywall_viewed")?.ofInstalls ?? null)}
              loading={state.loading}
              hint="Share of installs"
            />
            <StatCard
              label="Uninstalled"
              value={formatNumber(data?.uninstalled ?? 0)}
              loading={state.loading}
              hint="Devices with an app removal event"
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.loading ? (
                <ChartSkeleton />
              ) : installs === 0 ? (
                <p className="text-sm text-muted-foreground">No new devices in this range yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_4rem_5rem_5rem] gap-x-4 text-xs text-muted-foreground">
                    <span>Step</span>
                    <span className="text-right">Devices</span>
                    <span className="text-right">of previous</span>
                    <span className="text-right">of installs</span>
                  </div>
                  {rows.map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="grid grid-cols-[minmax(0,1fr)_4rem_5rem_5rem] items-baseline gap-x-4 text-sm">
                        <span className="truncate">{row.label}</span>
                        <span className="text-right font-semibold tabular-nums">{formatNumber(row.devices)}</span>
                        <span className="text-right tabular-nums text-muted-foreground">{formatPercent(row.ofPrevious)}</span>
                        <span className="text-right tabular-nums text-muted-foreground">{formatPercent(row.ofInstalls)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((row.ofInstalls ?? 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily installs and active devices</CardTitle>
              </CardHeader>
              <CardContent>
                {state.loading ? (
                  <ChartSkeleton />
                ) : (data?.daily.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No data in this range yet.</p>
                ) : (
                  <ChartContainer config={dailyConfig} className="aspect-auto h-[240px] min-w-0 w-full">
                    <LineChart data={data?.daily ?? []}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                        tickFormatter={(value: string) => value.slice(5)}
                      />
                      <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="installs" type="linear" stroke="var(--color-installs)" strokeWidth={2} dot />
                      <Line dataKey="activeDevices" type="linear" stroke="var(--color-activeDevices)" strokeWidth={2} dot />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Last screen of new devices</CardTitle>
                <p className="text-xs text-muted-foreground">Where each new device was when it was last seen</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {state.loading ? (
                  <ChartSkeleton />
                ) : (data?.lastScreen.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No data in this range yet.</p>
                ) : (
                  data?.lastScreen.map((item) => (
                    <div key={item.screen} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-mono text-xs">{item.screen}</span>
                        <span className="tabular-nums">
                          {formatNumber(item.devices)}
                          <span className="ml-2 text-muted-foreground">
                            {formatPercent(installs > 0 ? item.devices / installs : null)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.round((item.devices / maxLast) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.meta.excludedDevices} owner/test devices excluded · generated{" "}
              {new Date(data.meta.generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

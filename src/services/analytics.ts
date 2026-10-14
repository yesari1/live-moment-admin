import type {
  BreakdownPoint,
  DashboardMetrics,
  GenerationRecord,
  TimeSeriesPoint,
  UsageEvent,
} from "@/types";
import { toDate } from "@/lib/format";
import { isTestAccount, type TestAccountInput } from "@/lib/test-accounts";
import {
  isInReportingPeriod,
  reportingRecords,
  REPORTING_START_MS,
  reportingDayStart,
  reportingDateKey,
} from "@/lib/reporting";

const DAY_MS = 86_400_000;

/**
 * User fields the user-facing metrics need. Test Lab / pre-launch robot
 * accounts are excluded from every user count (generation and cost totals stay
 * untouched: robot generations are real spend).
 */
type MetricUser = TestAccountInput & {
  uid?: string;
  createdAt: Date | null;
  lastLoginAt?: Date | null;
  lastActiveAt?: Date | null;
};

/** Selected-period totals, bounded by launch and Istanbul calendar dates. */
export function computeRangeMetrics(
  users: MetricUser[],
  generations: GenerationRecord[],
  usageEvents: UsageEvent[],
  from: Date | null,
  to: Date | null,
) {
  const start = Math.max(REPORTING_START_MS, from?.getTime() ?? REPORTING_START_MS);
  const end = to?.getTime() ?? Date.now();
  const inRange = (date: Date | null | undefined) =>
    date != null && date.getTime() >= start && date.getTime() <= end;
  const selectedGenerations = generations.filter((g) => inRange(g.createdAt));
  const selectedUsage = usageEvents.filter((e) => inRange(e.startedAt));
  const activeIds = new Set([
    ...selectedGenerations.map((g) => g.uid),
    ...selectedUsage.map((e) => e.userId),
  ]);
  const realUsers = users.filter((user) => !isTestAccount(user));
  return {
    newUsers: realUsers.filter((user) => inRange(user.createdAt)).length,
    // Historical activity is retained in generation/usage events even when
    // the profile's latest activity has moved beyond the selected period.
    activeUsers: realUsers.filter((user) =>
      inRange(user.lastActiveAt) || inRange(user.lastLoginAt) ||
      (user.uid != null && activeIds.has(user.uid)),
    ).length,
    imageGenerations: selectedGenerations.filter((g) => g.type === "image").length,
    videoGenerations: selectedGenerations.filter((g) => g.type === "video").length,
    failedGenerations: selectedGenerations.filter(isFailed).length,
    estimatedCost: selectedUsage.reduce((sum, event) => sum + (event.estimatedCostUsd ?? 0), 0),
  };
}

function statusOf(record: GenerationRecord): GenerationRecord["status"] {
  return record.status;
}

function isCompleted(record: GenerationRecord) {
  return statusOf(record) === "completed";
}

function isFailed(record: GenerationRecord) {
  return statusOf(record) === "failed";
}

export function computeMetrics(
  users: MetricUser[],
  generations: GenerationRecord[],
  usageEvents: UsageEvent[],
): DashboardMetrics {
  const now = Date.now();
  const startOfToday = reportingDayStart();
  const monthStart = new Date(
    `${reportingDateKey(new Date()).slice(0, 7)}-01T00:00:00+03:00`,
  );
  generations = reportingRecords(generations, (g) => g.createdAt);
  usageEvents = reportingRecords(usageEvents, (e) => e.startedAt);

  const created = (d: Date | null | undefined) => d?.getTime() ?? 0;

  const realUsers = users.filter((user) => !isTestAccount(user));

  const todays = generations.filter(
    (g) => created(g.createdAt) >= startOfToday.getTime(),
  );
  const images = todays.filter((g) => g.type === "image");
  const videos = todays.filter((g) => g.type === "video");

  const successRate = (arr: GenerationRecord[]) => {
    const settled = arr.filter(
      (g) => g.status === "completed" || g.status === "failed",
    );
    if (!settled.length) return 100;
    return (
      (settled.filter((g) => g.status === "completed").length /
        settled.length) *
      100
    );
  };

  const costFrom = (since: number) =>
    usageEvents
      .filter((e) => created(e.startedAt) >= since)
      .reduce((sum, e) => sum + (e.estimatedCostUsd ?? 0), 0);

  return {
    totalUsers: realUsers.filter((u) => isInReportingPeriod(u.createdAt))
      .length,
    newUsersToday: realUsers.filter(
      (u) => created(u.createdAt) >= startOfToday.getTime(),
    ).length,
    newUsers7d: realUsers.filter(
      (u) =>
        created(u.createdAt) >= Math.max(REPORTING_START_MS, now - 7 * DAY_MS),
    ).length,
    activeUsersToday: realUsers.filter(
      (u) => created(u.lastActiveAt ?? u.lastLoginAt) >= startOfToday.getTime(),
    ).length,
    activeUsers7d: realUsers.filter(
      (u) =>
        created(u.lastActiveAt ?? u.lastLoginAt) >=
        Math.max(REPORTING_START_MS, now - 7 * DAY_MS),
    ).length,
    imageGenerationsToday: images.length,
    videoGenerationsToday: videos.length,
    successfulGenerationsToday: todays.filter(isCompleted).length,
    failedGenerationsToday: todays.filter(isFailed).length,
    imageSuccessRate: successRate(images),
    videoSuccessRate: successRate(videos),
    estimatedCostToday: costFrom(startOfToday.getTime()),
    estimatedCostMonth: costFrom(monthStart.getTime()),
  };
}

export function buildDailySeries(
  generations: GenerationRecord[],
  days: number,
  endDate: Date = new Date(),
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(
      reportingDayStart(endDate).getTime() - i * DAY_MS,
    );
    const start = dayStart.getTime();
    if (start < REPORTING_START_MS) continue;
    const end = start + DAY_MS;
    const inDay = generations.filter((g) => {
      const t = toDate(g.createdAt)?.getTime() ?? 0;
      return t >= start && t < end;
    });
    const image = inDay.filter((g) => g.type === "image").length;
    const video = inDay.filter((g) => g.type === "video").length;
    const success = inDay.filter(isCompleted).length;
    const failed = inDay.filter(isFailed).length;
    points.push({
      date: reportingDateKey(dayStart),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Europe/Istanbul",
      }),
      value: image + video,
      image,
      video,
      success,
      failed,
      cost: Number(
        inDay.reduce((sum, g) => sum + (g.estimatedCost ?? 0), 0).toFixed(2),
      ),
    });
  }
  return points;
}

/**
 * Daily estimated AI cost derived from the same source as
 * `computeMetrics().estimatedCostToday`: the `generationUsageEvents`
 * collection's `estimatedCostUsd` (bucketed by `startedAt`).
 */
export function buildCostSeries(
  usageEvents: UsageEvent[],
  days: number,
  endDate: Date = new Date(),
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(
      reportingDayStart(endDate).getTime() - i * DAY_MS,
    );
    const start = dayStart.getTime();
    if (start < REPORTING_START_MS) continue;
    const end = start + DAY_MS;
    const total = usageEvents.reduce((sum, event) => {
      const t = toDate(event.startedAt)?.getTime() ?? 0;
      if (t < start || t >= end) return sum;
      return sum + (event.estimatedCostUsd ?? 0);
    }, 0);
    const value = Number(total.toFixed(4));
    points.push({
      date: reportingDateKey(dayStart),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Europe/Istanbul",
      }),
      value,
      cost: value,
    });
  }
  return points;
}

export function buildUserSeries(
  users: MetricUser[],
  days: number,
  endDate: Date = new Date(),
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const realUsers = users.filter((user) => !isTestAccount(user));
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(
      reportingDayStart(endDate).getTime() - i * DAY_MS,
    );
    const start = dayStart.getTime();
    if (start < REPORTING_START_MS) continue;
    const end = start + DAY_MS;
    const value = realUsers.filter((u) => {
      const t = u.createdAt?.getTime() ?? 0;
      return t >= start && t < end;
    }).length;
    points.push({
      date: reportingDateKey(dayStart),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Europe/Istanbul",
      }),
      value,
    });
  }
  return points;
}

export function breakdown<T extends string>(items: T[]): BreakdownPoint[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function costByKey(
  generations: GenerationRecord[],
  key: (g: GenerationRecord) => string,
): BreakdownPoint[] {
  const totals = new Map<string, { value: number; cost: number }>();
  for (const g of generations) {
    const k = key(g) || "unknown";
    const current = totals.get(k) ?? { value: 0, cost: 0 };
    current.value += 1;
    current.cost += g.estimatedCost ?? 0;
    totals.set(k, current);
  }
  return [...totals.entries()]
    .map(([name, { value, cost }]) => ({
      name,
      value,
      cost: Number(cost.toFixed(2)),
    }))
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
}

import type {
  BreakdownPoint,
  DashboardMetrics,
  GenerationRecord,
  TimeSeriesPoint,
  UsageEvent,
} from "@/types";
import { toDate } from "@/lib/format";

const DAY_MS = 86_400_000;

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
  users: { createdAt: Date | null; lastLoginAt?: Date | null; lastActiveAt?: Date | null }[],
  generations: GenerationRecord[],
  usageEvents: UsageEvent[],
): DashboardMetrics {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const created = (d: Date | null | undefined) => d?.getTime() ?? 0;

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
      (settled.filter((g) => g.status === "completed").length / settled.length) *
      100
    );
  };

  const costFrom = (since: number) =>
    usageEvents
      .filter((e) => created(e.startedAt) >= since)
      .reduce((sum, e) => sum + (e.estimatedCostUsd ?? 0), 0);

  return {
    totalUsers: users.length,
    newUsersToday: users.filter((u) => created(u.createdAt) >= startOfToday.getTime())
      .length,
    newUsers7d: users.filter((u) => created(u.createdAt) >= now - 7 * DAY_MS)
      .length,
    activeUsersToday: users.filter(
      (u) => created(u.lastActiveAt ?? u.lastLoginAt) >= startOfToday.getTime(),
    ).length,
    activeUsers7d: users.filter(
      (u) => created(u.lastActiveAt ?? u.lastLoginAt) >= now - 7 * DAY_MS,
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
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const start = dayStart.getTime();
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
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: image + video,
      image,
      video,
      success,
      failed,
      cost: Number(
        inDay
          .reduce((sum, g) => sum + (g.estimatedCost ?? 0), 0)
          .toFixed(2),
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
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const start = dayStart.getTime();
    const end = start + DAY_MS;
    const total = usageEvents.reduce((sum, event) => {
      const t = toDate(event.startedAt)?.getTime() ?? 0;
      if (t < start || t >= end) return sum;
      return sum + (event.estimatedCostUsd ?? 0);
    }, 0);
    const value = Number(total.toFixed(4));
    points.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value,
      cost: value,
    });
  }
  return points;
}

export function buildUserSeries(
  users: { createdAt: Date | null }[],
  days: number,
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const start = dayStart.getTime();
    const end = start + DAY_MS;
    const value = users.filter((u) => {
      const t = u.createdAt?.getTime() ?? 0;
      return t >= start && t < end;
    }).length;
    points.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value,
    });
  }
  return points;
}

export function breakdown<T extends string>(
  items: T[],
): BreakdownPoint[] {
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

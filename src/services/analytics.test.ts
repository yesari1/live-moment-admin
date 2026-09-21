import { describe, expect, it } from "vitest";
import { buildCostSeries, computeMetrics } from "@/services/analytics";
import type { UsageEvent } from "@/types";

function event(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    id: "usage_1",
    userId: "u1",
    jobId: "j1",
    templateId: null,
    stage: "image",
    provider: "pixazo",
    model: "pixazo_nano_banana_pro",
    status: "success",
    estimatedCostUsd: 0,
    estimatedCostTry: null,
    durationSeconds: null,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    ...overrides,
  };
}

describe("buildCostSeries", () => {
  it("buckets usage cost by local day and sums empty days to zero", () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(10, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);

    const events = [
      event({ id: "a", startedAt: today, estimatedCostUsd: 0.5 }),
      event({ id: "b", startedAt: today, estimatedCostUsd: 0.25 }),
      event({ id: "c", startedAt: yesterday, estimatedCostUsd: 1.5 }),
    ];

    const series = buildCostSeries(events, 7);
    expect(series).toHaveLength(7);
    // Oldest->newest; only the last two days have data.
    expect(series[0].cost).toBe(0);
    expect(series[5].cost).toBe(1.5);
    expect(series[6].cost).toBe(0.75);
  });

  it("uses the same source as the metrics cost and matches today's total", () => {
    const today = new Date();
    today.setHours(9, 30, 0, 0);

    const events = [
      event({ id: "a", startedAt: today, estimatedCostUsd: 0.1 }),
      event({ id: "b", startedAt: today, estimatedCostUsd: 0.2 }),
    ];

    const series = buildCostSeries(events, 1);
    const metrics = computeMetrics([], [], events);

    expect(series).toHaveLength(1);
    expect(series[0].cost).toBeCloseTo(metrics.estimatedCostToday, 6);
  });

  it("ignores events without a start date", () => {
    const series = buildCostSeries(
      [event({ id: "a", startedAt: null, estimatedCostUsd: 9 })],
      1,
    );
    expect(series[0].cost).toBe(0);
  });
});

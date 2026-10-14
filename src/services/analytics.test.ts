import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00+03:00"));
});
afterEach(() => vi.useRealTimers());
import {
  buildDailySeries,
  buildCostSeries,
  buildUserSeries,
  computeMetrics,
  computeRangeMetrics,
} from "@/services/analytics";

it("anchors all trend charts to a historical custom range", () => {
  const end = new Date("2026-10-20T23:59:59+03:00");
  const recordDate = new Date("2026-10-19T12:00:00+03:00");
  const cost = buildCostSeries(
    [event({ startedAt: recordDate, estimatedCostUsd: 1.25 })],
    2,
    end,
  );
  const signups = buildUserSeries([user({ createdAt: recordDate })], 2, end);
  const volume = buildDailySeries(
    [generation({ createdAt: recordDate })],
    2,
    end,
  );
  expect(cost.map((p) => p.cost)).toEqual([1.25, 0]);
  expect(signups.map((p) => p.value)).toEqual([1, 0]);
  expect(volume.map((p) => p.value)).toEqual([1, 0]);
  expect(cost[1].label).toBe("Oct 20");
});
import type { GenerationRecord, TestDeviceLabel, UsageEvent } from "@/types";

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

interface MetricUser {
  uid?: string;
  createdAt: Date | null;
  lastLoginAt?: Date | null;
  lastActiveAt?: Date | null;
  testDevice?: TestDeviceLabel | null;
  plan?: "free" | "live_weather" | "live_weather_plus";
  billingVerified?: boolean;
}

function user(overrides: Partial<MetricUser> = {}): MetricUser {
  return { createdAt: new Date(), ...overrides };
}

function generation(
  overrides: Partial<GenerationRecord> = {},
): GenerationRecord {
  return {
    id: "gen_1",
    uid: "u1",
    userEmail: null,
    type: "image",
    routingContext: null,
    status: "completed",
    rawStatus: "ready",
    provider: null,
    actualProvider: null,
    model: null,
    imageModelId: null,
    videoModelId: null,
    primaryProvider: null,
    primaryModel: null,
    fallbackProvider: null,
    fallbackModel: null,
    fallbackUsed: false,
    providerRequestId: null,
    retryCount: 0,
    presetId: null,
    personType: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    estimatedCost: null,
    currency: "USD",
    errorCode: null,
    errorMessage: null,
    timeout: false,
    ...overrides,
  };
}

const deviceLabel: TestDeviceLabel = { kind: "device", since: null };
const suspectedLabel: TestDeviceLabel = { kind: "suspected", since: null };

describe("selected-period dashboard metrics", () => {
  it("includes both endpoints, excludes other days and keeps historical activity after a later login", () => {
    const from = new Date("2026-10-19T00:00:00+03:00");
    const to = new Date("2026-10-19T23:59:59.999+03:00");
    const after = new Date(to.getTime() + 1);
    const result = computeRangeMetrics([
      user({ uid: "u1", createdAt: from, lastActiveAt: after }),
      user({ uid: "u2", createdAt: to, lastLoginAt: to }),
      user({ uid: "u3", createdAt: after, lastActiveAt: after }),
      user({ uid: "test", createdAt: from, lastActiveAt: from, testDevice: deviceLabel }),
    ], [
      generation({ createdAt: from }),
      generation({ uid: "u2", createdAt: to, type: "video", status: "failed" }),
      generation({ createdAt: after }),
      generation({ createdAt: new Date(from.getTime() - 1) }),
    ], [
      event({ startedAt: from, estimatedCostUsd: 0.25 }),
      event({ startedAt: to, estimatedCostUsd: 0.5 }),
      event({ startedAt: after, estimatedCostUsd: 9 }),
    ], from, to);
    expect(result).toEqual({ newUsers: 2, activeUsers: 2, imageGenerations: 1,
      videoGenerations: 1, failedGenerations: 1, estimatedCost: 0.75 });
  });

  it("honors launch boundaries, includes test generation spend and returns zero for empty periods", () => {
    const from = new Date("2026-10-01T00:00:00+03:00");
    const launch = new Date("2026-10-12T00:00:00+03:00");
    const result = computeRangeMetrics([user({ uid: "u1", createdAt: launch, testDevice: deviceLabel })],
      [generation({ createdAt: launch })], [
        event({ startedAt: from, estimatedCostUsd: 9 }),
        event({ startedAt: launch, estimatedCostUsd: 0.5 }),
      ], from, launch);
    expect(result.newUsers).toBe(0);
    expect(result.activeUsers).toBe(0);
    expect(result.imageGenerations).toBe(1);
    expect(result.estimatedCost).toBe(0.5);
    expect(computeRangeMetrics([], [], [], from, from).estimatedCost).toBe(0);
  });
});

describe("computeMetrics test account exclusion", () => {
  it("excludes labelled accounts from every user count", () => {
    const today = new Date();
    const users: MetricUser[] = [
      user({ createdAt: today, lastActiveAt: today }),
      user({ createdAt: today, lastActiveAt: today, testDevice: deviceLabel }),
      user({
        createdAt: today,
        lastActiveAt: today,
        testDevice: suspectedLabel,
      }),
    ];

    const metrics = computeMetrics(users, [], []);

    expect(metrics.totalUsers).toBe(1);
    expect(metrics.newUsersToday).toBe(1);
    expect(metrics.newUsers7d).toBe(1);
    expect(metrics.activeUsersToday).toBe(1);
    expect(metrics.activeUsers7d).toBe(1);
  });

  it("counts a mislabelled paid account as a real user", () => {
    const users: MetricUser[] = [
      user({
        plan: "live_weather_plus",
        billingVerified: true,
        testDevice: suspectedLabel,
      }),
    ];

    expect(computeMetrics(users, [], []).totalUsers).toBe(1);
  });

  it("keeps a labelled account's generations and cost in the totals", () => {
    const startedAt = new Date();
    startedAt.setHours(9, 0, 0, 0);
    const users: MetricUser[] = [user({ testDevice: deviceLabel })];
    const generations = [generation({ uid: "u1", createdAt: startedAt })];
    const events = [event({ startedAt, estimatedCostUsd: 0.5 })];

    const metrics = computeMetrics(users, generations, events);

    expect(metrics.totalUsers).toBe(0);
    expect(metrics.imageGenerationsToday).toBe(1);
    expect(metrics.estimatedCostToday).toBeCloseTo(0.5, 6);
  });
});

describe("buildUserSeries test account exclusion", () => {
  it("does not count labelled registrations", () => {
    const today = new Date();
    const series = buildUserSeries(
      [
        user({ createdAt: today }),
        user({ createdAt: today, testDevice: deviceLabel }),
        user({ createdAt: today, testDevice: suspectedLabel }),
      ],
      1,
    );

    expect(series).toHaveLength(1);
    expect(series[0].value).toBe(1);
  });
});

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

import { describe, expect, it } from "vitest";
import {
  buildCostSeries,
  buildUserSeries,
  computeMetrics,
} from "@/services/analytics";
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

function generation(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
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

describe("computeMetrics test account exclusion", () => {
  it("excludes labelled accounts from every user count", () => {
    const today = new Date();
    const users: MetricUser[] = [
      user({ createdAt: today, lastActiveAt: today }),
      user({ createdAt: today, lastActiveAt: today, testDevice: deviceLabel }),
      user({ createdAt: today, lastActiveAt: today, testDevice: suspectedLabel }),
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

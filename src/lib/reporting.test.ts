import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isInReportingPeriod,
  REPORTING_START_MS,
  reportingDateKey,
  reportingDayStart,
  reportingRecords,
} from "./reporting";
import { resolveDateRange } from "@/components/shared/date-range-filter";
import {
  mapGeneration,
  mapUsageEvent,
  mapUser,
} from "@/services/firestore-repo";
import { mergeUserStats } from "@/services/data-service";
import {
  buildCostSeries,
  buildDailySeries,
  buildUserSeries,
  computeMetrics,
} from "@/services/analytics";
import { mapPurchase, summarizePurchases } from "@/services/purchases";

afterEach(() => vi.useRealTimers());
const before = new Date(REPORTING_START_MS - 1);
const launch = new Date(REPORTING_START_MS);
const clock = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T12:00:00+03:00"));
};

describe("launch reporting boundary", () => {
  it("includes exactly Istanbul midnight, excludes the preceding millisecond and unknown dates", () => {
    expect(isInReportingPeriod(before)).toBe(false);
    expect(isInReportingPeriod(launch)).toBe(true);
    expect(isInReportingPeriod("2026-10-11T21:00:00Z")).toBe(true);
    expect(isInReportingPeriod(null)).toBe(false);
    expect(isInReportingPeriod("invalid")).toBe(false);
    expect(reportingRecords([before, launch], (d) => d)).toEqual([launch]);
    expect(reportingDateKey(launch)).toBe("2026-10-12");
    expect(reportingDayStart(new Date("2026-10-12T23:30:00+03:00"))).toEqual(
      launch,
    );
  });
  it("clamps presets and custom ranges without ever including prelaunch dates", () => {
    clock();
    for (const preset of ["today", "7d", "30d", "custom"] as const) {
      const range = resolveDateRange({ preset, from: before, to: new Date() });
      expect(range.from).toEqual(launch);
    }
  });
  it("resolves yesterday to the complete preceding Istanbul day", () => {
    clock();
    vi.setSystemTime(new Date("2026-10-14T00:15:00+03:00"));
    const range = resolveDateRange({ preset: "yesterday", from: null, to: null });
    expect(range.from).toEqual(new Date("2026-10-13T00:00:00+03:00"));
    expect(range.to).toEqual(new Date("2026-10-13T23:59:59.999+03:00"));
  });
  it("keeps legacy users and their credits while rebuilding all generation and cost counters", () => {
    const user = mapUser("u", {
      createdAt: before,
      imageGenerationCount: 99,
      videoGenerationCount: 50,
      failedGenerationCount: 3,
      estimatedTotalCost: 100,
      standaloneWallpapersGranted: 7,
    });
    const old = mapGeneration("old", {
      uid: "u",
      type: "image",
      createdAt: before,
      completedAt: new Date(REPORTING_START_MS + 1000),
      status: "ready",
    });
    const image = mapGeneration("new", {
      uid: "u",
      type: "image",
      createdAt: launch,
      status: "ready",
    });
    const video = mapGeneration("video", {
      uid: "u",
      type: "video",
      createdAt: launch,
      status: "failed",
    });
    const usage = [
      mapUsageEvent("old", {
        userId: "u",
        startedAt: before,
        estimatedCostUsd: 99,
      }),
      mapUsageEvent("new", {
        userId: "u",
        startedAt: launch,
        estimatedCostUsd: 0.35,
      }),
    ];
    const [result] = mergeUserStats([user], [old, image, video], usage);
    expect(result.uid).toBe("u");
    expect(result.createdAt).toEqual(before);
    expect(result.credits).toBe(7);
    expect([
      result.imageGenerationCount,
      result.videoGenerationCount,
      result.failedGenerationCount,
      result.estimatedTotalCost,
    ]).toEqual([1, 1, 1, 0.35]);
    const [empty] = mergeUserStats([user], [old], [usage[0]]);
    expect([
      empty.imageGenerationCount,
      empty.videoGenerationCount,
      empty.estimatedTotalCost,
    ]).toEqual([0, 0, 0]);
  });
  it("counts new registrations but includes legacy users who are active after launch", () => {
    clock();
    const old = mapUser("old", { createdAt: before, lastActiveAt: launch });
    const fresh = mapUser("new", { createdAt: launch, lastActiveAt: launch });
    const metrics = computeMetrics([old, fresh], [], []);
    expect(metrics.totalUsers).toBe(1);
    expect(metrics.newUsers7d).toBe(1);
    expect(metrics.activeUsers7d).toBe(2);
  });
  it("removes prelaunch chart buckets and excludes their costs even in 30-day views", () => {
    clock();
    const usage = [
      mapUsageEvent("old", { startedAt: before, estimatedCostUsd: 99 }),
      mapUsageEvent("new", { startedAt: launch, estimatedCostUsd: 0.35 }),
    ];
    const volume = buildDailySeries([], 30);
    const costs = buildCostSeries(usage, 30);
    const users = buildUserSeries(
      [
        mapUser("old", { createdAt: before }),
        mapUser("new", { createdAt: launch }),
      ],
      30,
    );
    expect(volume.map((p) => p.date)).toEqual(["2026-10-12"]);
    expect(costs.map((p) => p.value)).toEqual([0.35]);
    expect(users.map((p) => p.value)).toEqual([1]);
    expect(computeMetrics([], [], usage).estimatedCostMonth).toBe(0.35);
    expect(buildDailySeries([], 30, before)).toEqual([]);
  });
  it("keeps test orders out of revenue while retaining the real October 12 transaction", () => {
    const records = [
      mapPurchase("test", {
        firstSeenAt: before,
        testPurchase: true,
        purchaseState: "purchased",
        amount: 589.99,
        currency: "TRY",
      }),
      mapPurchase("real", {
        firstSeenAt: launch,
        purchaseState: "purchased",
        amount: 13.99,
        currency: "PLN",
      }),
    ];
    const report = reportingRecords(records, (p) => p.purchasedAt);
    expect(report.map((p) => p.id)).toEqual(["real"]);
    expect(summarizePurchases(report).revenue).toContain("13.99");
  });
});

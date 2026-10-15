import { describe, expect, it } from "vitest";
import { mapGeneration, mapUsageEvent } from "@/services/firestore-repo";
import { applyGenerationCostOverrides, validateGenerationCost } from "./generation-costs";
import { applyGenerationPrices, applyUsagePrices } from "./model-pricing";
import { computeRangeMetrics } from "@/services/analytics";

const createdAt = new Date("2026-10-15T12:00:00Z");
const job = mapGeneration("job", { uid: "user", type: "image", status: "failed", createdAt, estimatedCost: 0 });
const leg = mapUsageEvent("leg", { jobId: "job", userId: "user", status: "failure", estimatedCostUsd: 0, startedAt: createdAt });

describe("manual generation costs", () => {
  it("charges failed jobs while preserving their status and source data", () => {
    const result = applyGenerationCostOverrides([job], [leg], { job: 0.04 });
    expect(result.generations[0].estimatedCost).toBe(0.04);
    expect(result.generations[0].status).toBe("failed");
    expect(result.events[0].estimatedCostUsd).toBe(0.04);
    expect(result.events[0].status).toBe("failure");
    expect(leg.estimatedCostUsd).toBe(0);
    expect(computeRangeMetrics([], result.generations, result.events, createdAt, createdAt).estimatedCost).toBe(0.04);
  });
  it("accepts zero and consistently reduces multi-leg totals", () => {
    const events = [{ ...leg, estimatedCostUsd: 0.04 }, { ...leg, id: "video", stage: "video" as const, estimatedCostUsd: 0.4 }];
    for (const cost of [0, 0.22]) {
      const result = applyGenerationCostOverrides([job], events, { job: cost });
      expect(result.events.reduce((sum, event) => sum + event.estimatedCostUsd!, 0)).toBeCloseTo(cost, 12);
      expect(result.generations[0].costEvents).toHaveLength(2);
    }
  });
  it("includes manual costs in reporting even without any usage events", () => {
    const result = applyGenerationCostOverrides([job], [], { job: 0.05 });
    expect(result.events[0]).toMatchObject({ userId: job.uid, jobId: "job", startedAt: createdAt, estimatedCostUsd: 0.05 });
    expect(result.generations[0].costEvents).toHaveLength(1);
  });
  it("takes precedence over model pricing, leaves unrelated jobs untouched", () => {
    const completed = { ...job, status: "completed" as const, model: "image" };
    const prices = { image: { type: "image" as const, mode: "per_image" as const, amountUsd: 0.9, fixedDurationSeconds: null, effectiveFrom: 1 } };
    const events = applyUsagePrices([{ ...leg, model: "image", status: "success" }], prices, [completed]);
    const repriced = applyGenerationPrices([completed, { ...completed, id: "other" }], events, prices);
    const result = applyGenerationCostOverrides(repriced, events, { job: 0 });
    expect(result.generations[0].estimatedCost).toBe(0);
    expect(result.events[0].estimatedCostUsd).toBe(0);
    expect(result.generations[1]).toBe(repriced[1]);
  });
  it("rejects negative and non-finite amounts", () => {
    for (const cost of [-1, Infinity, NaN]) expect(() => validateGenerationCost(cost)).toThrow();
  });
});

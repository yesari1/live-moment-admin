import { describe, expect, it } from "vitest";
import { applyGenerationPrices, applyUsagePrices, estimateModelCost, priceAt, validateModelPrice, type ModelPrices } from "./model-pricing";
import { mapGeneration, mapUsageEvent } from "@/services/firestore-repo";

const prices: ModelPrices = {
  image: { type: "image", mode: "per_image", amountUsd: 0.04, fixedDurationSeconds: null, effectiveFrom: 1000 },
  video: { type: "video", mode: "per_second", amountUsd: 0.2, fixedDurationSeconds: null, effectiveFrom: 1000 },
};
describe("editable model prices", () => {
  it("bills a six-second MiniMax video rather than 124.75 seconds of processing", () => {
    const model = "pixazo_minimax_h3_max_turbo";
    const videoPrices: ModelPrices = { [model]: { ...prices.video, amountUsd: 0.08 } };
    const generation = mapGeneration("job", { type: "video", status: "ready", videoModelId: model,
      outputDurationMs: 6000, createdAt: new Date(2000), estimatedCost: 9.98 });
    const events = [mapUsageEvent("video-leg", { jobId: "job", model, stage: "video",
      requestedDurationSeconds: "6", durationSeconds: 124.75, estimatedCostUsd: 9.98 })];
    const repriced = applyUsagePrices(events, videoPrices, [generation]);
    expect(repriced[0].durationSeconds).toBe(124.75);
    expect(repriced[0].estimatedCostUsd).toBe(0.48);
    expect(applyGenerationPrices([generation], repriced, videoPrices)[0].estimatedCost).toBe(0.48);
    expect(applyGenerationPrices([generation], [], videoPrices)[0].estimatedCost).toBe(0.48);
  });
  it("falls back to matching output length, never processing time or another model's output", () => {
    const generation = mapGeneration("job", { type: "video", status: "completed", videoModelId: "video",
      outputDurationMs: 6000, createdAt: new Date(2000) });
    const event = mapUsageEvent("leg", { jobId: "job", model: "video", stage: "video",
      durationSeconds: 125, estimatedCostUsd: 9.98 });
    const repriced = applyUsagePrices([event], prices, [generation]);
    expect(repriced[0].estimatedCostUsd).toBe(1.2);
    expect(applyGenerationPrices([generation], repriced, prices)[0].estimatedCost).toBe(1.2);
    for (const job of [{ ...generation, durationMs: null }, { ...generation, model: "fallback" },
      { ...generation, status: "processing" as const }]) {
      expect(applyUsagePrices([event], prices, [job])[0].estimatedCostUsd).toBe(9.98);
    }
  });
  it("prices images, per-second videos, fixed videos and free models", () => {
    expect(estimateModelCost(prices.image, "image", null)).toBe(0.04);
    expect(estimateModelCost(prices.video, "video", 5)).toBe(1);
    expect(estimateModelCost({ ...prices.video, mode: "fixed", fixedDurationSeconds: 5 }, "video", 8)).toBe(0.2);
    expect(estimateModelCost({ ...prices.image, amountUsd: 0 }, "image", null)).toBe(0);
    expect(estimateModelCost(prices.video, "video", null)).toBeNull();
    expect(estimateModelCost(prices.image, "video", 5)).toBeNull();
  });
  it("rejects negative, non-finite and incompatible prices", () => {
    for (const amountUsd of [-1, NaN, Infinity])
      expect(() => validateModelPrice({ ...prices.image, amountUsd })).toThrow();
    expect(() => validateModelPrice({ ...prices.image, mode: "per_second" })).toThrow();
    expect(() => validateModelPrice({ ...prices.video, mode: "fixed", fixedDurationSeconds: 0 })).toThrow();
  });
  it("recalculates all job legs and overrides stale job totals", () => {
    const events = [
      mapUsageEvent("image-leg", { jobId: "job", model: "image", stage: "image", estimatedCostUsd: 99 }),
      mapUsageEvent("video-leg", { jobId: "job", model: "video", stage: "video", requestedDurationSeconds: 5, durationSeconds: 125, estimatedCostUsd: 99 }),
    ];
    const generation = mapGeneration("job", { type: "video", status: "completed", estimatedCost: 99, createdAt: new Date(2000) });
    const result = applyGenerationPrices([generation], applyUsagePrices(events, prices, [generation]), prices)[0];
    expect(result.estimatedCost).toBe(1.04);
    expect(result.costEvents?.map(event => event.estimatedCostUsd)).toEqual([0.04, 1]);
  });
  it("preserves recorded charges for failures, unknown models and missing duration", () => {
    const generation = mapGeneration("job", { createdAt: new Date(2000) });
    const events = [
      mapUsageEvent("failed", { jobId: "job", model: "video", stage: "video", status: "failure", requestedDurationSeconds: 5, durationSeconds: 125, estimatedCostUsd: 0 }),
      mapUsageEvent("unknown", { jobId: "job", model: "legacy", estimatedCostUsd: 0.3 }),
      mapUsageEvent("no-duration", { jobId: "job", model: "video", stage: "video", durationSeconds: 125, estimatedCostUsd: 0.5 }),
    ];
    expect(applyUsagePrices(events, prices, [generation]).map(event => event.estimatedCostUsd)).toEqual([0, 0.3, 0.5]);
  });
  it("charges fixed video prices once even without a billable duration", () => {
    const generation = mapGeneration("job", { type: "video", createdAt: new Date(2000) });
    const event = mapUsageEvent("leg", { jobId: "job", model: "video", stage: "video", durationSeconds: 125 });
    expect(applyUsagePrices([event], { video: { ...prices.video, mode: "fixed", amountUsd: 0.4 } },
      [generation])[0].estimatedCostUsd).toBe(0.4);
  });
  it("does not present a partial repriced job total as the complete cost", () => {
    const events = [mapUsageEvent("a", { jobId: "job", model: "image", stage: "image" }),
      mapUsageEvent("b", { jobId: "job", model: "unknown", stage: "video" })];
    const generation = mapGeneration("job", { createdAt: new Date(2000) });
    expect(applyGenerationPrices([generation], applyUsagePrices(events, prices, [generation]), prices)[0].estimatedCost).toBeNull();
  });
  it("keeps jobs before the first save and in-progress job legs at their recorded prices", () => {
    const generation = mapGeneration("job", { createdAt: new Date(500), estimatedCost: 2 });
    const event = mapUsageEvent("later-leg", { jobId: "job", stage: "video", model: "video", requestedDurationSeconds: 5, durationSeconds: 125, startedAt: new Date(3000), estimatedCostUsd: 2 });
    const repriced = applyUsagePrices([event], prices, [generation]);
    expect(repriced[0].estimatedCostUsd).toBe(2);
    expect(applyGenerationPrices([generation], repriced, prices)[0].estimatedCost).toBe(2);
  });
  it("uses the price active at creation through multiple later changes", () => {
    const changed = { ...prices.video, effectiveFrom: 5000, amountUsd: 0.8, history: [prices.video] };
    expect(priceAt(changed, new Date(500))).toBeUndefined();
    expect(priceAt(changed, null)).toBeUndefined();
    expect(priceAt(changed, new Date(2000))?.amountUsd).toBe(0.2);
    expect(priceAt(changed, new Date(5000))?.amountUsd).toBe(0.8);
    const generation = mapGeneration("job", { createdAt: new Date(2000) });
    const event = mapUsageEvent("leg", { jobId: "job", model: "video", stage: "video", requestedDurationSeconds: 5, durationSeconds: 125, estimatedCostUsd: 99 });
    expect(applyUsagePrices([event], { video: changed }, [generation])[0].estimatedCostUsd).toBe(1);
  });
  it("retains recorded costs when the job creation date cannot be verified", () => {
    const event = mapUsageEvent("leg", { jobId: "missing", model: "video", stage: "video", requestedDurationSeconds: 5, durationSeconds: 125, startedAt: new Date(6000), estimatedCostUsd: 3 });
    expect(applyUsagePrices([event], prices)[0].estimatedCostUsd).toBe(3);
  });
});

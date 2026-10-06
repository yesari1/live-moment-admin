import type { GenerationRecord, GenerationType, UsageEvent } from "@/types";

export interface ModelPrice {
  type: GenerationType;
  mode: "per_image" | "per_second" | "fixed";
  amountUsd: number;
  fixedDurationSeconds: number | null;
  effectiveFrom?: number;
  history?: Omit<ModelPrice, "history">[];
}

export type ModelPrices = Record<string, ModelPrice>;

/** Select the price that was active when the job was created. */
export function priceAt(price: ModelPrice | undefined, createdAt: Date | null): ModelPrice | undefined {
  if (!price || !createdAt || price.effectiveFrom === undefined) return undefined;
  const time = createdAt.getTime();
  return [...(price.history ?? []), price]
    .filter(version => version.effectiveFrom !== undefined && version.effectiveFrom <= time)
    .sort((a, b) => b.effectiveFrom! - a.effectiveFrom!)[0];
}

export function validateModelPrice(price: ModelPrice): void {
  if (!Number.isFinite(price.amountUsd) || price.amountUsd < 0)
    throw new Error("Enter a valid, non-negative USD price.");
  if (price.type === "image" ? price.mode !== "per_image" :
    price.type !== "video" || !["fixed", "per_second"].includes(price.mode))
    throw new Error("Choose a valid billing method for this model.");
  if (price.fixedDurationSeconds !== null &&
    (!Number.isFinite(price.fixedDurationSeconds) || price.fixedDurationSeconds <= 0))
    throw new Error("Fixed video duration must be greater than zero.");
}

export function estimateModelCost(price: ModelPrice | undefined, type: GenerationType,
  durationSeconds: number | null): number | null {
  if (!price || price.type !== type) return null;
  if (price.mode !== "per_second") return price.amountUsd;
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return Number((price.amountUsd * durationSeconds).toFixed(8));
}

export function applyUsagePrices(events: UsageEvent[], prices: ModelPrices,
  generations: GenerationRecord[] = []): UsageEvent[] {
  const created = new Map(generations.map(job => [job.id, job.createdAt]));
  return events.map(event => {
    // Failed calls retain their recorded charge; a model's normal price cannot
    // tell us whether a provider charged for a failed attempt.
    if (event.status !== "success" || !created.has(event.jobId)) return event;
    const cost = estimateModelCost(priceAt(prices[event.model],
      created.get(event.jobId)!), event.stage, event.durationSeconds);
    return cost === null ? event : { ...event, estimatedCostUsd: cost, estimatedCostTry: null };
  });
}

export function applyGenerationPrices(generations: GenerationRecord[], events: UsageEvent[],
  prices: ModelPrices): GenerationRecord[] {
  const byJob = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const list = byJob.get(event.jobId) ?? [];
    list.push(event);
    byJob.set(event.jobId, list);
  }
  return generations.map(generation => {
    const legs = byJob.get(generation.id);
    if (legs?.length) {
      const repriced = legs.some(event => event.status === "success" &&
        estimateModelCost(priceAt(prices[event.model], generation.createdAt), event.stage, event.durationSeconds) !== null);
      const costs = legs.map(event => event.estimatedCostUsd).filter((cost): cost is number => cost !== null);
      return { ...generation, costEvents: legs, estimatedCost: repriced
        ? (costs.length === legs.length ? costs.reduce((a, b) => a + b, 0) : null)
        : generation.estimatedCost ?? (costs.length ? costs.reduce((a, b) => a + b, 0) : null) };
    }
    const cost = generation.status === "completed" ? estimateModelCost(
      priceAt(generation.model ? prices[generation.model] : undefined, generation.createdAt), generation.type,
      generation.durationMs === null ? null : generation.durationMs / 1000) : null;
    return cost === null ? generation : { ...generation, estimatedCost: cost };
  });
}

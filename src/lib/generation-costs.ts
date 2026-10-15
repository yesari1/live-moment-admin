import type { GenerationRecord, UsageEvent } from "@/types";

export type GenerationCosts = Record<string, number>;

export function validateGenerationCost(cost: number): void {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Enter a valid, non-negative USD amount.");
}

/** Keep reporting totals consistent with the operator's job total. */
export function applyGenerationCostOverrides(
  generations: GenerationRecord[], events: UsageEvent[], overrides: GenerationCosts,
): { generations: GenerationRecord[]; events: UsageEvent[] } {
  const byJob = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const legs = byJob.get(event.jobId) ?? [];
    legs.push(event);
    byJob.set(event.jobId, legs);
  }
  const corrected = new Map<string, UsageEvent[]>();
  for (const job of generations) {
    const cost = overrides[job.id];
    if (cost === undefined) continue;
    validateGenerationCost(cost);
    const legs = byJob.get(job.id) ?? [];
    const total = legs.reduce((sum, leg) => sum + (leg.estimatedCostUsd ?? 0), 0);
    // Preserve each provider leg's share. For an uncharged job, assign the
    // amount to its output stage; never infer a successful provider response.
    const assigned = Math.max(0, legs.findIndex(leg => leg.stage === job.type));
    let remaining = cost;
    corrected.set(job.id, legs.length ? legs.map((leg, index) => {
      const amount = index === legs.length - 1 ? remaining : total > 0
        ? Math.min(remaining, cost * (leg.estimatedCostUsd ?? 0) / total)
        : index === assigned ? cost : 0;
      remaining -= amount;
      return { ...leg, estimatedCostUsd: amount, estimatedCostTry: null };
    }) : [{
      id: `admin-cost:${job.id}`, jobId: job.id, userId: job.uid,
      templateId: job.presetId, stage: job.type,
      provider: job.actualProvider ?? job.provider ?? "unknown", model: job.model ?? "unknown",
      status: job.status === "completed" ? "success" : "failure",
      estimatedCostUsd: cost, estimatedCostTry: null, durationSeconds: null,
      startedAt: job.createdAt, completedAt: job.completedAt, errorCode: job.errorCode,
    }]);
  }
  return {
    generations: generations.map(job => overrides[job.id] === undefined ? job : {
      ...job, estimatedCost: overrides[job.id], costEvents: corrected.get(job.id),
      costManuallyEdited: true,
    }),
    events: [...events.filter(event => !corrected.has(event.jobId)), ...[...corrected.values()].flat()],
  };
}

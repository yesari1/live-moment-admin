import { BackendError, type QuotaCounters } from "@/services/backend";

export const QUOTA_FIELDS = ["images", "motions", "regenerations"] as const;

export function validQuotaReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= 3 && length <= 500;
}

export function parseQuotaGrant(values: Record<keyof QuotaCounters, string>): QuotaCounters | null {
  const counters = { images: Number(values.images), motions: Number(values.motions), regenerations: Number(values.regenerations) };
  if (QUOTA_FIELDS.some((field) => values[field].trim() === "" || !Number.isInteger(counters[field]) || counters[field] < 0 || counters[field] > 100)) return null;
  return QUOTA_FIELDS.some((field) => counters[field] > 0) ? counters : null;
}

export function quotaGrantSummary(delta: QuotaCounters): string {
  return QUOTA_FIELDS.filter((field) => delta[field] > 0)
    .map((field) => `+${delta[field]} ${field}`).join(", ");
}

export function quotaErrorMessage(error: unknown): string {
  if (error instanceof BackendError) {
    if (error.code === "AUTH_REQUIRED" || error.status === 401) return "Your session has expired. Sign in again.";
    if (error.code === "FORBIDDEN" || error.status === 403) return "Your account is not a backend admin.";
    if (error.code === "USER_NOT_FOUND" || error.status === 404) return "User no longer exists (user not found).";
    if (error.status === 409) return "This user's plan has no quota configuration.";
    if (error.code === "INVALID_ARGUMENT" || error.status === 400) return "Invalid adjustment. Use whole numbers from 0 to 100 and a reason of 3–500 characters. Total grants cannot exceed 1000 per counter per cycle.";
    if (error.status === 0) return error.message;
  }
  return "Unable to complete the quota request. Retry the same operation safely.";
}

import type { PlanConfig, PlanId } from "@/types";

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  single: "Single",
  live_weather: "Lite",
  live_weather_plus: "Plus",
};

export const PLAN_ORDER: PlanId[] = [
  "free",
  "single",
  "live_weather",
  "live_weather_plus",
];

export const DEFAULT_PLANS: PlanConfig[] = [
  {
    id: "free",
    displayName: "Free",
    enabled: true,
    imageGenerations: 1,
    videoGenerations: 0,
    maxImageQuality: "standard",
    maxVideoResolution: "720p",
    maxVideoDurationSeconds: 0,
    creditAmount: 0,
    generationPriority: "low",
    storeProductId: null,
    internalSku: "plan_free",
    priceLabel: "Free",
    features: ["One-time onboarding preview"],
  },
  {
    id: "single",
    displayName: "Single",
    enabled: true,
    imageGenerations: 1,
    videoGenerations: 1,
    maxImageQuality: "high",
    maxVideoResolution: "720p",
    maxVideoDurationSeconds: 6,
    creditAmount: 1,
    generationPriority: "normal",
    storeProductId: "one_time_1",
    internalSku: "plan_single",
    priceLabel: "$2.99",
    features: ["Single wallpaper generation", "High quality image"],
  },
  {
    id: "live_weather",
    displayName: "Lite",
    enabled: true,
    imageGenerations: 4,
    videoGenerations: 2,
    maxImageQuality: "high",
    maxVideoResolution: "1080p",
    maxVideoDurationSeconds: 6,
    creditAmount: 0,
    generationPriority: "normal",
    storeProductId: "live_weather_monthly",
    internalSku: "plan_live_weather",
    priceLabel: "$9.99 / mo",
    features: ["Weather automation", "1 replacement"],
  },
  {
    id: "live_weather_plus",
    displayName: "Plus",
    enabled: true,
    imageGenerations: 10,
    videoGenerations: 5,
    maxImageQuality: "high",
    maxVideoResolution: "1080p",
    maxVideoDurationSeconds: 6,
    creditAmount: 0,
    generationPriority: "high",
    storeProductId: "live_weather_plus_monthly",
    internalSku: "plan_live_weather_plus",
    priceLabel: "$14.99 / mo",
    features: ["Weather automation", "2 replacements", "Day / night variants"],
  },
];

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return "—";
  return PLAN_LABELS[plan as PlanId] ?? plan;
}

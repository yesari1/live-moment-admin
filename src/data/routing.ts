import type { GenerationType, RoutingConfig, RoutingContext } from "@/types";

export interface RoutingContextMeta {
  id: RoutingContext;
  label: string;
  description: string;
}

export type RoutingTierId =
  | "free"
  | "single"
  | "live_weather"
  | "live_weather_plus";

/**
 * Admin-facing grouping. Routing is configured per monetization tier, and each
 * tier owns both its image and video contexts. Onboarding shares the Free tier
 * because the two use the same routing logic.
 */
export interface RoutingTierMeta {
  id: RoutingTierId;
  label: string;
  description: string;
  imageContexts: RoutingContext[];
  videoContexts: RoutingContext[];
}

export const ROUTING_TIERS: RoutingTierMeta[] = [
  {
    id: "free",
    label: "Free",
    description:
      "Onboarding and free preview generations. Both use the same image routing, so they are configured together. There is no free video generation.",
    imageContexts: ["onboarding", "free"],
    videoContexts: [],
  },
  {
    id: "single",
    label: "Single",
    description:
      "One-time single wallpaper and video purchases, outside of a subscription.",
    imageContexts: ["single"],
    videoContexts: ["single"],
  },
  {
    id: "live_weather",
    label: "LiveWeather",
    description: "Generations for LiveWeather subscribers.",
    imageContexts: ["live_weather"],
    videoContexts: ["live_weather"],
  },
  {
    id: "live_weather_plus",
    label: "LiveWeather Plus",
    description: "Generations for LiveWeather Plus subscribers.",
    imageContexts: ["live_weather_plus"],
    videoContexts: ["live_weather_plus"],
  },
];

export const IMAGE_CONTEXTS: RoutingContextMeta[] = [
  {
    id: "onboarding",
    label: "Onboarding",
    description: "First-run onboarding generation.",
  },
  {
    id: "free",
    label: "Free",
    description: "Free preview generation.",
  },
  {
    id: "single",
    label: "Single",
    description: "One-time single wallpaper purchases.",
  },
  {
    id: "live_weather",
    label: "LiveWeather",
    description: "LiveWeather subscription generation.",
  },
  {
    id: "live_weather_plus",
    label: "LiveWeather Plus",
    description: "LiveWeather Plus subscription generation.",
  },
];

export const VIDEO_CONTEXTS: RoutingContextMeta[] = [
  {
    id: "single",
    label: "Single",
    description: "One-time single video purchases.",
  },
  {
    id: "live_weather",
    label: "LiveWeather",
    description: "LiveWeather subscription video generation.",
  },
  {
    id: "live_weather_plus",
    label: "LiveWeather Plus",
    description: "LiveWeather Plus subscription video generation.",
  },
];

export function contextMeta(
  type: GenerationType,
  context: RoutingContext,
): RoutingContextMeta {
  const list = type === "image" ? IMAGE_CONTEXTS : VIDEO_CONTEXTS;
  return (
    list.find((c) => c.id === context) ?? {
      id: context,
      label: context,
      description: "",
    }
  );
}

export function routingDocId(
  type: GenerationType,
  context: RoutingContext,
): string {
  return `${type}_${context}`;
}

type Defaults = Omit<
  RoutingConfig,
  "id" | "version" | "updatedAt" | "updatedBy"
>;

const imageDefaults: Record<RoutingContext, Defaults> = {
  onboarding: {
    type: "image",
    context: "onboarding",
    enabled: true,
    primary: { provider: "pixazo", model: "pixazo_nano_banana_pro" },
    fallback: {
      enabled: true,
      provider: "google",
      model: "google_nano_banana_direct",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 45,
    quality: "high",
  },
  free: {
    type: "image",
    context: "free",
    enabled: true,
    primary: { provider: "pixazo", model: "pixazo_flux_dev" },
    fallback: {
      enabled: true,
      provider: "pixazo",
      model: "pixazo_nano_banana_standard",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 45,
    quality: "standard",
  },
  single: {
    type: "image",
    context: "single",
    enabled: true,
    primary: { provider: "pixazo", model: "pixazo_nano_banana_pro" },
    fallback: {
      enabled: true,
      provider: "google",
      model: "google_nano_banana_direct",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 45,
    quality: "high",
  },
  live_weather: {
    type: "image",
    context: "live_weather",
    enabled: true,
    primary: { provider: "pixazo", model: "pixazo_nano_banana_pro" },
    fallback: {
      enabled: true,
      provider: "google",
      model: "google_nano_banana_direct",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 45,
    quality: "high",
  },
  live_weather_plus: {
    type: "image",
    context: "live_weather_plus",
    enabled: true,
    primary: { provider: "google", model: "google_nano_banana_direct" },
    fallback: {
      enabled: true,
      provider: "pixazo",
      model: "pixazo_nano_banana_pro",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 45,
    quality: "high",
  },
};

type VideoContext = Extract<
  RoutingContext,
  "single" | "live_weather" | "live_weather_plus"
>;

const videoDefaults: Record<VideoContext, Defaults> = {
  single: {
    type: "video",
    context: "single",
    enabled: true,
    primary: { provider: "google", model: "google_gemini_omni_1_1" },
    fallback: {
      enabled: true,
      provider: "pixazo",
      model: "pixazo_ltx_2_5_pro",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 90,
    durationSeconds: 6,
    resolution: "720p",
  },
  live_weather: {
    type: "video",
    context: "live_weather",
    enabled: true,
    primary: { provider: "pixazo", model: "pixazo_minimax_h3_max_turbo" },
    fallback: {
      enabled: true,
      provider: "pixazo",
      model: "pixazo_ltx_2_5_lite",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 90,
    durationSeconds: 6,
    resolution: "1080p",
  },
  live_weather_plus: {
    type: "video",
    context: "live_weather_plus",
    enabled: true,
    primary: { provider: "google", model: "google_gemini_omni_1_1" },
    fallback: {
      enabled: true,
      provider: "pixazo",
      model: "pixazo_minimax_h3_max_turbo",
    },
    retry: { enabled: true, count: 1 },
    timeoutSeconds: 90,
    durationSeconds: 6,
    resolution: "1080p",
  },
};

export function defaultRoutingConfig(
  type: GenerationType,
  context: RoutingContext,
): RoutingConfig {
  const base =
    type === "image"
      ? imageDefaults[context]
      : videoDefaults[context as VideoContext];
  return {
    id: routingDocId(type, context),
    ...base,
    version: 1,
    updatedAt: null,
    updatedBy: null,
  };
}

export const VIDEO_DURATIONS = [4, 6, 8, 10];
export const VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;
export const IMAGE_QUALITIES = ["standard", "high"] as const;

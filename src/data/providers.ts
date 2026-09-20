import type { GenerationType, ModelInfo, ProviderInfo } from "@/types";

/**
 * AI Provider / Model registry.
 *
 * Mirrors the model catalogs published by the Live Moment backend
 * (backend/src/domain/image-model.ts and video-model.ts) and the Firebase
 * Remote Config catalogs. No provider secrets are stored here.
 */

function titleize(id: string) {
  return id
    .replace(/^pixazo_/, "")
    .replace(/^google_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bO(\d)\b/g, "O$1")
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bFlux\b/g, "Flux")
    .replace(/\bLtx\b/g, "LTX")
    .replace(/\bVidu\b/g, "Vidu")
    .replace(/\bWan\b/g, "Wan");
}

function imageModel(
  provider: string,
  id: string,
  opts: Partial<ModelInfo> = {},
): ModelInfo {
  return {
    id,
    provider,
    type: "image",
    displayName: titleize(id),
    enabled: true,
    estimatedCost: null,
    supportsFallback: true,
    ...opts,
  };
}

function videoModel(
  provider: string,
  id: string,
  opts: Partial<ModelInfo> = {},
): ModelInfo {
  return {
    id,
    provider,
    type: "video",
    displayName: titleize(id),
    enabled: true,
    estimatedCost: null,
    supportsFallback: true,
    ...opts,
  };
}

const googleImageModels: ModelInfo[] = [
  imageModel("google", "google_nano_banana_direct", {
    displayName: "Gemini Nano Banana (Direct)",
    estimatedCost: 0.039,
    recommended: true,
  }),
];

const pixazoImageModels: ModelInfo[] = [
  imageModel("pixazo", "pixazo_nano_banana_pro", {
    displayName: "Nano Banana Pro",
    estimatedCost: 0.04,
    recommended: true,
  }),
  imageModel("pixazo", "pixazo_nano_banana_standard", {
    estimatedCost: 0.02,
  }),
  imageModel("pixazo", "pixazo_hidream_o1_dev", { estimatedCost: 0.012 }),
  imageModel("pixazo", "pixazo_hidream_o1", { estimatedCost: 0.02 }),
  imageModel("pixazo", "pixazo_flux_dev", { estimatedCost: 0.01 }),
  imageModel("pixazo", "pixazo_flux_2_pro", { estimatedCost: 0.055 }),
  imageModel("pixazo", "pixazo_gpt_image_1_5", { estimatedCost: 0.05 }),
  imageModel("pixazo", "pixazo_gpt_image_2", { estimatedCost: 0.07 }),
  imageModel("pixazo", "pixazo_seedream_5_lite", { estimatedCost: 0.015 }),
  imageModel("pixazo", "pixazo_seedream_5_pro", { estimatedCost: 0.045 }),
];

const googleVideoModels: ModelInfo[] = [
  videoModel("google", "google_gemini_omni_1_1", {
    displayName: "Gemini Omni 1.1 (Direct)",
    estimatedCost: 0.21,
    recommended: true,
  }),
  videoModel("google", "google_veo_3_1_direct", {
    displayName: "Veo 3.1 (Direct)",
    estimatedCost: 0.4,
  }),
  videoModel("google", "google_veo_3_1_fast_direct", {
    displayName: "Veo 3.1 Fast (Direct)",
    estimatedCost: 0.2,
  }),
  videoModel("google", "google_veo_3_1_lite_direct", {
    displayName: "Veo 3.1 Lite (Direct)",
    estimatedCost: 0.1,
  }),
];

const pixazoVideoModels: ModelInfo[] = [
  videoModel("pixazo", "pixazo_minimax_h3_max_turbo", {
    displayName: "MiniMax H3 Max Turbo",
    estimatedCost: 0.18,
    recommended: true,
  }),
  videoModel("pixazo", "pixazo_gemini_omni_1_1", { estimatedCost: 0.19 }),
  videoModel("pixazo", "pixazo_kling_v3_turbo_pro", { estimatedCost: 0.22 }),
  videoModel("pixazo", "pixazo_ltx_2_5_pro", { estimatedCost: 0.12 }),
  videoModel("pixazo", "pixazo_ltx_2_5_lite", { estimatedCost: 0.06 }),
  videoModel("pixazo", "pixazo_ltx_video_free", {
    estimatedCost: 0,
    free: true,
  }),
  videoModel("pixazo", "pixazo_wan_3_0", { estimatedCost: 0.14 }),
  videoModel("pixazo", "pixazo_wan_2_7", { estimatedCost: 0.12 }),
  videoModel("pixazo", "pixazo_wan_2_6", { estimatedCost: 0.1 }),
  videoModel("pixazo", "pixazo_wan_2_6_flash", { estimatedCost: 0.05 }),
  videoModel("pixazo", "pixazo_seedance_2_5", { estimatedCost: 0.2 }),
  videoModel("pixazo", "pixazo_seedance_2_5_reference", { estimatedCost: 0.22 }),
  videoModel("pixazo", "pixazo_seedance_2_0_mini", { estimatedCost: 0.08 }),
  videoModel("pixazo", "pixazo_seedance_2_0_mini_reference", {
    estimatedCost: 0.09,
  }),
  videoModel("pixazo", "pixazo_seedance_1_0_pro", { estimatedCost: 0.15 }),
  videoModel("pixazo", "pixazo_minimax_h3_max", { estimatedCost: 0.2 }),
  videoModel("pixazo", "pixazo_minimax_h3", { estimatedCost: 0.16 }),
  videoModel("pixazo", "pixazo_vidu_q3_turbo", { estimatedCost: 0.13 }),
];

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    displayName: "Google",
    enabled: true,
    description: "Direct Google Gemini / Veo generation.",
    imageModels: googleImageModels,
    videoModels: googleVideoModels,
  },
  {
    id: "pixazo",
    displayName: "Pixazo",
    enabled: true,
    description: "Pixazo aggregator with multiple image and video models.",
    imageModels: pixazoImageModels,
    videoModels: pixazoVideoModels,
  },
];

export function getProvider(providerId: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function getProviders(type: GenerationType): ProviderInfo[] {
  return PROVIDERS.filter(
    (p) => p.enabled && (type === "image" ? p.imageModels : p.videoModels).length > 0,
  );
}

export function getModels(
  providerId: string,
  type: GenerationType,
): ModelInfo[] {
  const provider = getProvider(providerId);
  if (!provider) return [];
  return (type === "image" ? provider.imageModels : provider.videoModels);
}

export function getModel(
  providerId: string,
  modelId: string,
): ModelInfo | undefined {
  const provider = getProvider(providerId);
  if (!provider) return undefined;
  return [...provider.imageModels, ...provider.videoModels].find(
    (m) => m.id === modelId,
  );
}

/** Find a model across every provider and media type. */
export function findModel(modelId: string | null): ModelInfo | undefined {
  if (!modelId) return undefined;
  for (const provider of PROVIDERS) {
    const model = [...provider.imageModels, ...provider.videoModels].find(
      (m) => m.id === modelId,
    );
    if (model) return model;
  }
  return undefined;
}

/**
 * Provider for a model id. Falls back to the previously stored provider when
 * the model is not part of the local catalog (e.g. a legacy custom id).
 */
export function resolveModelProvider(
  modelId: string | null,
  fallbackProvider = "",
): string {
  return findModel(modelId)?.provider ?? fallbackProvider;
}

export function getModelDisplayName(modelId: string | null): string {
  if (!modelId) return "—";
  for (const provider of PROVIDERS) {
    const model = [...provider.imageModels, ...provider.videoModels].find(
      (m) => m.id === modelId,
    );
    if (model) return model.displayName;
  }
  return modelId;
}

export function getProviderDisplayName(providerId: string | null): string {
  if (!providerId) return "—";
  return getProvider(providerId)?.displayName ?? providerId;
}

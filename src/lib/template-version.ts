import { toDate } from "@/lib/format";
import type {
  PromptValue,
  TemplateVersionRecord,
  TemplateVersionSection,
} from "@/types";

/**
 * Pure, dependency-free mapping for template versions.
 *
 * Versions are stored under `motionTemplates/{templateId}/versions/{versionId}`
 * (or in an inline `versions` field on the template document). The schema is not
 * rigid, so the mapper reads a set of common field names and preserves the raw
 * prompt value rather than assuming a shape.
 */

type RawDoc = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function bool(value: unknown): boolean {
  return value === true;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PROMPT_FIELDS: Array<{ keys: string[]; label: string }> = [
  { keys: ["prompt", "textPrompt", "text_prompt"], label: "Prompt" },
  { keys: ["keyframePrompt", "keyframe_prompt"], label: "Keyframe prompt" },
  { keys: ["videoPrompt", "video_prompt"], label: "Video prompt" },
  { keys: ["motionPrompt", "motion_prompt"], label: "Motion prompt" },
  { keys: ["negativePrompt", "negative_prompt"], label: "Negative prompt" },
  { keys: ["systemPrompt", "system_prompt", "system"], label: "System prompt" },
];

const CONFIG_FIELDS = [
  "parameters",
  "params",
  "generationConfig",
  "generation_config",
  "config",
  "settings",
  "modelSettings",
  "model_settings",
  "options",
];

const ATTRIBUTE_FIELDS: Array<{ keys: string[]; label: string }> = [
  { keys: ["quality"], label: "Quality" },
  { keys: ["resolution"], label: "Resolution" },
  { keys: ["durationSeconds", "duration"], label: "Duration (s)" },
  { keys: ["aspectRatio", "aspect_ratio"], label: "Aspect ratio" },
  { keys: ["fps"], label: "FPS" },
  { keys: ["width"], label: "Width" },
  { keys: ["height"], label: "Height" },
  { keys: ["seed"], label: "Seed" },
  { keys: ["steps"], label: "Steps" },
  { keys: ["guidanceScale", "guidance_scale"], label: "Guidance scale" },
];

export function versionNumberFrom(id: string, data: RawDoc): number | null {
  const direct =
    num(data.version) ?? num(data.versionNumber) ?? num(data.version_number);
  if (direct !== null) return direct;
  const match = /(\d+)/.exec(id);
  return match ? Number(match[1]) : null;
}

export function mapTemplateVersion(
  id: string,
  data: RawDoc,
): TemplateVersionRecord {
  const prompts: TemplateVersionSection[] = [];
  for (const field of PROMPT_FIELDS) {
    const key = field.keys.find((k) => data[k] != null);
    if (!key) continue;
    prompts.push({
      key,
      label: field.label,
      value: data[key] as PromptValue,
    });
  }

  let config: Record<string, unknown> | null = null;
  for (const key of CONFIG_FIELDS) {
    if (isRecord(data[key])) {
      config = { ...(config ?? {}), ...(data[key] as Record<string, unknown>) };
    }
  }
  // A structured prompt object can also carry model settings.
  for (const key of ["prompt", "keyframePrompt", "videoPrompt"]) {
    const value = data[key];
    if (isRecord(value)) {
      for (const cfgKey of CONFIG_FIELDS) {
        if (isRecord(value[cfgKey])) {
          config = {
            ...(config ?? {}),
            ...(value[cfgKey] as Record<string, unknown>),
          };
        }
      }
    }
  }

  const attributes: TemplateVersionSection[] = [];
  for (const field of ATTRIBUTE_FIELDS) {
    const key = field.keys.find((k) => data[k] != null);
    if (!key) continue;
    attributes.push({
      key,
      label: field.label,
      value: data[key] as PromptValue,
    });
  }

  const rawType = data.type;
  const type =
    rawType === "image" || rawType === "video"
      ? rawType
      : data.keyframeOnly === true
        ? "image"
        : null;

  const isActive =
    bool(data.active) ||
    bool(data.isActive) ||
    bool(data.is_active) ||
    bool(data.current) ||
    data.status === "active";

  return {
    id,
    versionNumber: versionNumberFrom(id, data),
    isActive,
    type,
    provider: str(data.provider) ?? str(data.primaryProvider),
    model:
      str(data.model) ??
      str(data.imageModelId) ??
      str(data.videoModelId) ??
      str(data.primaryModel),
    createdAt: toDate((data.createdAt ?? data.created_at) as never),
    updatedAt: toDate((data.updatedAt ?? data.updated_at) as never),
    prompts,
    config,
    attributes,
  };
}

/** Safely stringify a scalar or nested value for display. */
export function scalarToString(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Safely turn a string/map/structured prompt into readable text (never "[object Object]"). */
export function promptToText(value: PromptValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

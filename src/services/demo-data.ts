import type {
  AccountPlan,
  AdminUser,
  AppSettings,
  AuditLog,
  DashboardMetrics,
  ErrorLog,
  GenerationRecord,
  GenerationStatus,
  LogCategory,
  LogSeverity,
  PlanConfig,
  RoutingConfig,
  RoutingContext,
  TemplateRecord,
  TimeSeriesPoint,
  UsageEvent,
} from "@/types";
import { DEFAULT_PLANS } from "@/data/plans";
import {
  IMAGE_CONTEXTS,
  VIDEO_CONTEXTS,
  defaultRoutingConfig,
} from "@/data/routing";
import { PROVIDERS } from "@/data/providers";

/* Deterministic PRNG so demo data is stable between renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260919);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;

const PLANS: AccountPlan[] = ["free", "free", "free", "live_weather", "live_weather_plus"];

const IMAGE_MODELS = PROVIDERS.flatMap((p) => p.imageModels).map((m) => ({
  provider: m.provider,
  model: m.id,
}));
const VIDEO_MODELS = PROVIDERS.flatMap((p) => p.videoModels).map((m) => ({
  provider: m.provider,
  model: m.id,
}));

const CONTEXTS_BY_PLAN: Record<AccountPlan, RoutingContext> = {
  free: "free",
  live_weather: "live_weather",
  live_weather_plus: "live_weather_plus",
};

const ERROR_SAMPLES: {
  code: string;
  message: string;
  category: LogCategory;
  severity: LogSeverity;
}[] = [
  {
    code: "PROVIDER_TIMEOUT",
    message: "Provider did not respond within the configured timeout.",
    category: "timeout",
    severity: "warning",
  },
  {
    code: "PROVIDER_RATE_LIMITED",
    message: "Provider returned HTTP 429 rate limit.",
    category: "video_provider",
    severity: "warning",
  },
  {
    code: "PROVIDER_INVALID_REQUEST",
    message: "Provider rejected the request payload.",
    category: "image_provider",
    severity: "error",
  },
  {
    code: "FALLBACK_FAILED",
    message: "Primary and fallback providers both failed.",
    category: "fallback",
    severity: "critical",
  },
  {
    code: "STORAGE_WRITE_FAILED",
    message: "Failed to write output object to Cloud Storage.",
    category: "storage",
    severity: "error",
  },
  {
    code: "AUTH_TOKEN_EXPIRED",
    message: "ID token expired before the request completed.",
    category: "authentication",
    severity: "info",
  },
  {
    code: "FIRESTORE_UNAVAILABLE",
    message: "Firestore transiently unavailable while updating job.",
    category: "firestore",
    severity: "error",
  },
  {
    code: "BACKEND_INTERNAL_ERROR",
    message: "Unhandled exception in generation worker.",
    category: "backend",
    severity: "critical",
  },
];

const DAY_MS = 86_400_000;

function iso(msAgo: number) {
  return new Date(Date.now() - msAgo);
}

function email(i: number) {
  const firsts = ["ada", "emre", "lina", "kaan", "mira", "deniz", "aryan", "zoe", "leo", "nora"];
  const lasts = ["yilmaz", "demir", "kaya", "tan", "moreau", "silva", "okafor", "chen", "novak", "rossi"];
  return `${pick(firsts)}.${pick(lasts)}${i}@example.com`;
}

/* ------------------------------------------------------------------ users */

export const demoUsers: AdminUser[] = Array.from({ length: 128 }, (_, i) => {
  const plan = pick(PLANS);
  const createdAt = iso(int(1, 180) * DAY_MS + int(0, DAY_MS));
  const lastLoginAt = iso(int(0, 40) * DAY_MS + int(0, DAY_MS));
  const imageCount = plan === "free" ? int(0, 3) : int(3, 60);
  const videoCount = plan === "live_weather_plus" ? int(0, 30) : plan === "free" ? 0 : int(0, 12);
  const status = chance(0.04) ? "disabled" : chance(0.03) ? "review" : "active";
  return {
    uid: `demo_uid_${(1000 + i).toString(36)}${i}`,
    email: email(i),
    displayName: null,
    photoUrl: null,
    plan,
    status,
    credits: plan === "free" ? int(0, 2) : int(0, 20),
    createdAt,
    lastLoginAt,
    lastActiveAt: lastLoginAt,
    lastGenerationAt: iso(int(0, 30) * DAY_MS + int(0, DAY_MS)),
    imageGenerationCount: imageCount,
    videoGenerationCount: videoCount,
    failedGenerationCount: int(0, 5),
    estimatedTotalCost: Number((imageCount * 0.04 + videoCount * 0.21).toFixed(2)),
    freePreviewUsed: plan !== "free" || chance(0.6),
    billingVerified: plan !== "free",
    providers: ["google.com", chance(0.5) ? "password" : "emailLink"],
  };
});

/* ------------------------------------------------------------- generations */

function statusFor(): GenerationStatus {
  const r = rand();
  if (r < 0.78) return "completed";
  if (r < 0.86) return "processing";
  if (r < 0.92) return "queued";
  if (r < 0.99) return "failed";
  return "cancelled";
}

function rawStatusFor(status: GenerationStatus) {
  switch (status) {
    case "completed":
      return "ready" as const;
    case "processing":
      return "processing" as const;
    case "queued":
      return "queued" as const;
    case "failed":
      return "failed" as const;
    case "cancelled":
      return "cancelled" as const;
  }
}

export const demoGenerations: GenerationRecord[] = Array.from(
  { length: 420 },
  (_, i) => {
    const user = demoUsers[int(0, demoUsers.length - 1)];
    const type = user.plan === "live_weather_plus" && chance(0.55) ? "video" : chance(0.3) ? "video" : "image";
    const catalog = type === "image" ? IMAGE_MODELS : VIDEO_MODELS;
    const primary = pick(catalog);
    const fallback = pick(catalog.filter((m) => m.model !== primary.model));
    const status = statusFor();
    const fallbackUsed = status !== "failed" && chance(0.12);
    const actual = fallbackUsed ? fallback : primary;
    const startedAgo = int(0, 30) * DAY_MS + int(0, DAY_MS);
    const durationMs = type === "image" ? int(6000, 16000) : int(40000, 140000);
    const failed = status === "failed";
    const err = failed ? pick(ERROR_SAMPLES) : null;
    return {
      id: `gen_${(100000 + i).toString(36)}`,
      uid: user.uid,
      userEmail: user.email,
      type,
      routingContext: CONTEXTS_BY_PLAN[user.plan],
      status,
      rawStatus: rawStatusFor(status),
      provider: primary.provider,
      actualProvider: actual.provider,
      model: primary.model,
      imageModelId: type === "image" ? primary.model : null,
      videoModelId: type === "video" ? primary.model : null,
      primaryProvider: primary.provider,
      primaryModel: primary.model,
      fallbackProvider: fallback.provider,
      fallbackModel: fallback.model,
      fallbackUsed,
      providerRequestId: `req_${Math.floor(rand() * 1e9).toString(36)}`,
      retryCount: chance(0.2) ? 1 : 0,
      presetId: pick(["swing", "football_juggle", "coffee_steam", "rain_window", "aurora"]),
      personType: pick(["solo", "couple", "family", "pet"]),
      createdAt: iso(startedAgo),
      startedAt: status === "queued" ? null : iso(startedAgo - 2000),
      completedAt: status === "completed" || failed ? iso(startedAgo - durationMs) : null,
      durationMs: status === "completed" || failed ? durationMs : null,
      estimatedCost:
        status === "completed"
          ? Number((type === "image" ? rand() * 0.05 + 0.01 : rand() * 0.2 + 0.08).toFixed(3))
          : null,
      currency: "USD",
      errorCode: err?.code ?? null,
      errorMessage: err?.message ?? null,
      timeout: err?.code === "PROVIDER_TIMEOUT",
    };
  },
);

/* ----------------------------------------------------------- usage events */

export const demoUsageEvents: UsageEvent[] = demoGenerations
  .filter((g) => g.status === "completed" || g.status === "failed")
  .map((g, i) => ({
    id: `usage_${i}`,
    userId: g.uid,
    jobId: g.id,
    templateId: g.presetId,
    stage: g.type,
    provider: g.actualProvider ?? g.provider ?? "google",
    model: g.model ?? "unknown",
    status: g.status === "completed" ? "success" : "failure",
    estimatedCostUsd: g.estimatedCost,
    estimatedCostTry: g.estimatedCost ? Number((g.estimatedCost * 48.43).toFixed(2)) : null,
    durationSeconds: g.durationMs ? Number((g.durationMs / 1000).toFixed(1)) : null,
    startedAt: g.startedAt,
    completedAt: g.completedAt,
    errorCode: g.errorCode,
  }));

/* -------------------------------------------------------------- templates */

const TEMPLATE_SEEDS: Array<[string, string, string]> = [
  ["swing", "Garden Swing", "person_outdoor"],
  ["football_juggle", "Football Juggle", "sport"],
  ["coffee_steam", "Coffee Steam", "cozy_indoor"],
  ["rain_window", "Rain on Window", "weather"],
  ["aurora", "Aurora Sky", "nature"],
  ["city_night", "City at Night", "urban"],
  ["pet_portrait", "Pet Portrait", "pet"],
  ["beach_waves", "Beach Waves", "nature"],
  ["snowfall", "Snowfall", "weather"],
  ["neon_rain", "Neon Rain", "urban"],
  ["campfire", "Campfire", "cozy_indoor"],
  ["balloon_ride", "Balloon Ride", "person_outdoor"],
];

export const demoTemplates: TemplateRecord[] = TEMPLATE_SEEDS.map(
  ([id, title, category], i) => ({
    id,
    title,
    description: `${title} motion template for Live Moment wallpaper generation.`,
    iconKey: id,
    category,
    type: chance(0.75) ? "video" : "image",
    enabled: chance(0.9),
    sortOrder: i + 1,
    activeVersion: int(1, 12),
    defaultLoopFix: chance(0.6),
    supportedPlans: ["free", "single", "live_weather", "live_weather_plus"],
    previewUrl: null,
    updatedAt: iso(int(1, 120) * DAY_MS),
  }),
);

/* ------------------------------------------------------------- app config */

export const demoRoutingConfigs: RoutingConfig[] = [
  ...IMAGE_CONTEXTS.map((c) => defaultRoutingConfig("image", c.id)),
  ...VIDEO_CONTEXTS.map((c) => defaultRoutingConfig("video", c.id)),
];

export const demoPlans: PlanConfig[] = DEFAULT_PLANS;

export const demoAppSettings: AppSettings = {
  imageGenerationEnabled: true,
  videoGenerationEnabled: true,
  newRegistrationsEnabled: true,
  maintenanceMode: false,
  onboardingGenerationEnabled: true,
  freeGenerationLimit: 1,
  defaultTimeoutSeconds: 45,
  maxConcurrentGenerations: 3,
  minimumAppVersion: "1.4.0",
  supportMessage: "Need help? Contact support from the Live Moment app settings.",
  maintenanceMessage: "Live Moment is briefly unavailable for scheduled maintenance.",
  featureFlags: {
    weather_automation: true,
    day_night_variants: true,
    reference_video: false,
  },
  version: 7,
  updatedAt: iso(2 * DAY_MS),
  updatedBy: "admin@yesastudio.com",
};

/* ------------------------------------------------------------------ logs */

export const demoErrorLogs: ErrorLog[] = Array.from({ length: 160 }, (_, i) => {
  const sample = pick(ERROR_SAMPLES);
  const gen = demoGenerations[int(0, demoGenerations.length - 1)];
  return {
    id: `log_${i}`,
    timestamp: iso(int(0, 30) * DAY_MS + int(0, DAY_MS)),
    severity: sample.severity,
    category: sample.category,
    userId: gen.uid,
    generationId: gen.id,
    provider: gen.provider,
    model: gen.model,
    errorCode: sample.code,
    message: sample.message,
  };
}).sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));

const AUDIT_ACTIONS = [
  ["AI_ROUTING_UPDATED", "video_live_weather_plus"],
  ["KILL_SWITCH_TOGGLED", "video_generation"],
  ["PLAN_UPDATED", "live_weather_plus"],
  ["APP_SETTINGS_UPDATED", "app_settings"],
  ["USER_DISABLED", "demo_uid_1042"],
  ["TEMPLATE_UPDATED", "swing"],
  ["USER_CREDITS_UPDATED", "demo_uid_1109"],
] as const;

export const demoAuditLogs: AuditLog[] = Array.from({ length: 40 }, (_, i) => {
  const [action, target] = pick(AUDIT_ACTIONS as unknown as [string, string][]);
  return {
    id: `audit_${i}`,
    adminUid: "admin_uid_1",
    adminEmail: "admin@yesastudio.com",
    action: action as AuditLog["action"],
    target,
    before: { sample: "before" },
    after: { sample: "after" },
    createdAt: iso(int(0, 60) * DAY_MS + int(0, DAY_MS)),
  };
}).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

/* ------------------------------------------------------------- analytics */

export function demoMetrics(): DashboardMetrics {
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todays = demoGenerations.filter(
    (g) => (g.createdAt?.getTime() ?? 0) >= startOfToday,
  );
  const images = todays.filter((g) => g.type === "image");
  const videos = todays.filter((g) => g.type === "video");
  const completed = todays.filter((g) => g.status === "completed");
  const failed = todays.filter((g) => g.status === "failed");
  const rate = (arr: GenerationRecord[]) => {
    const done = arr.filter((g) => g.status === "completed" || g.status === "failed");
    if (!done.length) return 100;
    return (done.filter((g) => g.status === "completed").length / done.length) * 100;
  };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCost = demoGenerations
    .filter((g) => (g.createdAt?.getTime() ?? 0) >= monthStart.getTime())
    .reduce((sum, g) => sum + (g.estimatedCost ?? 0), 0);
  return {
    totalUsers: demoUsers.length,
    newUsersToday: demoUsers.filter(
      (u) => (u.createdAt?.getTime() ?? 0) >= startOfToday,
    ).length,
    newUsers7d: demoUsers.filter(
      (u) => (u.createdAt?.getTime() ?? 0) >= now - 7 * DAY_MS,
    ).length,
    activeUsersToday: int(18, 34),
    activeUsers7d: int(60, 96),
    imageGenerationsToday: images.length,
    videoGenerationsToday: videos.length,
    successfulGenerationsToday: completed.length,
    failedGenerationsToday: failed.length,
    imageSuccessRate: rate(images),
    videoSuccessRate: rate(videos),
    estimatedCostToday: todays.reduce((s, g) => s + (g.estimatedCost ?? 0), 0),
    estimatedCostMonth: monthCost,
  };
}

export function demoSeries(days: number): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = dayStart.getTime() + DAY_MS;
    const gens = demoGenerations.filter((g) => {
      const t = g.createdAt?.getTime() ?? 0;
      return t >= dayStart.getTime() && t < dayEnd;
    });
    const image = gens.filter((g) => g.type === "image").length;
    const video = gens.filter((g) => g.type === "video").length;
    const success = gens.filter((g) => g.status === "completed").length;
    const failed = gens.filter((g) => g.status === "failed").length;
    points.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: image + video,
      image,
      video,
      success,
      failed,
      cost: Number(gens.reduce((s, g) => s + (g.estimatedCost ?? 0), 0).toFixed(2)),
    });
  }
  return points;
}

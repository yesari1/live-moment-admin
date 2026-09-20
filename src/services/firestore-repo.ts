import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { toDate } from "@/lib/format";
import type {
  AccountStatus,
  AdminUser,
  AppSettings,
  AuditLog,
  ErrorLog,
  GenerationRecord,
  GenerationStatus,
  PlanConfig,
  RawJobStatus,
  RoutingConfig,
  TemplateRecord,
} from "@/types";
import { defaultRoutingConfig, routingDocId } from "@/data/routing";
import { DEFAULT_PLANS } from "@/data/plans";
import type { GenerationType, RoutingContext } from "@/types";

/* ------------------------------------------------------------- collections */

export const COLLECTIONS = {
  users: "users",
  generationJobs: "generationJobs",
  usageEvents: "generationUsageEvents",
  templates: "motionTemplates",
  billingPurchases: "billingPurchases",
  routing: "ai_routing",
  plans: "plans",
  appSettings: "admin_config",
  auditLogs: "admin_audit_logs",
  errorLogs: "admin_error_logs",
  pricing: "pricingConfigs",
} as const;

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

/* ------------------------------------------------------------------ mappers */

export function normalizeStatus(raw: unknown): GenerationStatus {
  switch (raw) {
    case "ready":
    case "completed":
      return "completed";
    case "generating":
    case "processing":
      return "processing";
    case "queued":
    case "uploading":
    case "draft":
      return "queued";
    case "failed":
      return "failed";
    case "cancelled":
    case "expired":
      return "cancelled";
    default:
      return "queued";
  }
}

function accountStatus(data: RawDoc): AccountStatus {
  if (bool(data.deletionPending)) return "deletion_pending";
  if (bool(data.disabled) || data.status === "disabled") return "disabled";
  if (bool(data.supportReview) || data.status === "review") return "review";
  return "active";
}

export function mapUser(id: string, data: RawDoc): AdminUser {
  return {
    uid: str(data.uid) ?? id,
    email: str(data.email),
    displayName: str(data.displayName),
    photoUrl: str(data.photoUrl),
    plan: (data.plan as AdminUser["plan"]) ?? "free",
    status: accountStatus(data),
    credits: num(data.standaloneWallpapersGranted) ?? 0,
    createdAt: toDate(data.createdAt as never),
    lastLoginAt: toDate(data.lastLoginAt as never),
    lastActiveAt: toDate(
      (data.lastActiveAt ?? data.lastLoginAt) as never,
    ),
    lastGenerationAt: toDate(data.lastGenerationAt as never),
    imageGenerationCount: num(data.imageGenerationCount) ?? 0,
    videoGenerationCount: num(data.videoGenerationCount) ?? 0,
    failedGenerationCount: num(data.failedGenerationCount) ?? 0,
    estimatedTotalCost: num(data.estimatedTotalCost) ?? 0,
    freePreviewUsed: bool(data.freePreviewUsed),
    billingVerified: bool(data.billingVerified),
    providers: Array.isArray(data.providers)
      ? (data.providers as string[])
      : [],
  };
}

export function mapGeneration(id: string, data: RawDoc): GenerationRecord {
  const type: GenerationType =
    data.type === "video" || data.type === "image"
      ? data.type
      : bool(data.keyframeOnly)
        ? "image"
        : "video";
  const modelId = type === "image" ? data.imageModelId : data.videoModelId;
  const fallbackUsed = bool(data.fallbackUsed);
  const actualProvider =
    str(data.actualProvider) ?? str(data.provider);
  const err = str(data.errorCode);
  return {
    id: str(data.id) ?? id,
    uid: str(data.uid) ?? str(data.ownerUid) ?? "",
    userEmail: str(data.userEmail),
    type,
    routingContext: (data.routingContext as GenerationRecord["routingContext"]) ?? null,
    status: normalizeStatus(data.status),
    rawStatus: (data.status as RawJobStatus) ?? "queued",
    provider: str(data.provider),
    actualProvider,
    model: str(modelId),
    imageModelId: str(data.imageModelId),
    videoModelId: str(data.videoModelId),
    primaryProvider: str(data.primaryProvider) ?? actualProvider,
    primaryModel: str(data.primaryModel) ?? str(modelId),
    fallbackProvider: str(data.fallbackProvider),
    fallbackModel: str(data.fallbackModel),
    fallbackUsed,
    providerRequestId: str(data.providerRequestId),
    retryCount: num(data.retryCount) ?? 0,
    presetId: str(data.presetId),
    personType: str(data.personType),
    createdAt: toDate(
      (data.createdAt ?? data.createdAtEpochMs) as never,
    ),
    startedAt: toDate(
      (data.startedAt ?? data.startedAtEpochMs) as never,
    ),
    completedAt: toDate(
      (data.completedAt ?? data.completedAtEpochMs) as never,
    ),
    durationMs: num(data.durationMs) ?? num(data.outputDurationMs),
    estimatedCost: num(data.estimatedCost) ?? num(data.estimatedCostUsd),
    currency: str(data.currency) ?? "USD",
    errorCode: err,
    errorMessage: str(data.errorMessage),
    timeout: err === "PROVIDER_TIMEOUT" || bool(data.timeout),
  };
}

export function mapUsageEvent(id: string, data: RawDoc) {
  return {
    id,
    userId: str(data.userId) ?? "",
    jobId: str(data.jobId) ?? "",
    templateId: str(data.templateId),
    stage: (data.stage as GenerationType) ?? "image",
    provider: str(data.provider) ?? "unknown",
    model: str(data.model) ?? "unknown",
    status: (data.status === "failure" ? "failure" : "success") as
      | "success"
      | "failure",
    estimatedCostUsd: num(data.estimatedCostUsd),
    estimatedCostTry: num(data.estimatedCostTry),
    durationSeconds: num(data.durationSeconds),
    startedAt: toDate((data.startedAt ?? data.createdAt) as never),
    completedAt: toDate(data.completedAt as never),
    errorCode: str(data.errorCode),
  };
}

export function mapTemplate(id: string, data: RawDoc): TemplateRecord {
  return {
    id: str(data.id) ?? id,
    title: str(data.title) ?? id,
    description: str(data.description) ?? "",
    iconKey: str(data.iconKey) ?? id,
    category: str(data.category) ?? "uncategorized",
    type: (data.type as GenerationType) ?? "video",
    enabled: data.enabled !== false,
    sortOrder: num(data.sortOrder) ?? 0,
    activeVersion: num(data.activeVersion) ?? 1,
    defaultLoopFix: bool(data.defaultLoopFix),
    supportedPlans: Array.isArray(data.supportedPlans)
      ? (data.supportedPlans as TemplateRecord["supportedPlans"])
      : ["free", "single", "live_weather", "live_weather_plus"],
    previewUrl: str(data.previewUrl),
    updatedAt: toDate(data.updatedAt as never),
  };
}

function mapRouting(
  type: GenerationType,
  context: RoutingContext,
  data: RawDoc | null,
): RoutingConfig {
  const fallback = defaultRoutingConfig(type, context);
  if (!data) return fallback;
  const primary = (data.primary as RawDoc) ?? {};
  const fallbackCfg = (data.fallback as RawDoc) ?? {};
  const retry = (data.retry as RawDoc) ?? {};
  return {
    ...fallback,
    enabled: data.enabled !== false,
    primary: {
      provider: str(primary.provider) ?? fallback.primary.provider,
      model: str(primary.model) ?? fallback.primary.model,
    },
    fallback: {
      enabled: fallbackCfg.enabled !== false,
      provider: str(fallbackCfg.provider) ?? fallback.fallback.provider,
      model: str(fallbackCfg.model) ?? fallback.fallback.model,
    },
    retry: {
      enabled: retry.enabled !== false,
      count: num(retry.count) ?? fallback.retry.count,
    },
    timeoutSeconds: num(data.timeoutSeconds) ?? fallback.timeoutSeconds,
    quality: str(data.quality) ?? fallback.quality,
    resolution: str(data.resolution) ?? fallback.resolution,
    durationSeconds: num(data.durationSeconds) ?? fallback.durationSeconds,
    parameters:
      (data.parameters as Record<string, unknown> | undefined) ??
      fallback.parameters,
    version: num(data.version) ?? 1,
    updatedAt: toDate(data.updatedAt as never),
    updatedBy: str(data.updatedBy),
  };
}

/* -------------------------------------------------------------- read APIs */

async function readCollection(
  name: string,
  map: (id: string, data: RawDoc) => unknown,
  max = 1000,
  orderField?: string,
) {
  const db = getDb();
  if (!db) return null;
  const ref = collection(db, name);
  const q = orderField
    ? query(ref, orderBy(orderField, "desc"), limit(max))
    : query(ref, limit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => map(d.id, d.data() as RawDoc));
}

export async function fetchUsersFromFirestore(): Promise<AdminUser[] | null> {
  try {
    return (await readCollection(
      COLLECTIONS.users,
      mapUser,
      2000,
    )) as AdminUser[] | null;
  } catch (error) {
    console.warn("[admin] Failed to read users from Firestore", error);
    return null;
  }
}

export async function fetchGenerationsFromFirestore(): Promise<
  GenerationRecord[] | null
> {
  try {
    return (await readCollection(
      COLLECTIONS.generationJobs,
      mapGeneration,
      2000,
      "createdAtEpochMs",
    )) as GenerationRecord[] | null;
  } catch (error) {
    console.warn("[admin] Failed to read generationJobs from Firestore", error);
    return null;
  }
}

export async function fetchUsageFromFirestore() {
  try {
    return (await readCollection(
      COLLECTIONS.usageEvents,
      mapUsageEvent,
      3000,
      "startedAtEpochMs",
    )) as ReturnType<typeof mapUsageEvent>[] | null;
  } catch (error) {
    console.warn("[admin] Failed to read generationUsageEvents", error);
    return null;
  }
}

export async function fetchTemplatesFromFirestore(): Promise<
  TemplateRecord[] | null
> {
  try {
    return (await readCollection(
      COLLECTIONS.templates,
      mapTemplate,
      500,
      "sortOrder",
    )) as TemplateRecord[] | null;
  } catch (error) {
    console.warn("[admin] Failed to read motionTemplates", error);
    return null;
  }
}

export async function fetchRoutingFromFirestore(
  type: GenerationType,
  contexts: RoutingContext[],
): Promise<RoutingConfig[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const results = await Promise.all(
      contexts.map(async (context) => {
        const ref = doc(db, COLLECTIONS.routing, routingDocId(type, context));
        const snap = await getDoc(ref);
        return mapRouting(
          type,
          context,
          snap.exists() ? (snap.data() as RawDoc) : null,
        );
      }),
    );
    return results;
  } catch (error) {
    console.warn("[admin] Failed to read ai_routing", error);
    return null;
  }
}

export async function fetchAppSettingsFromFirestore(): Promise<AppSettings | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.appSettings, "app_settings"));
    if (!snap.exists()) return null;
    const data = snap.data() as RawDoc;
    const base = DEFAULT_APP_SETTINGS;
    return {
      ...base,
      ...data,
      featureFlags: {
        ...base.featureFlags,
        ...((data.featureFlags as Record<string, boolean>) ?? {}),
      },
      updatedAt: toDate(data.updatedAt as never),
      updatedBy: str(data.updatedBy),
      version: num(data.version) ?? base.version,
    } as AppSettings;
  } catch (error) {
    console.warn("[admin] Failed to read admin_config/app_settings", error);
    return null;
  }
}

export async function fetchPlansFromFirestore(): Promise<PlanConfig[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.plans));
    // No plans saved yet: fall back to the built-in catalog instead of failing.
    if (snapshot.empty) return DEFAULT_PLANS;
    const found = snapshot.docs.map((d) => {
      const data = d.data() as RawDoc;
      const base =
        DEFAULT_PLANS.find((p) => p.id === d.id) ?? DEFAULT_PLANS[0];
      return { ...base, ...data, id: d.id } as PlanConfig;
    });
    // Preserve canonical ordering, appending any extra plans.
    return DEFAULT_PLANS.map(
      (plan) => found.find((f) => f.id === plan.id) ?? plan,
    ).concat(found.filter((f) => !DEFAULT_PLANS.some((p) => p.id === f.id)));
  } catch (error) {
    console.warn("[admin] Failed to read plans", error);
    return null;
  }
}

export async function fetchAuditLogsFromFirestore(
  max = 200,
): Promise<AuditLog[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const q = query(
      collection(db, COLLECTIONS.auditLogs),
      orderBy("createdAt", "desc"),
      limit(max),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data() as RawDoc;
      return {
        id: d.id,
        adminUid: str(data.adminUid) ?? "",
        adminEmail: str(data.adminEmail),
        action: (data.action as AuditLog["action"]) ?? "APP_SETTINGS_UPDATED",
        target: str(data.target) ?? "",
        before: data.before ?? null,
        after: data.after ?? null,
        createdAt: toDate(data.createdAt as never),
      };
    });
  } catch (error) {
    console.warn("[admin] Failed to read admin_audit_logs", error);
    return null;
  }
}

export async function fetchErrorLogsFromFirestore(
  max = 300,
): Promise<ErrorLog[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const q = query(
      collection(db, COLLECTIONS.errorLogs),
      orderBy("timestamp", "desc"),
      limit(max),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data() as RawDoc;
      return {
        id: d.id,
        timestamp: toDate(data.timestamp as never),
        severity: (data.severity as ErrorLog["severity"]) ?? "error",
        category: (data.category as ErrorLog["category"]) ?? "backend",
        userId: str(data.userId),
        generationId: str(data.generationId),
        provider: str(data.provider),
        model: str(data.model),
        errorCode: str(data.errorCode),
        message: str(data.message) ?? "",
      };
    });
  } catch (error) {
    console.warn("[admin] Failed to read admin_error_logs", error);
    return null;
  }
}

/* ------------------------------------------------------------- write APIs */

export async function saveRoutingToFirestore(
  config: RoutingConfig,
  adminUid: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const { id, updatedAt: _updatedAt, ...payload } = config;
    await setDoc(
      doc(db, COLLECTIONS.routing, routingDocId(config.type, config.context)),
      {
        ...payload,
        id,
        version: config.version + 1,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn("[admin] Failed to save ai_routing", error);
    throw error instanceof Error
      ? error
      : new Error("Firestore rejected the routing write.");
  }
}

export async function saveAppSettingsToFirestore(
  settings: AppSettings,
  adminUid: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const { updatedAt: _updatedAt, ...payload } = settings;
    await setDoc(
      doc(db, COLLECTIONS.appSettings, "app_settings"),
      {
        ...payload,
        version: settings.version + 1,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn("[admin] Failed to save app_settings", error);
    return false;
  }
}

export async function savePlanToFirestore(
  plan: PlanConfig,
  adminUid: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await setDoc(
      doc(db, COLLECTIONS.plans, plan.id),
      { ...plan, updatedAt: serverTimestamp(), updatedBy: adminUid },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn("[admin] Failed to save plan", error);
    return false;
  }
}

export async function saveTemplateToFirestore(
  template: TemplateRecord,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const { id, updatedAt: _updatedAt, ...payload } = template;
    await setDoc(
      doc(db, COLLECTIONS.templates, id),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn("[admin] Failed to save template", error);
    return false;
  }
}

export async function deleteTemplateFromFirestore(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await deleteDoc(doc(db, COLLECTIONS.templates, id));
    return true;
  } catch (error) {
    console.warn("[admin] Failed to delete template", error);
    return false;
  }
}

export async function appendAuditLogToFirestore(entry: {
  adminUid: string;
  adminEmail: string | null;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
}): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await addDoc(collection(db, COLLECTIONS.auditLogs), {
      ...entry,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.warn("[admin] Failed to append audit log", error);
    return false;
  }
}

export async function updateUserInFirestore(
  uid: string,
  patch: Partial<{
    disabled: boolean;
    supportReview: boolean;
    standaloneWallpapersGranted: number;
    plan: string;
  }>,
  adminUid: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await updateDoc(doc(db, COLLECTIONS.users, uid), {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    return true;
  } catch (error) {
    console.warn("[admin] Failed to update user", error);
    return false;
  }
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  imageGenerationEnabled: true,
  videoGenerationEnabled: true,
  newRegistrationsEnabled: true,
  maintenanceMode: false,
  onboardingGenerationEnabled: true,
  freeGenerationLimit: 1,
  defaultTimeoutSeconds: 45,
  maxConcurrentGenerations: 3,
  minimumAppVersion: "1.0.0",
  supportMessage: "",
  maintenanceMessage: "",
  featureFlags: {},
  version: 1,
  updatedAt: null,
  updatedBy: null,
};

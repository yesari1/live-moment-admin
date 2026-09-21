import type {
  AdminUser,
  AppSettings,
  AuditLog,
  ErrorLog,
  GenerationRecord,
  PlanConfig,
  RoutingConfig,
  TemplateRecord,
  TemplateVersionRecord,
  UsageEvent,
} from "@/types";
import { isFirebaseConfigured, runtimeConfig } from "@/lib/config";
import { IMAGE_CONTEXTS, VIDEO_CONTEXTS } from "@/data/routing";
import { DEFAULT_PLANS } from "@/data/plans";
import {
  appendAuditLogToFirestore,
  deleteTemplateFromFirestore,
  fetchAppSettingsFromFirestore,
  fetchAuditLogsFromFirestore,
  fetchErrorLogsFromFirestore,
  fetchGenerationsFromFirestore,
  fetchPlansFromFirestore,
  fetchRoutingFromFirestore,
  fetchTemplateVersionsFromFirestore,
  fetchTemplatesFromFirestore,
  fetchUsageFromFirestore,
  fetchUsersFromFirestore,
  saveAppSettingsToFirestore,
  savePlanToFirestore,
  saveRoutingToFirestore,
  saveTemplateToFirestore,
  updateUserInFirestore,
} from "@/services/firestore-repo";
import {
  demoState,
  delay,
  pushDemoLog,
  recordDemoAudit,
} from "@/services/demo-store";
import { demoTemplateVersions } from "@/services/demo-data";
import { backendDeleteUser } from "@/services/backend";
import { toDate } from "@/lib/format";

export interface Actor {
  uid: string;
  email: string | null;
}

export const isLiveData = isFirebaseConfigured && !runtimeConfig.forceDemoData;

export function dataSourceLabel(): string {
  return isLiveData ? "Live Firestore" : "Demo data";
}

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

async function live<T>(fetcher: () => Promise<T | null>, label: string): Promise<T> {
  const result = await fetcher();
  if (result === null) {
    throw new Error(
      `${label} could not be read from Firestore. Verify that the admin Firestore security rules are deployed and that this account is authorized.`,
    );
  }
  return result;
}

/* ------------------------------------------------------------------ users */

export async function fetchUsers(): Promise<AdminUser[]> {
  if (!isLiveData) return delay(clone(demoState.users));
  return live(() => fetchUsersFromFirestore(), "Users");
}

/** Derive per-user counts, last generation and cost from generation history. */
export function mergeUserStats(
  users: AdminUser[],
  generations: GenerationRecord[],
  usage: UsageEvent[],
): AdminUser[] {
  const images = new Map<string, number>();
  const videos = new Map<string, number>();
  const failures = new Map<string, number>();
  const lastGen = new Map<string, Date>();
  const cost = new Map<string, number>();

  for (const g of generations) {
    if (g.type === "image") images.set(g.uid, (images.get(g.uid) ?? 0) + 1);
    else videos.set(g.uid, (videos.get(g.uid) ?? 0) + 1);
    if (g.status === "failed") failures.set(g.uid, (failures.get(g.uid) ?? 0) + 1);
    const created = toDate(g.createdAt);
    if (created) {
      const current = lastGen.get(g.uid);
      if (!current || created > current) lastGen.set(g.uid, created);
    }
  }

  for (const event of usage) {
    cost.set(
      event.userId,
      (cost.get(event.userId) ?? 0) + (event.estimatedCostUsd ?? 0),
    );
  }

  return users.map((user) => ({
    ...user,
    imageGenerationCount: user.imageGenerationCount || images.get(user.uid) || 0,
    videoGenerationCount: user.videoGenerationCount || videos.get(user.uid) || 0,
    failedGenerationCount:
      user.failedGenerationCount || failures.get(user.uid) || 0,
    lastGenerationAt: user.lastGenerationAt ?? lastGen.get(user.uid) ?? null,
    estimatedTotalCost:
      user.estimatedTotalCost || Number((cost.get(user.uid) ?? 0).toFixed(2)),
  }));
}

export interface UserPatch {
  disabled?: boolean;
  supportReview?: boolean;
  credits?: number;
  plan?: AdminUser["plan"];
}

export async function updateUser(
  uid: string,
  patch: UserPatch,
  actor: Actor,
): Promise<AdminUser> {
  if (!isLiveData) {
    const user = demoState.users.find((u) => u.uid === uid);
    if (!user) throw new Error("User not found.");
    const before = clone(user);
    if (patch.disabled !== undefined) {
      user.status = patch.disabled ? "disabled" : "active";
    }
    if (patch.supportReview !== undefined) {
      user.status = patch.supportReview ? "review" : "active";
    }
    if (patch.credits !== undefined) user.credits = patch.credits;
    if (patch.plan !== undefined) user.plan = patch.plan;
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: patch.disabled !== undefined
        ? patch.disabled
          ? "USER_DISABLED"
          : "USER_ENABLED"
        : patch.credits !== undefined
          ? "USER_CREDITS_UPDATED"
          : patch.plan !== undefined
            ? "USER_PLAN_UPDATED"
            : "USER_MARKED_FOR_REVIEW",
      target: uid,
      before,
      after: clone(user),
    });
    return delay(clone(user));
  }

  const ok = await updateUserInFirestore(
    uid,
    {
      ...(patch.disabled !== undefined ? { disabled: patch.disabled } : {}),
      ...(patch.supportReview !== undefined
        ? { supportReview: patch.supportReview }
        : {}),
      ...(patch.credits !== undefined
        ? { standaloneWallpapersGranted: patch.credits }
        : {}),
      ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
    },
    actor.uid,
  );
  if (!ok) {
    throw new Error(
      "Could not update the user. Firestore rules must allow admin writes to users.",
    );
  }
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action:
      patch.disabled !== undefined
        ? patch.disabled
          ? "USER_DISABLED"
          : "USER_ENABLED"
        : patch.credits !== undefined
          ? "USER_CREDITS_UPDATED"
          : patch.plan !== undefined
            ? "USER_PLAN_UPDATED"
            : "USER_MARKED_FOR_REVIEW",
    target: uid,
    before: null,
    after: patch,
  });
  const users = await fetchUsersFromFirestore();
  const updated = users?.find((u) => u.uid === uid);
  if (!updated) throw new Error("User updated, but the refreshed record could not be read.");
  return updated;
}

export async function deleteUser(
  uid: string,
  actor: Actor,
  idToken: string | null,
): Promise<void> {
  if (!isLiveData) {
    const index = demoState.users.findIndex((u) => u.uid === uid);
    if (index >= 0) demoState.users.splice(index, 1);
    demoState.generations = demoState.generations.filter((g) => g.uid !== uid);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: "USER_DELETED",
      target: uid,
      before: null,
      after: null,
    });
    return delay(undefined);
  }
  if (!idToken) throw new Error("An authenticated session is required to delete a user.");
  await backendDeleteUser(uid, idToken);
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action: "USER_DELETED",
    target: uid,
    before: null,
    after: null,
  });
}

/* ------------------------------------------------------------ generations */

export async function fetchGenerations(): Promise<GenerationRecord[]> {
  if (!isLiveData) return delay(clone(demoState.generations));
  return live(() => fetchGenerationsFromFirestore(), "Generations");
}

export async function fetchUsage(): Promise<UsageEvent[]> {
  if (!isLiveData) return delay(clone(demoState.usageEvents));
  return live(() => fetchUsageFromFirestore(), "Usage events");
}

/**
 * Generations enriched with the real recorded cost. `generationJobs` documents
 * carry no cost, so the backend's `generationUsageEvents` (`estimatedCostUsd`,
 * keyed by `jobId`) is the source of truth. A job may emit more than one usage
 * event (keyframe image + video), so the costs are summed per job.
 */
export async function fetchGenerationsWithCost(): Promise<GenerationRecord[]> {
  const [generations, usage] = await Promise.all([
    fetchGenerations(),
    fetchUsage(),
  ]);
  const costByJob = new Map<string, number>();
  for (const event of usage) {
    if (event.estimatedCostUsd == null) continue;
    costByJob.set(
      event.jobId,
      (costByJob.get(event.jobId) ?? 0) + event.estimatedCostUsd,
    );
  }
  return generations.map((generation) => ({
    ...generation,
    estimatedCost:
      generation.estimatedCost ?? costByJob.get(generation.id) ?? null,
  }));
}

/* --------------------------------------------------------------- templates */

export async function fetchTemplates(): Promise<TemplateRecord[]> {
  if (!isLiveData) return delay(clone(demoState.templates));
  return live(() => fetchTemplatesFromFirestore(), "Templates");
}

export async function fetchTemplateVersions(
  templateId: string,
): Promise<TemplateVersionRecord[]> {
  const template = demoState.templates.find((t) => t.id === templateId);
  if (!isLiveData) {
    return delay(template ? demoTemplateVersions(template) : []);
  }
  const result = await fetchTemplateVersionsFromFirestore(templateId);
  if (result === null) {
    throw new Error(
      "Template versions could not be read from Firestore. Verify that the admin Firestore security rules are deployed and that this account is authorized.",
    );
  }
  return result;
}

export async function saveTemplate(
  template: TemplateRecord,
  actor: Actor,
): Promise<TemplateRecord> {
  if (!isLiveData) {
    const index = demoState.templates.findIndex((t) => t.id === template.id);
    const next = { ...clone(template), updatedAt: new Date() };
    if (index >= 0) demoState.templates[index] = next;
    else demoState.templates.push(next);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: index >= 0 ? "TEMPLATE_UPDATED" : "TEMPLATE_CREATED",
      target: template.id,
      before: index >= 0 ? demoState.templates[index] : null,
      after: next,
    });
    return delay(next);
  }
  const ok = await saveTemplateToFirestore(template);
  if (!ok) throw new Error("Could not save the template to Firestore.");
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action: "TEMPLATE_UPDATED",
    target: template.id,
    before: null,
    after: template,
  });
  return template;
}

export async function deleteTemplate(
  id: string,
  actor: Actor,
): Promise<void> {
  if (!isLiveData) {
    demoState.templates = demoState.templates.filter((t) => t.id !== id);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: "TEMPLATE_DELETED",
      target: id,
      before: null,
      after: null,
    });
    return delay(undefined);
  }
  const ok = await deleteTemplateFromFirestore(id);
  if (!ok) throw new Error("Could not delete the template from Firestore.");
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action: "TEMPLATE_DELETED",
    target: id,
    before: null,
    after: null,
  });
}

/* ---------------------------------------------------------------- routing */

export async function fetchRouting(
  type: "image" | "video",
): Promise<RoutingConfig[]> {
  const contexts =
    type === "image"
      ? IMAGE_CONTEXTS.map((c) => c.id)
      : VIDEO_CONTEXTS.map((c) => c.id);
  if (!isLiveData) {
    return delay(
      clone(demoState.routing.filter((r) => r.type === type)),
    );
  }
  return live(
    () => fetchRoutingFromFirestore(type, contexts),
    "AI routing configuration",
  );
}

/** Every image and video routing configuration, for the tier-based page. */
export async function fetchAllRouting(): Promise<RoutingConfig[]> {
  if (!isLiveData) return delay(clone(demoState.routing));
  const [images, videos] = await Promise.all([
    fetchRouting("image"),
    fetchRouting("video"),
  ]);
  return [...images, ...videos];
}

export async function saveRouting(
  config: RoutingConfig,
  actor: Actor,
): Promise<RoutingConfig> {
  const next: RoutingConfig = {
    ...config,
    version: config.version + 1,
    updatedAt: new Date(),
    updatedBy: actor.uid,
  };
  if (!isLiveData) {
    const index = demoState.routing.findIndex((r) => r.id === config.id);
    if (index >= 0) demoState.routing[index] = next;
    else demoState.routing.push(next);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: "AI_ROUTING_UPDATED",
      target: config.id,
      before: clone(config),
      after: clone(next),
    });
    return delay(next);
  }
  const ok = await saveRoutingToFirestore(config, actor.uid);
  if (!ok) throw new Error("Could not save the routing configuration to Firestore.");
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action: "AI_ROUTING_UPDATED",
    target: config.id,
    before: config,
    after: next,
  });
  return next;
}

/* ------------------------------------------------------------------ plans */

export async function fetchPlans(): Promise<PlanConfig[]> {
  if (!isLiveData) return delay(clone(DEFAULT_PLANS.length ? demoState.plans : []));
  return live(() => fetchPlansFromFirestore(), "Plans");
}

export async function savePlan(
  plan: PlanConfig,
  actor: Actor,
): Promise<PlanConfig> {
  if (!isLiveData) {
    const index = demoState.plans.findIndex((p) => p.id === plan.id);
    if (index >= 0) demoState.plans[index] = clone(plan);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action: "PLAN_UPDATED",
      target: plan.id,
      before: index >= 0 ? clone(demoState.plans[index]) : null,
      after: clone(plan),
    });
    return delay(clone(plan));
  }
  const ok = await savePlanToFirestore(plan, actor.uid);
  if (!ok) throw new Error("Could not save the plan to Firestore.");
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action: "PLAN_UPDATED",
    target: plan.id,
    before: null,
    after: plan,
  });
  return plan;
}

/* ----------------------------------------------------------- app settings */

export async function fetchAppSettings(): Promise<AppSettings> {
  if (!isLiveData) return delay(clone(demoState.settings));
  const result = await fetchAppSettingsFromFirestore();
  if (!result) {
    // No saved settings yet: fall back to defaults rather than failing the page.
    return clone(demoState.settings);
  }
  return result;
}

export async function saveAppSettings(
  settings: AppSettings,
  actor: Actor,
  action: AuditLog["action"] = "APP_SETTINGS_UPDATED",
): Promise<AppSettings> {
  const next: AppSettings = {
    ...settings,
    version: settings.version + 1,
    updatedAt: new Date(),
    updatedBy: actor.uid,
  };
  if (!isLiveData) {
    demoState.settings = clone(next);
    recordDemoAudit({
      adminUid: actor.uid,
      adminEmail: actor.email,
      action,
      target: "app_settings",
      before: clone(settings),
      after: clone(next),
    });
    return delay(next);
  }
  const ok = await saveAppSettingsToFirestore(settings, actor.uid);
  if (!ok) throw new Error("Could not save app settings to Firestore.");
  await appendAuditLogToFirestore({
    adminUid: actor.uid,
    adminEmail: actor.email,
    action,
    target: "app_settings",
    before: settings,
    after: next,
  });
  return next;
}

/* ------------------------------------------------------------------- logs */

export async function fetchErrorLogs(): Promise<ErrorLog[]> {
  if (!isLiveData) return delay(clone(demoState.errorLogs));
  const result = await fetchErrorLogsFromFirestore();
  if (result && result.length) return result;
  // Derive operational failures from generation history when no dedicated
  // error-log collection is populated yet.
  const generations = await fetchGenerations();
  return generations
    .filter((g) => g.status === "failed" || g.fallbackUsed)
    .map<ErrorLog>((g) => ({
      id: `derived_${g.id}`,
      timestamp: g.completedAt ?? g.createdAt,
      severity: g.status === "failed" ? "error" : "warning",
      category:
        g.type === "image"
          ? "image_provider"
          : "video_provider",
      userId: g.uid,
      generationId: g.id,
      provider: g.provider,
      model: g.model,
      errorCode: g.errorCode ?? (g.fallbackUsed ? "FALLBACK_USED" : null),
      message:
        g.errorMessage ??
        (g.fallbackUsed
          ? "Primary provider failed; fallback provider completed the job."
          : "Generation failed."),
    }));
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  if (!isLiveData) return delay(clone(demoState.auditLogs));
  const result = await fetchAuditLogsFromFirestore();
  return result ?? [];
}

export function recordLocalLog(log: Omit<ErrorLog, "id">) {
  if (!isLiveData) pushDemoLog(log);
}

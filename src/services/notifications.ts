import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type Transaction,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useDemoData } from "@/lib/config";
import { toDate } from "@/lib/format";
import { adminFetch, BackendError } from "@/services/backend";
import {
  DEFAULT_SETTINGS,
  LOCALES,
  TEMPLATE_IDS,
  ZERO_STATS,
  audienceErrors,
  campaignErrors,
  canEditCampaign,
  canTransitionCampaign,
  contentErrors,
  isManualTemplate,
  localeMap,
  settingsErrors,
  type Audience,
  type CampaignStatus,
  type Locale,
  type NotificationCampaign,
  type NotificationContent,
  type NotificationLogEntry,
  type NotificationSettings,
  type NotificationTemplate,
} from "@/lib/notifications";

type Actor = { uid: string; email: string | null };
export interface AudienceCount {
  users: number;
  reachable: number;
}
export interface TranslationResult {
  translations: Partial<Record<Locale, { title: string; body: string }>>;
  failed: Partial<Record<Locale, string[]>>;
}
export interface TestResult {
  results: {
    uid: string;
    outcome: "sent" | "failed" | "no_devices" | "invalid_content";
    devices?: number;
  }[];
}
export function notificationError(error: unknown): string {
  if (error instanceof BackendError) {
    const code = error.code ?? "";
    const messages: Record<string, string> = {
      FORBIDDEN:
        "Your verified email must be authorized in the backend ADMIN_EMAILS.",
      AUTH_REQUIRED: "Sign in again to continue.",
      TRANSLATION_CREDITS_EXHAUSTED:
        "The translation provider needs credits. Top up the provider account and retry.",
      TRANSLATE_RATE_LIMITED:
        "Translation limit reached (20 per 10 minutes). Please try again later.",
      TRANSLATION_NOT_CONFIGURED:
        "The backend translation provider is not configured.",
      TRANSLATION_PROVIDER_FAILED:
        "The translation provider could not complete this request. Please retry.",
      TRANSLATION_BAD_RESPONSE:
        "The translation provider returned an invalid response. Please retry.",
      NO_TEST_RECIPIENTS: "Add test recipient UIDs in Settings first.",
      TEMPLATE_NOT_FOUND:
        "The seeded template was not found. Check backend notification setup.",
    };
    return messages[code] ?? `${error.message}${code ? ` (${code})` : ""}`;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}
async function post<T>(
  action: string,
  token: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await adminFetch(
    `/v1/admin/notifications/${action}`,
    token,
    { method: "POST", body: JSON.stringify(body), signal },
  );
  return response.json() as Promise<T>;
}
export function translateNotification(
  token: string,
  sourceLocale: Locale,
  title: string,
  body: string,
): Promise<TranslationResult> {
  return post("translate", token, {
    sourceLocale,
    title,
    body,
    targetLocales: LOCALES.filter((l) => l !== sourceLocale),
  });
}
export function previewAudience(
  token: string,
  audience: Audience,
  signal?: AbortSignal,
): Promise<AudienceCount> {
  assertValid(audienceErrors(audience));
  return post("audience-preview", token, { audience }, signal);
}
export function sendNotificationTest(
  token: string,
  payload:
    | { templateId: string; target: "self" | "testRecipients" }
    | { content: NotificationContent; target: "self" | "testRecipients" },
): Promise<TestResult> {
  if ("templateId" in payload) return post("test", token, payload);
  const { title, body, imageUrl, deepLink, channel } = payload.content;
  return post("test", token, {
    target: payload.target,
    content: {
      title,
      body,
      deepLink,
      channel,
      ...(imageUrl ? { imageUrl } : {}),
    },
  });
}
export function dispatchNotificationCampaign(token: string, campaignId: string): Promise<{
  id: string; status: CampaignStatus; stats: NotificationCampaign["stats"];
}> {
  return post("dispatch", token, { campaignId });
}
function database(): Firestore {
  const db = useDemoData ? null : getDb();
  if (!db)
    throw new Error(
      "Notifications require a live Firebase admin session. Demo mode cannot send or save notifications.",
    );
  return db;
}
function assertValid(errors: string[]) {
  if (errors.length) throw new Error(errors.join("\n"));
}
function content(data: Record<string, unknown>): NotificationContent {
  return {
    title: localeMap(data.title),
    body: localeMap(data.body),
    sourceLocale: LOCALES.includes(data.sourceLocale as Locale)
      ? (data.sourceLocale as Locale)
      : "tr",
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
    deepLink: (data.deepLink ??
      "livemoment://home") as NotificationContent["deepLink"],
    channel: (data.channel ??
      "product_updates") as NotificationContent["channel"],
  };
}
export function watchTemplates(
  next: (value: NotificationTemplate[]) => void,
  fail: (e: Error) => void,
) {
  return onSnapshot(
    collection(database(), "notificationTemplates"),
    (snapshot) =>
      next(
        snapshot.docs
          .filter(
            (d) =>
              TEMPLATE_IDS.some((id) => id === d.id) || isManualTemplate(d.id),
          )
          .map((d) => {
            const data = d.data();
            return {
              ...content(data),
              id: d.id as NotificationTemplate["id"],
              ...(typeof data.name === "string" ? { name: data.name } : {}),
              enabled: data.enabled === true,
              trigger: data.trigger ?? "",
              params: data.params ?? {},
              audience: data.audience ?? {
                plans: [],
                excludeAdminGrant: false,
              },
            };
          }),
      ),
    fail,
  );
}
export function watchSettings(
  next: (value: NotificationSettings) => void,
  fail: (e: Error) => void,
) {
  return onSnapshot(
    doc(database(), "notificationSettings", "global"),
    (snapshot) =>
      next({
        ...DEFAULT_SETTINGS,
        ...snapshot.data(),
        enabled: snapshot.data()?.enabled === true,
      } as NotificationSettings),
    fail,
  );
}
export function watchCampaigns(
  next: (value: NotificationCampaign[]) => void,
  fail: (e: Error) => void,
) {
  return onSnapshot(
    query(
      collection(database(), "notificationCampaigns"),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) =>
      next(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...content(data),
            id: d.id,
            audience: data.audience ?? { kind: "all" },
            scheduledAt: toDate(data.scheduledAt),
            createdAt: toDate(data.createdAt),
            status: data.status,
            stats: { ...ZERO_STATS, ...data.stats },
            lastError: data.lastError,
            deliveryReasons: data.deliveryReasons ?? {},
          } as NotificationCampaign;
        }),
      ),
    fail,
  );
}
function audit(
  transaction: Transaction,
  db: Firestore,
  actor: Actor,
  action: string,
  target: string,
  before: unknown,
  after: unknown,
) {
  transaction.set(doc(collection(db, "admin_audit_logs")), {
    adminUid: actor.uid,
    adminEmail: actor.email,
    action,
    target,
    before,
    after,
    createdAt: serverTimestamp(),
  });
}
function contentPayload(value: NotificationContent) {
  // Remove an image when cleared, rather than leaving an empty image URL.
  const { imageUrl, ...rest } = value;
  return { ...rest, ...(imageUrl ? { imageUrl } : {}) };
}
export async function saveNotificationTemplate(
  value: NotificationTemplate,
  actor: Actor,
) {
  assertValid(contentErrors(value, value.enabled));
  const manual = isManualTemplate(value.id);
  if (manual && !value.name?.trim())
    throw new Error("Give this template a name.");
  if (!TEMPLATE_IDS.some((id) => id === value.id) && !manual)
    throw new Error("Only seeded notification templates can be edited.");
  if (value.channel !== (manual ? "product_updates" : "plan_reminders"))
    throw new Error("Plan templates must use plan_reminders.");
  if (
    value.id === "plan_ending_soon" &&
    (!Number.isInteger(value.params.daysBefore) ||
      value.params.daysBefore! < 1 ||
      value.params.daysBefore! > 14 ||
      !Number.isInteger(value.params.sendHourLocal) ||
      value.params.sendHourLocal! < 0 ||
      value.params.sendHourLocal! > 23)
  )
    throw new Error("Days must be 1–14 and local send hour 0–23.");
  const db = database();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "notificationTemplates", value.id);
    const old = await tx.get(ref);
    if (!old.exists() && !manual)
      throw new Error("Template is missing. Run the backend seed first.");
    const payload = {
      ...contentPayload(value),
      ...(manual ? { enabled: false, name: value.name!.trim() } : {}),
      trigger: manual ? "manual" : old.data()!.trigger,
      updatedAt: serverTimestamp(),
    };
    tx.set(ref, payload);
    audit(
      tx,
      db,
      actor,
      "NOTIFICATION_TEMPLATE_UPDATED",
      value.id,
      old.data() ?? null,
      payload,
    );
  });
}
export async function saveNotificationSettings(
  value: NotificationSettings,
  actor: Actor,
  onlyEnabled = false,
) {
  if (!onlyEnabled) assertValid(settingsErrors(value));
  const db = database();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "notificationSettings", "global");
    const old = await tx.get(ref);
    const payload = {
      ...(onlyEnabled && old.exists() ? { enabled: value.enabled } : value),
      updatedAt: serverTimestamp(),
    };
    tx.set(ref, payload, { merge: true });
    audit(
      tx,
      db,
      actor,
      "NOTIFICATION_SETTINGS_UPDATED",
      "global",
      old.data() ?? null,
      payload,
    );
  });
}
export async function saveNotificationCampaign(
  value: NotificationCampaign,
  status: "draft" | "scheduled",
  actor: Actor,
) {
  assertValid(campaignErrors(value, status === "scheduled"));
  if (value.channel !== "product_updates")
    throw new Error("Notifications must use the product updates channel.");
  const db = database();
  const ref = value.id
    ? doc(db, "notificationCampaigns", value.id)
    : doc(collection(db, "notificationCampaigns"));
  await runTransaction(db, async (tx) => {
    const old = await tx.get(ref);
    if (value.id && !old.exists())
      throw new Error("This notification no longer exists.");
    if (old.exists() && !canEditCampaign(old.data().status))
      throw new Error(
        "This notification has started or finished. Use Send again from History.",
      );
    if (status === "scheduled") {
      const settings = await tx.get(doc(db, "notificationSettings", "global"));
      if (settings.data()?.enabled !== true)
        throw new Error(
          "Global notifications are disabled. Enable them in Settings first.",
        );
      assertValid(campaignErrors(value, true));
    }
    const payload = {
      ...contentPayload({
        title: value.title,
        body: value.body,
        sourceLocale: value.sourceLocale,
        imageUrl: value.imageUrl,
        deepLink: value.deepLink,
        channel: "product_updates",
      }),
      audience: value.audience,
      scheduledAt: value.scheduledAt
        ? Timestamp.fromDate(value.scheduledAt)
        : null,
      status,
    };
    // Preserve backend fields exactly; never reset stats or leases on edits.
    const after = old.exists()
      ? { ...old.data(), ...payload }
      : {
          ...payload,
          stats: ZERO_STATS,
          createdBy: actor.uid,
          createdAt: serverTimestamp(),
        };
    if (!value.imageUrl) delete after.imageUrl;
    tx.set(ref, after);
    audit(
      tx,
      db,
      actor,
      "NOTIFICATION_CAMPAIGN_UPDATED",
      ref.id,
      old.data() ?? null,
      payload,
    );
  });
  return ref.id;
}
export async function transitionNotificationCampaign(
  id: string,
  status: CampaignStatus,
  actor: Actor,
) {
  const db = database();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "notificationCampaigns", id);
    const old = await tx.get(ref);
    if (
      !old.exists() ||
      !canTransitionCampaign(old.data().status, status) ||
      status === "scheduled"
    )
      throw new Error("Notification status changed. Refresh and try again.");
    tx.update(ref, { status });
    audit(
      tx,
      db,
      actor,
      "NOTIFICATION_CAMPAIGN_STATUS_CHANGED",
      id,
      { status: old.data().status },
      { status },
    );
  });
}
export async function fetchNotificationLogs(
  filter: { templateId?: string; campaignId?: string } = {},
  days?: number,
): Promise<NotificationLogEntry[]> {
  const db = database();
  // Each query uses a single-field index. Filter-specific results are sorted locally.
  const constraints = filter.campaignId
    ? [where("campaignId", "==", filter.campaignId)]
    : filter.templateId
      ? [where("templateId", "==", filter.templateId)]
      : days
        ? [
            where(
              "createdAt",
              ">=",
              Timestamp.fromMillis(Date.now() - days * 86400000),
            ),
            orderBy("createdAt", "desc"),
          ]
        : [orderBy("createdAt", "desc"), limit(100)];
  const result = await getDocs(
    query(collection(db, "notificationLog"), ...constraints),
  );
  return result.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid,
        kind: data.kind,
        templateId: data.templateId,
        campaignId: data.campaignId,
        status: data.status,
        createdAt: toDate(data.createdAt),
        sentAt: toDate(data.sentAt),
        deviceCount: data.deviceCount ?? 0,
        deliveredCount: data.deliveredCount ?? 0,
        reason: data.reason,
      };
    })
    .sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
}

import { runtimeConfig } from "@/lib/config";

export class BackendError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
  }
}

export async function adminFetch(
  path: string,
  idToken: string,
  init?: RequestInit,
): Promise<Response> {
  if (!runtimeConfig.backendBaseUrl) {
    throw new BackendError("Backend base URL is not configured.", 0);
  }
  const response = await fetch(`${runtimeConfig.backendBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let code: string | undefined;
    let message = `Request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as {
        code?: string;
        message?: string;
        error?: string | { code?: string; message?: string };
      };
      const nested = typeof body.error === "object" ? body.error : undefined;
      code = nested?.code ?? body.code;
      message = nested?.message ?? body.message ??
        (typeof body.error === "string" ? body.error : message);
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new BackendError(message, response.status, code);
  }
  return response;
}

export interface BackendUserRecord {
  uid: string;
  email?: string | null;
  plan?: string;
  [key: string]: unknown;
}

export async function backendListUsers(
  idToken: string,
): Promise<BackendUserRecord[]> {
  const response = await adminFetch("/v1/admin/users", idToken);
  const body = (await response.json()) as unknown;
  if (Array.isArray(body)) return body as BackendUserRecord[];
  if (body && typeof body === "object") {
    const maybe = body as { users?: BackendUserRecord[]; data?: BackendUserRecord[] };
    if (Array.isArray(maybe.users)) return maybe.users;
    if (Array.isArray(maybe.data)) return maybe.data;
  }
  return [];
}

export async function backendDeleteUser(
  uid: string,
  idToken: string,
): Promise<void> {
  await adminFetch(`/v1/admin/users/${encodeURIComponent(uid)}`, idToken, {
    method: "DELETE",
  });
}

export interface QuotaCounters {
  images: number;
  motions: number;
  regenerations: number;
}

export interface QuotaSnapshot {
  cycleKey: string;
  imageCount: number;
  videoCount: number;
  replacementCount: number;
  dailyCount: number;
  grant: { images: number; videos: number; regenerations: number };
}

export interface QuotaHistoryEntry {
  id: string;
  adminUid: string;
  action: "grant" | "reset";
  delta: QuotaCounters;
  reason: string;
  cycleKey: string;
  before: QuotaSnapshot;
  after: QuotaSnapshot;
  createdAtEpochMs: number;
}

export interface QuotaOverview {
  uid: string;
  plan: string;
  cycle: "lifetime" | "billing_period" | "month";
  cycleKey: string;
  planLimits: QuotaCounters;
  adminGrant: QuotaCounters;
  effectiveLimits: QuotaCounters;
  used: QuotaCounters;
  standaloneWallpapersGranted: number;
  freePreviewUsed: boolean;
  history: QuotaHistoryEntry[];
}

export type QuotaAdjustment = {
  reason: string;
  requestId: string;
} & ({ action: "grant" } & QuotaCounters | { action: "reset" });

export interface QuotaAdjustmentResult {
  auditId: string;
  replayed: boolean;
  before: QuotaSnapshot;
  after: QuotaSnapshot;
  overview: QuotaOverview;
}

export async function backendGetQuota(uid: string, idToken: string): Promise<QuotaOverview> {
  const response = await adminFetch(`/v1/admin/users/${encodeURIComponent(uid)}/quota`, idToken);
  return response.json();
}

export async function backendAdjustQuota(
  uid: string,
  idToken: string,
  adjustment: QuotaAdjustment,
): Promise<QuotaAdjustmentResult> {
  const response = await adminFetch(`/v1/admin/users/${encodeURIComponent(uid)}/quota`, idToken, {
    method: "POST",
    body: JSON.stringify(adjustment),
  });
  return response.json();
}

/**
 * Placeholder for privileged actions that must be implemented on the trusted
 * backend (Cloud Run / Firebase Admin SDK). Until those endpoints exist the
 * admin panel surfaces a clear, actionable error instead of pretending success.
 */
export async function backendAdminAction(
  _path: string,
  _idToken: string,
  _body: unknown,
): Promise<void> {
  throw new BackendError(
    "This privileged action is not implemented on the backend yet. Add the corresponding admin endpoint to the Live Moment API.",
    501,
    "NOT_IMPLEMENTED",
  );
}

export interface AnalyticsFunnelStep {
  key: string;
  devices: number;
}

export interface AnalyticsFunnel {
  daily: Array<{
    date: string;
    installs: number;
    activeDevices: number;
    sessions: number;
  }>;
  funnel: AnalyticsFunnelStep[];
  lastScreen: Array<{ screen: string; devices: number }>;
  uninstalled: number;
  meta: {
    from: string;
    to: string;
    generatedAt: string;
    excludedDevices: number;
    note: string;
  };
}

/** App Funnel from the Firebase Analytics BigQuery export (per device). */
export async function backendGetAnalyticsFunnel(
  idToken: string,
  range?: { from?: string; to?: string },
): Promise<AnalyticsFunnel> {
  const query = new URLSearchParams();
  if (range?.from) query.set("from", range.from);
  if (range?.to) query.set("to", range.to);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await adminFetch(
    `/v1/admin/analytics/funnel${suffix}`,
    idToken,
  );
  return (await response.json()) as AnalyticsFunnel;
}

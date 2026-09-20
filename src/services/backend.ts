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

async function adminFetch(
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
      const body = (await response.json()) as { code?: string; message?: string; error?: string };
      code = body.code;
      message = body.message ?? body.error ?? message;
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

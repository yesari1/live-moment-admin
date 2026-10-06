import { getFirebaseAppCheckToken } from "@/lib/firebase";
import { adminFetch, BackendError } from "@/services/backend";

export interface PasswordLoginAccount {
  uid: string;
  email: string;
  passwordLogin: boolean;
  updatedAt?: string | null;
}

export type PasswordLoginUpdate =
  | { email: string; enabled: true; password: string }
  | { email: string; enabled: false };

// App Check is optional, like the other admin calls: the backend runs APP_CHECK_MODE=log,
// so the header is sent only when appCheckSiteKey is configured.
async function request(idToken: string, init?: RequestInit) {
  let token: string | null = null;
  try {
    token = await getFirebaseAppCheckToken();
  } catch {
    token = null;
  }
  return adminFetch("/v1/admin/password-login", idToken, {
    ...init,
    ...(token ? { headers: { "X-Firebase-AppCheck": token } } : {}),
  });
}

export async function listPasswordLoginAccounts(idToken: string): Promise<PasswordLoginAccount[]> {
  const response = await request(idToken);
  const body = await response.json() as { accounts: PasswordLoginAccount[] };
  return body.accounts;
}

export async function updatePasswordLoginAccount(
  idToken: string,
  update: PasswordLoginUpdate,
): Promise<Omit<PasswordLoginAccount, "updatedAt">> {
  const email = update.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BackendError("Invalid email.", 400, "INVALID_EMAIL");
  }
  if (update.enabled && (update.password.length < 8 || update.password.length > 128)) {
    throw new BackendError("Invalid password length.", 400, "INVALID_PASSWORD_LENGTH");
  }
  // Explicitly construct the body so disabling never transmits a password.
  const body = update.enabled
    ? { email, enabled: true, password: update.password }
    : { email, enabled: false };
  const response = await request(idToken, { method: "POST", body: JSON.stringify(body) });
  return response.json();
}

export function passwordLoginError(error: unknown): string {
  // Never display raw backend messages: they could contain submitted credentials.
  if (error instanceof BackendError) {
    if (error.code === "INVALID_EMAIL") return "Enter a valid email address.";
    if (error.code === "PASSWORD_TOO_SHORT" || error.code === "INVALID_PASSWORD_LENGTH") return "Password must contain 8–128 characters.";
    if (error.code === "USER_NOT_FOUND" || error.status === 404) return "Account not found. The user must sign in to the app at least once before setting a password.";
    if (error.status === 401) return "Your session could not be verified. Sign in again and retry.";
    if (error.status === 403) return "Access denied. Verify that your account has admin access.";
    if (error.status === 400) return "The request was rejected. Check the email and password requirements.";
  }
  return "Could not complete the request. Please retry.";
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendError } from "@/services/backend";
import { listPasswordLoginAccounts, updatePasswordLoginAccount, passwordLoginError } from "./password-login";
import { getFirebaseAppCheckToken } from "@/lib/firebase";

vi.mock("@/lib/config", () => ({ runtimeConfig: { backendBaseUrl: "https://backend.example" } }));
vi.mock("@/lib/firebase", () => ({ getFirebaseAppCheckToken: vi.fn().mockResolvedValue("app-check-token") }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("password login API contract", () => {
  it("lists enabled and disabled accounts with both authentication headers", async () => {
    const accounts = [
      { uid: "one", email: "one@example.com", passwordLogin: true, updatedAt: "2026-10-06T10:00:00.000Z" },
      { uid: "two", email: "two@example.com", passwordLogin: false },
    ];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts })));
    vi.stubGlobal("fetch", fetch);
    expect(await listPasswordLoginAccounts("id-token")).toEqual(accounts);
    expect(fetch).toHaveBeenCalledWith("https://backend.example/v1/admin/password-login", expect.objectContaining({ headers: {
      "Content-Type": "application/json", Authorization: "Bearer id-token", "X-Firebase-AppCheck": "app-check-token",
    } }));
  });

  it("sets a password on an existing email and disables without sending a password", async () => {
    const result = { uid: "existing", email: "user@example.com", passwordLogin: true };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(result))));
    vi.stubGlobal("fetch", fetch);
    expect(await updatePasswordLoginAccount("token", { email: " user@example.com ", enabled: true, password: "test-password" })).toEqual(result);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: "user@example.com", enabled: true, password: "test-password" });
    await updatePasswordLoginAccount("token", { email: "user@example.com", enabled: false });
    expect(fetch.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ email: "user@example.com", enabled: false });
  });

  it.each([7, 129])("rejects a password of length %s before sending credentials", async length => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(updatePasswordLoginAccount("token", { email: "user@example.com", enabled: true, password: "x".repeat(length) })).rejects.toMatchObject({ code: "INVALID_PASSWORD_LENGTH" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not send credentials if App Check fails", async () => {
    vi.mocked(getFirebaseAppCheckToken).mockRejectedValueOnce(new Error("verification failed"));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(updatePasswordLoginAccount("token", { email: "user@example.com", enabled: true, password: "test-password" })).rejects.toMatchObject({ code: "APP_CHECK_UNAVAILABLE" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps backend errors without exposing raw messages or credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "USER_NOT_FOUND" }), { status: 404 })));
    try { await listPasswordLoginAccounts("token"); } catch (err) {
      expect(passwordLoginError(err)).toContain("must sign in to the app at least once");
    }
    for (const status of [0, 400, 401, 403, 404, 500]) {
      expect(passwordLoginError(new BackendError("submitted-secret", status))).not.toContain("submitted-secret");
    }
    expect(passwordLoginError(new Error("submitted-secret"))).not.toContain("submitted-secret");
  });
});

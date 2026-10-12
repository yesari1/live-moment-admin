import { afterEach, describe, expect, it, vi } from "vitest";
import { backendAdjustQuota, backendGetQuota, backendListUsers } from "@/services/backend";

vi.mock("@/lib/config", () => ({ runtimeConfig: { backendBaseUrl: "https://backend.example" } }));
afterEach(() => vi.unstubAllGlobals());

describe("quota backend requests", () => {
  it("uses an encoded uid and bearer token for GET", async () => {
    const overview = { uid: "user/id", plan: "free", cycle: "lifetime" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(overview)));
    vi.stubGlobal("fetch", fetch);
    expect(await backendGetQuota("user/id", "token")).toEqual(overview);
    expect(fetch).toHaveBeenCalledWith("https://backend.example/v1/admin/users/user%2Fid/quota", expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer token" } }));
  });

  it("sends the same requestId and body on retries and returns replayed overview", async () => {
    const result = { auditId: "audit", replayed: true, overview: { adminGrant: { images: 2 } } };
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetch);
    const adjustment = { action: "grant" as const, images: 2, motions: 0, regenerations: 0, reason: "Support case", requestId: "same-id" };
    await expect(backendAdjustQuota("uid", "token", adjustment)).rejects.toThrow("network error");
    expect(await backendAdjustQuota("uid", "token", adjustment)).toEqual(result);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(adjustment);
  });

  it("sends reset without grant counters", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await backendAdjustQuota("uid", "token", { action: "reset", reason: "Support reset", requestId: "reset-id" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: "reset", reason: "Support reset", requestId: "reset-id" });
  });

  it.each([[401, "AUTH_REQUIRED"], [403, "FORBIDDEN"], [404, "USER_NOT_FOUND"], [400, "INVALID_ARGUMENT"], [409, "INVALID_ARGUMENT"], [500, "INTERNAL"]])("parses nested errors for status %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status: status as number })));
    await expect(backendGetQuota("uid", "token")).rejects.toMatchObject({ name: "BackendError", status, code });
  });

  it("preserves legacy error messages for existing endpoints", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "FORBIDDEN", error: "Access denied" }), { status: 403 })));
    await expect(backendListUsers("token")).rejects.toMatchObject({ message: "Access denied", code: "FORBIDDEN" });
  });
});

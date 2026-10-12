import { describe, expect, it } from "vitest";
import { BackendError } from "@/services/backend";
import { parseQuotaGrant, quotaErrorMessage, validQuotaReason } from "@/lib/quota";

describe("quota adjustment validation", () => {
  it("accepts positive integer grants through 100", () => {
    expect(parseQuotaGrant({ images: "100", motions: "1", regenerations: "0" })).toEqual({ images: 100, motions: 1, regenerations: 0 });
  });

  it.each(["101", "-1", "1.5", "", " ", "NaN", "Infinity"])("blocks invalid counter %s", (images) => {
    expect(parseQuotaGrant({ images, motions: "1", regenerations: "0" })).toBeNull();
  });

  it("blocks an empty grant", () => {
    expect(parseQuotaGrant({ images: "0", motions: "0", regenerations: "0" })).toBeNull();
  });

  it("requires a trimmed reason with 3–500 characters", () => {
    expect(validQuotaReason("   ")).toBe(false);
    expect(validQuotaReason(" ab ")).toBe(false);
    expect(validQuotaReason(" abc ")).toBe(true);
    expect(validQuotaReason("a".repeat(500))).toBe(true);
    expect(validQuotaReason("a".repeat(501))).toBe(false);
  });
});

describe("quota error messages", () => {
  it.each([
    [401, "AUTH_REQUIRED", "Sign in again"],
    [403, "FORBIDDEN", "not a backend admin"],
    [404, "USER_NOT_FOUND", "User no longer exists"],
    [400, "INVALID_ARGUMENT", "Total grants cannot exceed 1000"],
    [409, "INVALID_ARGUMENT", "no quota configuration"],
    [503, "INTERNAL", "Retry the same operation safely"],
  ])("maps status %s", (status, code, message) => {
    expect(quotaErrorMessage(new BackendError("failed", status as number, code as string))).toContain(message);
  });

  it("maps network failures to a safe retry", () => {
    expect(quotaErrorMessage(new TypeError("Failed to fetch"))).toContain("Retry the same operation safely");
  });
});

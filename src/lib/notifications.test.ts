import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  LOCALES,
  audienceErrors,
  campaignErrors,
  canEditCampaign,
  canTransitionCampaign,
  contentErrors,
  contentFingerprint,
  emptyCampaign,
  expandedText,
  localeMap,
  previewText,
  settingsErrors,
} from "./notifications";

function completeCampaign() {
  const value = emptyCampaign();
  for (const l of LOCALES) {
    value.title[l] = "Hello";
    value.body[l] = "Welcome to Live Moment";
  }
  value.audience = { kind: "uids", uids: ["admin"] };
  return value;
}
describe("notification localization and validation", () => {
  it("migrates legacy strings to English and writes precisely six supported locale keys", () => {
    expect(localeMap("Legacy title")).toEqual({
      en: "Legacy title",
      tr: "",
      es: "",
      "pt-BR": "",
      de: "",
      fr: "",
    });
    expect(
      Object.keys(
        localeMap({ pt_BR: "wrong key", "pt-BR": "correct", xx: "extra" }),
      ),
    ).toEqual([...LOCALES]);
    expect(localeMap({ "pt-BR": "correct" })["pt-BR"]).toBe("correct");
  });
  it("requires both fields in every language before scheduling", () => {
    const value = completeCampaign();
    value.body.de = "";
    expect(campaignErrors(value, true)).toContain("Deutsch: body is empty");
    expect(campaignErrors(value, false)).not.toContain(
      "Deutsch: body is empty",
    );
    value.title.en = "";
    expect(campaignErrors(value, true)).toContain("English: title is empty");
  });
  it("counts expanded placeholder length and localizes the lock-screen date", () => {
    const value = completeCampaign();
    value.title.tr = `${"x".repeat(35)} {planName}`;
    expect(contentErrors(value)).toContain(
      "Türkçe: title exceeds 50 characters after placeholders",
    );
    expect(expandedText("{planName} · {date}")).toBe(
      "Live Weather Plus · 30 September 2026",
    );
    expect(previewText("{date}", "tr")).toBe("3 Kasım 2026");
  });
  it("checks placeholder sets per field using the selected English or Turkish source", () => {
    const value = completeCampaign();
    value.sourceLocale = "en";
    for (const l of LOCALES) value.title[l] = "Until {date}";
    expect(contentErrors(value)).toEqual([]);
    value.title.fr = "Until {datum}";
    expect(contentErrors(value)).toContain(
      "Français: title placeholders differ from the source",
    );
    expect(contentErrors(value)).toContain(
      "Français: title has an unknown placeholder",
    );
  });
  it("rejects insecure image URLs, empty plan/UID audiences and past dates", () => {
    const value = completeCampaign();
    value.imageUrl = "http://example.com/image.png";
    value.audience = { kind: "plans", plans: [] };
    value.scheduledAt = new Date(0);
    expect(campaignErrors(value, true)).toEqual(
      expect.arrayContaining([
        "Image must be a valid HTTPS URL.",
        "Select at least one plan.",
        "Scheduled time must be in the future.",
      ]),
    );
    expect(audienceErrors({ kind: "uids", uids: [] })).toContain(
      "Add at least one account UID.",
    );
    expect(
      audienceErrors({ kind: "uids", uids: Array(1001).fill("uid") }),
    ).toContain("At most 1,000 account UIDs are allowed.");
  });
  it("invalidates the exact-content test when text, images, links or channel change", () => {
    const value = completeCampaign();
    const fingerprint = contentFingerprint(value);
    for (const change of [
      { title: { ...value.title, tr: "Changed" } },
      { imageUrl: "https://example.com/new.png" },
      { deepLink: "livemoment://plan" as const },
      { channel: "plan_reminders" as const },
    ]) {
      expect(contentFingerprint({ ...value, ...change })).not.toBe(fingerprint);
    }
    expect(contentFingerprint({ ...value, sourceLocale: "en" })).toBe(
      fingerprint,
    );
  });
  it("keeps backend-owned statuses read only but allows cancellation at the next batch", () => {
    expect(canTransitionCampaign("sending", "cancelled")).toBe(true);
    expect(canTransitionCampaign("scheduled", "draft")).toBe(true);
    expect(canTransitionCampaign("sent", "draft")).toBe(false);
    expect(canTransitionCampaign("failed", "scheduled")).toBe(false);
    expect(canEditCampaign("sending")).toBe(false);
    expect(canEditCampaign("cancelled")).toBe(false);
  });
  it("accepts overnight quiet hours and validates the daily cap and IANA zone", () => {
    expect(
      settingsErrors({
        ...DEFAULT_SETTINGS,
        quietHours: { start: "22:00", end: "08:00" },
        defaultTimezone: "Europe/Istanbul",
      }),
    ).toEqual([]);
    expect(
      settingsErrors({
        ...DEFAULT_SETTINGS,
        maxPerUserPerDay: 2.5,
        defaultTimezone: "not-a-zone",
        quietHours: { start: "25:00", end: "08:00" },
      }),
    ).toHaveLength(3);
  });
});

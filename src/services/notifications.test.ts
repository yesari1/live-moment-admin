import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCALES,
  emptyCampaign,
  emptyManualTemplate,
} from "@/lib/notifications";

const firestore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  runtimeConfig: { backendBaseUrl: "https://backend.example" },
  useDemoData: false,
}));
vi.mock("@/lib/firebase", () => ({ getDb: () => ({}) }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, path: string) => path,
  doc: (_db: unknown, path?: string, id?: string) => ({
    path: path ? `${path}/${id}` : "audit/generated-id",
    id: id ?? "generated-id",
  }),
  runTransaction: async (
    _db: unknown,
    action: (tx: typeof firestore) => Promise<void>,
  ) => action(firestore),
}));
import {
  notificationError,
  previewAudience,
  saveNotificationCampaign,
  saveNotificationTemplate,
  sendNotificationTest,
  transitionNotificationCampaign,
  translateNotification,
} from "./notifications";
import { BackendError } from "./backend";
const actor = { uid: "admin", email: "admin@example.com" };
function campaign() {
  const value = emptyCampaign();
  for (const l of LOCALES) {
    value.title[l] = "Hello";
    value.body[l] = "Welcome";
  }
  value.audience = { kind: "uids", uids: ["admin"] };
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());
describe("notification endpoint contracts", () => {
  it.each(["tr", "en"] as const)(
    "translates from %s into the other five locales with authentication",
    async (source) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ translations: {}, failed: {} })),
        );
      vi.stubGlobal("fetch", fetch);
      await translateNotification("id-token", source, "Title", "Body");
      expect(fetch).toHaveBeenCalledWith(
        "https://backend.example/v1/admin/notifications/translate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer id-token",
          }),
        }),
      );
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
        sourceLocale: source,
        title: "Title",
        body: "Body",
        targetLocales: LOCALES.filter((l) => l !== source),
      });
    },
  );
  it("sends template tests without unsaved content and forwards audience cancellation", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetch);
    await sendNotificationTest("token", {
      templateId: "plan_renewed",
      target: "self",
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      templateId: "plan_renewed",
      target: "self",
    });
    const signal = new AbortController().signal;
    await previewAudience("token", { kind: "all" }, signal);
    expect(fetch.mock.calls[1][1].signal).toBe(signal);
  });
  it("turns nested provider credit errors into an actionable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "TRANSLATION_CREDITS_EXHAUSTED" },
          }),
          { status: 502 },
        ),
      ),
    );
    try {
      await translateNotification("token", "en", "Title", "Body");
      throw new Error("Expected failure");
    } catch (e) {
      expect(e).toBeInstanceOf(BackendError);
      expect(notificationError(e)).toContain("needs credits");
    }
  });
  it("sends only content fields for campaign tests, omitting campaign metadata and empty images", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const value = campaign();
    await sendNotificationTest("token", { content: value, target: "self" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      target: "self",
      content: {
        title: value.title,
        body: value.body,
        deepLink: value.deepLink,
        channel: "product_updates",
      },
    });
  });
});
describe("transactional campaign ownership", () => {
  it("creates a named manual template with an audit record and no automatic trigger", async () => {
    firestore.get.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    const template = emptyManualTemplate();
    template.name = "  Product announcement  ";
    template.title.tr = "Merhaba";
    template.body.tr = "Yeni içerik hazır";
    await saveNotificationTemplate(template, actor);
    expect(firestore.set.mock.calls[0][1]).toMatchObject({
      name: "Product announcement",
      enabled: false,
      trigger: "manual",
      channel: "product_updates",
    });
    expect(firestore.set.mock.calls[1][1]).toMatchObject({
      action: "NOTIFICATION_TEMPLATE_UPDATED",
      before: null,
    });
  });
  it("rejects scheduling if global delivery was disabled after the confirmation", async () => {
    firestore.get
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ data: () => ({ enabled: false }) });
    await expect(
      saveNotificationCampaign(campaign(), "scheduled", actor),
    ).rejects.toThrow("Global notifications are disabled");
    expect(firestore.set).not.toHaveBeenCalled();
  });
  it("rejects an edit if the dispatcher started while the editor was open", async () => {
    firestore.get.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: "sending" }),
    });
    await expect(
      saveNotificationCampaign(
        { ...campaign(), id: "existing" },
        "draft",
        actor,
      ),
    ).rejects.toThrow("started or finished");
    expect(firestore.set).not.toHaveBeenCalled();
  });
  it("preserves backend stats and lease fields on edits and omits cleared images", async () => {
    const stats = { targeted: 9, sent: 2, failed: 0, skipped: 1, deferred: 6 };
    firestore.get.mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: "scheduled",
        stats,
        leaseUntilMs: 123,
        imageUrl: "https://old.example/image.png",
        createdBy: "original",
      }),
    });
    await saveNotificationCampaign(
      { ...campaign(), id: "existing" },
      "draft",
      actor,
    );
    const stored = firestore.set.mock.calls[0][1];
    expect(stored).toMatchObject({
      status: "draft",
      stats,
      leaseUntilMs: 123,
      createdBy: "original",
    });
    expect(stored).not.toHaveProperty("imageUrl");
    expect(firestore.set.mock.calls[1][1]).toMatchObject({
      adminUid: "admin",
      action: "NOTIFICATION_CAMPAIGN_UPDATED",
    });
  });
  it("allows cancelling a sending campaign, but never overwrites a completed status", async () => {
    firestore.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: "sending" }),
    });
    await transitionNotificationCampaign("existing", "cancelled", actor);
    expect(firestore.update).toHaveBeenCalledWith(expect.anything(), {
      status: "cancelled",
    });
    firestore.update.mockClear();
    firestore.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: "sent" }),
    });
    await expect(
      transitionNotificationCampaign("existing", "cancelled", actor),
    ).rejects.toThrow("status changed");
    expect(firestore.update).not.toHaveBeenCalled();
  });
});

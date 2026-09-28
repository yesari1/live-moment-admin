import { describe, expect, it } from "vitest";

import { mapAiModel, mapFeedback, normalizeStatus } from "@/services/firestore-repo";
import { sumEventCost } from "@/services/data-service";
import type { UsageEvent } from "@/types";

function usageEvent(partial: Partial<UsageEvent>): UsageEvent {
  return {
    id: "event",
    userId: "uid",
    jobId: "job",
    templateId: null,
    stage: "video",
    provider: "pixazo",
    model: "pixazo_minimax_h3_max_turbo",
    status: "success",
    estimatedCostUsd: null,
    estimatedCostTry: null,
    durationSeconds: null,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    ...partial,
  };
}

describe("mapAiModel", () => {
  it("reads the document id as the model id and maps the canonical stage", () => {
    const model = mapAiModel("higgsfield_marketing_studio_image", {
      id: "higgsfield_marketing_studio_image",
      provider: "higgsfield",
      stage: "image",
      enabled: true,
      displayName: "Marketing Studio Image 2.0 (Higgsfield)",
    });

    expect(model).not.toBeNull();
    expect(model?.id).toBe("higgsfield_marketing_studio_image");
    expect(model?.provider).toBe("higgsfield");
    expect(model?.type).toBe("image");
    expect(model?.displayName).toBe("Marketing Studio Image 2.0 (Higgsfield)");
  });

  it("accepts the legacy `type` alias and defaults capabilities", () => {
    const model = mapAiModel("pixazo_flux_2_pro", {
      provider: "pixazo",
      type: "video",
    });

    expect(model?.type).toBe("video");
    expect(model?.displayName).toBe("pixazo_flux_2_pro");
    expect(model?.enabled).toBe(true);
    expect(model?.capabilities).toEqual({
      imageInput: true,
      supportedAspectRatios: [],
      supportedResolutions: [],
      supportedDurationsSeconds: [],
    });
  });

  it("parses published capabilities", () => {
    const model = mapAiModel("higgsfield_minimax_h3", {
      provider: "higgsfield",
      stage: "video",
      capabilities: {
        imageInput: true,
        supportedAspectRatios: ["9:16"],
        supportedResolutions: ["1080p"],
        supportedDurationsSeconds: [6, "10"],
      },
    });

    expect(model?.capabilities?.supportedResolutions).toEqual(["1080p"]);
    expect(model?.capabilities?.supportedDurationsSeconds).toEqual([6, 10]);
  });

  it("rejects documents without a provider or a known stage", () => {
    expect(mapAiModel("orphan", { stage: "image" })).toBeNull();
    expect(mapAiModel("orphan", { provider: "pixazo", stage: "audio" })).toBeNull();
  });

  it("keeps a model disabled when the document says so", () => {
    const model = mapAiModel("pixazo_ltx_video_free", {
      provider: "pixazo",
      stage: "video",
      enabled: false,
    });

    expect(model?.enabled).toBe(false);
  });
});

describe("mapFeedback", () => {
  it("maps a feedback document written by the backend", () => {
    const record = mapFeedback("feedback_1", {
      uid: "user_1",
      email: "user@example.com",
      plan: "live_weather_plus",
      standaloneWallpapersGranted: 2,
      message: "  The loop jumps.  ",
      createdAtEpochMs: 1_757_000_000_000,
    });

    expect(record).toMatchObject({
      id: "feedback_1",
      uid: "user_1",
      email: "user@example.com",
      plan: "live_weather_plus",
      standaloneWallpapersGranted: 2,
      message: "  The loop jumps.  ",
    });
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it("tolerates a document with only a message", () => {
    const record = mapFeedback("feedback_2", { message: "hello" });

    expect(record.uid).toBe("");
    expect(record.email).toBeNull();
    expect(record.plan).toBeNull();
    expect(record.standaloneWallpapersGranted).toBe(0);
    expect(record.createdAt).toBeNull();
  });
});

describe("sumEventCost", () => {
  it("adds every priced leg of a job", () => {
    const total = sumEventCost([
      usageEvent({ id: "a", stage: "image", estimatedCostUsd: 0.03 }),
      usageEvent({ id: "b", stage: "video", estimatedCostUsd: 0.12 }),
    ]);

    expect(total).toBeCloseTo(0.15, 6);
  });

  it("ignores legs the backend could not price", () => {
    const total = sumEventCost([
      usageEvent({ id: "a", stage: "image", estimatedCostUsd: null }),
      usageEvent({ id: "b", stage: "video", estimatedCostUsd: 0.12 }),
    ]);

    expect(total).toBeCloseTo(0.12, 6);
  });

  it("stays uncosted when nothing was priced", () => {
    expect(sumEventCost([usageEvent({ estimatedCostUsd: null })])).toBeNull();
    expect(sumEventCost([])).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("maps backend statuses to the console vocabulary", () => {
    expect(normalizeStatus("ready")).toBe("completed");
    expect(normalizeStatus("generating")).toBe("processing");
    expect(normalizeStatus("draft")).toBe("queued");
    expect(normalizeStatus("expired")).toBe("cancelled");
  });
});

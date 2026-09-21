import { describe, expect, it } from "vitest";
import {
  mapTemplateVersion,
  promptToText,
  scalarToString,
  versionNumberFrom,
} from "@/lib/template-version";

describe("mapTemplateVersion", () => {
  it("maps a version document with string prompts and config", () => {
    const version = mapTemplateVersion("3", {
      version: 3,
      active: true,
      type: "video",
      provider: "pixazo",
      model: "pixazo_ltx_2_5_pro",
      videoPrompt: "A calm sunset over the sea.",
      negativePrompt: "blur, text",
      systemPrompt: "You are a prompt engineer.",
      parameters: { durationSeconds: 6, resolution: "1080p" },
      quality: "high",
      createdAt: new Date("2026-01-02T10:00:00Z"),
    });

    expect(version.id).toBe("3");
    expect(version.versionNumber).toBe(3);
    expect(version.isActive).toBe(true);
    expect(version.type).toBe("video");
    expect(version.provider).toBe("pixazo");
    expect(version.model).toBe("pixazo_ltx_2_5_pro");
    expect(version.prompts.map((p) => p.label)).toContain("Video prompt");
    expect(version.prompts.map((p) => p.label)).toContain("Negative prompt");
    expect(version.prompts.map((p) => p.label)).toContain("System prompt");
    expect(version.config).toMatchObject({
      durationSeconds: 6,
      resolution: "1080p",
    });
    expect(version.attributes.some((a) => a.key === "quality")).toBe(true);
    expect(version.createdAt).toBeInstanceOf(Date);
  });

  it("keeps a structured prompt object intact (no [object Object])", () => {
    const structured = {
      subject: "dog running",
      lighting: "golden hour",
      negative: "blur",
    };
    const version = mapTemplateVersion("prompt_v7", {
      keyframePrompt: structured,
    });

    const keyframe = version.prompts.find((p) => p.label === "Keyframe prompt");
    expect(keyframe?.value).toEqual(structured);
    const text = promptToText(keyframe!.value);
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("dog running");
  });

  it("derives the version number from the document id and falls back safely", () => {
    expect(versionNumberFrom("v12", {})).toBe(12);
    expect(versionNumberFrom("abc", {})).toBeNull();
    expect(versionNumberFrom("abc", { version: 4 })).toBe(4);
  });

  it("defaults unknown or missing type to null", () => {
    expect(mapTemplateVersion("1", { type: "audio" }).type).toBeNull();
    expect(mapTemplateVersion("1", {}).type).toBeNull();
    expect(mapTemplateVersion("1", { keyframeOnly: true }).type).toBe("image");
  });

  it("does not throw when optional fields are missing", () => {
    const version = mapTemplateVersion("1", {});
    expect(version.prompts).toEqual([]);
    expect(version.config).toBeNull();
    expect(version.attributes).toEqual([]);
    expect(version.createdAt).toBeNull();
  });
});

describe("promptToText / scalarToString", () => {
  it("handles strings, numbers and null", () => {
    expect(promptToText("hello")).toBe("hello");
    expect(promptToText(5)).toBe("5");
    expect(promptToText(null)).toBe("");
    expect(scalarToString(null)).toBe("—");
    expect(scalarToString(0)).toBe("0");
  });

  it("pretty-prints nested objects", () => {
    const text = promptToText({ a: { b: 1 } });
    expect(text).toContain('"b": 1');
  });
});

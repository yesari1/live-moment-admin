import { describe, expect, it } from "vitest";
import { buildFunnelRows, formatPercent } from "./funnel";

describe("buildFunnelRows", () => {
  it("computes shares of the previous step and of installs", () => {
    const rows = buildFunnelRows([
      { key: "installs", devices: 20 },
      { key: "onboarding_seen", devices: 10 },
      { key: "photo_selected", devices: 5 },
    ]);
    expect(rows[0].ofPrevious).toBeNull();
    expect(rows[1].ofPrevious).toBe(0.5);
    expect(rows[2].ofPrevious).toBe(0.5);
    expect(rows[2].ofInstalls).toBe(0.25);
    expect(rows[1].label).toBe("Onboarding seen");
  });

  it("handles zero installs and zero previous steps", () => {
    const rows = buildFunnelRows([
      { key: "installs", devices: 0 },
      { key: "photo_selected", devices: 0 },
    ]);
    expect(rows[1].ofPrevious).toBeNull();
    expect(rows[1].ofInstalls).toBeNull();
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.256)).toBe("26%");
  });
});

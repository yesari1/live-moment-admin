import { describe, expect, it } from "vitest";
import {
  filterByTestAccount,
  isTestAccount,
  testAccountKind,
} from "@/lib/test-accounts";
import { demoUsers } from "@/services/demo-data";

const device = { kind: "device", since: new Date("2026-09-20") } as const;
const suspected = { kind: "suspected", since: null } as const;

describe("testAccountKind", () => {
  it("is real without a label", () => {
    expect(testAccountKind({})).toBe("real");
    expect(testAccountKind({ testDevice: null })).toBe("real");
  });

  it("returns the stored label", () => {
    expect(testAccountKind({ testDevice: device })).toBe("device");
    expect(testAccountKind({ testDevice: suspected })).toBe("suspected");
  });

  it("falls back to real for an unknown label", () => {
    expect(
      testAccountKind({ testDevice: { kind: "other" } as never }),
    ).toBe("real");
  });
});

describe("isTestAccount", () => {
  it("counts a free labelled account as a test account", () => {
    expect(
      isTestAccount({ testDevice: device, plan: "free", billingVerified: false }),
    ).toBe(true);
    expect(
      isTestAccount({ testDevice: suspected, plan: "free", billingVerified: false }),
    ).toBe(true);
  });

  it("counts a labelled account on a paid plan as real", () => {
    expect(
      isTestAccount({ testDevice: suspected, plan: "live_weather" }),
    ).toBe(false);
    expect(isTestAccount({ testDevice: device, plan: "live_weather_plus" })).toBe(
      false,
    );
  });

  it("counts a labelled account with verified billing as real", () => {
    expect(
      isTestAccount({ testDevice: suspected, plan: "free", billingVerified: true }),
    ).toBe(false);
  });

  it("counts an unlabelled account as real", () => {
    expect(isTestAccount({ plan: "free" })).toBe(false);
  });
});

describe("filterByTestAccount", () => {
  const users = [
    { uid: "real_1" },
    { uid: "real_2" },
    { uid: "device_1", testDevice: device },
    { uid: "suspected_1", testDevice: suspected },
    { uid: "paid_1", testDevice: suspected, plan: "live_weather" as const },
  ];

  it("keeps only real users by default", () => {
    expect(filterByTestAccount(users, "real").map((u) => u.uid)).toEqual([
      "real_1",
      "real_2",
      "paid_1",
    ]);
  });

  it("keeps only test accounts for the test filter", () => {
    expect(filterByTestAccount(users, "test").map((u) => u.uid)).toEqual([
      "device_1",
      "suspected_1",
    ]);
  });

  it("keeps everything for all", () => {
    expect(filterByTestAccount(users, "all")).toHaveLength(users.length);
  });
});

describe("demo data test label coverage", () => {
  it("covers device, suspected and unlabelled users", () => {
    const kinds = demoUsers.map(testAccountKind);

    expect(kinds).toContain("device");
    expect(kinds).toContain("suspected");
    expect(kinds.filter((kind) => kind === "real").length).toBeGreaterThan(0);
  });

  it("labels enough free accounts for the Test devices filter", () => {
    expect(demoUsers.filter(isTestAccount).length).toBeGreaterThanOrEqual(2);
  });
});


describe("automatic and manual decisions", () => {
  const robot = { email: "marshallmonosz.72-834@gmail.com", createdAt: new Date("2026-10-01"), plan: "free" as const };
  it("recognizes both Google robot suffix formats without a stored device flag", () => {
    expect(testAccountKind(robot)).toBe("suspected");
    expect(testAccountKind({ ...robot, email: "bethanymassey.76051@gmail.com" })).toBe("suspected");
    expect(testAccountKind({ ...robot, email: "roykelley.2246@gmail.com" })).toBe("real");
  });
  it("keeps purchases, old accounts and cleared guesses out of automatic detection", () => {
    expect(testAccountKind({ ...robot, hasPurchase: true })).toBe("real");
    expect(testAccountKind({ ...robot, billingVerified: true })).toBe("real");
    expect(testAccountKind({ ...robot, createdAt: new Date("2025-01-01") })).toBe("real");
    expect(testAccountKind({ ...robot, testLabelCleared: true })).toBe("real");
  });
  it("honors manual decisions even for paid accounts and detected devices", () => {
    expect(isTestAccount({ ...robot, plan: "live_weather", testAccountOverride: true })).toBe(true);
    expect(testAccountKind({ ...robot, testDevice: device, testAccountOverride: false })).toBe("real");
  });
});

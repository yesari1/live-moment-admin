import { describe, expect, it } from "vitest";
import {
  mapPurchase,
  mapPurchaseRecords,
  purchaseLabel,
  purchasesInRange,
  summarizePurchases,
} from "@/services/purchases";

const purchase = (overrides: Record<string, unknown> = {}) =>
  mapPurchase("p1", {
    uid: "buyer",
    productId: "one_time_1",
    productType: "consumable",
    purchaseState: "purchased",
    firstSeenAt: "2026-10-12T13:36:48Z",
    entitlementEffect: { credits: 1 },
    ...overrides,
  });

describe("purchase analytics", () => {
  it("counts renewal orders on their charge dates and never duplicates the token", () => {
    const original = "GPA.1234-5678-9012-34567";
    const renewal = `${original}..0`;
    const records = mapPurchaseRecords("token", {
      uid: "buyer",
      productId: "live_weather_monthly",
      productType: "subscription",
      purchaseState: "expired",
      firstSeenAt: "2026-09-12T00:00:00Z",
      originalOrderId: original,
      orders: {
        [original]: {
          orderId: original,
          state: "PROCESSED",
          amount: 5,
          currency: "USD",
          purchasedAt: "2026-09-12T00:00:00Z",
        },
        [renewal]: {
          orderId: renewal,
          state: "PROCESSED",
          amount: 5,
          currency: "USD",
          purchasedAt: "2026-10-12T00:00:00Z",
        },
      },
    });
    expect(records).toHaveLength(2);
    const today = purchasesInRange(records, new Date("2026-10-12"), null);
    expect(today.map((p) => p.orderId)).toEqual([renewal]);
    expect(summarizePurchases(today).revenue).toBe("$5.00");
  });
  it("keeps test orders visible but excludes them and refunds from income", () => {
    const orderId = "GPA.1234-5678-9012-34567";
    const records = mapPurchaseRecords("token", {
      uid: "buyer",
      productId: "one_time_1",
      productType: "consumable",
      testPurchase: true,
      orders: {
        [orderId]: {
          orderId,
          state: "PROCESSED",
          amount: 5,
          currency: "USD",
          purchasedAt: "2026-10-12T00:00:00Z",
        },
      },
    });
    expect(records[0].testPurchase).toBe(true);
    expect(summarizePurchases(records).granted).toHaveLength(0);
    expect(
      summarizePurchases([
        purchase({ purchaseState: "voided", amount: 5, currency: "USD" }),
      ]).revenue,
    ).toBe("No sales");
  });
  it("preserves an unpriced original when only a later renewal is recovered", () => {
    const original = "GPA.1234-5678-9012-34567";
    const orderId = `${original}..0`;
    const records = mapPurchaseRecords("token", {
      ...purchase(),
      productType: "subscription",
      purchaseState: "expired",
      firstSeenAt: "2026-09-12T00:00:00Z",
      originalOrderId: original,
      orders: {
        [orderId]: {
          orderId,
          state: "PROCESSED",
          amount: 5,
          currency: "USD",
          purchasedAt: "2026-10-12T00:00:00Z",
        },
      },
    });
    expect(records).toHaveLength(2);
    expect(summarizePurchases(records).missingAmounts).toBe(1);
  });
  it("keeps the original purchase day after re-verification or renewal", () => {
    const record = purchase({
      firstSeenAt: "2026-09-22T10:00:00Z",
      completedAt: "2026-10-12T10:00:00Z",
      lastVerifiedAt: "2026-10-12T10:00:00Z",
    });
    expect(
      purchasesInRange(
        [record],
        new Date("2026-10-12T00:00:00Z"),
        new Date("2026-10-12T23:59:59Z"),
      ),
    ).toHaveLength(0);
  });
  it("includes expired and replaced original sales and excludes ungranted/revoked records", () => {
    const records = [
      "purchased",
      "expired",
      "replaced",
      "pending",
      "cancelled",
      "voided",
      "unknown",
    ].map((purchaseState) => purchase({ purchaseState }));
    expect(summarizePurchases(records).granted).toHaveLength(3);
  });
  it("counts buyers once while retaining multiple products and purchases", () => {
    const summary = summarizePurchases([
      purchase(),
      purchase({
        productType: "subscription",
        productId: "live_weather_monthly",
      }),
      purchase({
        productType: "subscription",
        productId: "live_weather_plus_monthly",
      }),
    ]);
    expect(summary.buyers).toBe(1);
    expect(summary.subscriptionBuyers).toBe(1);
    expect(summary.subscriptions).toHaveLength(2);
    expect(summary.oneTime).toHaveLength(1);
  });
  it("never treats missing transaction amounts as zero revenue", () => {
    expect(summarizePurchases([purchase()]).revenue).toBe("Unavailable");
    expect(
      summarizePurchases([purchase({ amount: 5, currency: "USD" }), purchase()])
        .revenue,
    ).toBe("Unavailable");
    expect(summarizePurchases([]).revenue).toBe("No sales");
  });
  it("keeps currencies separate and supports recorded zero amounts", () => {
    expect(
      summarizePurchases([
        purchase({ amount: 4, currency: "USD" }),
        purchase({ amount: 2, currency: "USD" }),
        purchase({ amount: 30, currency: "TRY" }),
      ]).revenue,
    ).toBe("$6.00 · TRY 30.00");
    expect(
      summarizePurchases([purchase({ amount: 0, currency: "USD" })]).revenue,
    ).toBe("$0.00");
    expect(purchase({ amount: Number.NaN, currency: "USD" }).amount).toBeNull();
  });
  it("maps live single and pack IDs without guessing unknown product names", () => {
    expect(purchaseLabel(purchase())).toBe("Single wallpaper");
    expect(purchaseLabel(purchase({ productId: "one_time_3" }))).toBe(
      "3 wallpaper pack",
    );
    expect(purchaseLabel(purchase({ productId: "new_sku" }))).toBe("new_sku");
  });
  it("includes range boundaries and excludes undated purchases", () => {
    const from = new Date("2026-10-12T13:36:48Z");
    expect(
      purchasesInRange(
        [purchase(), purchase({ firstSeenAt: null })],
        from,
        from,
      ),
    ).toHaveLength(1);
  });
});

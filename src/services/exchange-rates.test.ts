import { afterEach, describe, expect, it, vi } from "vitest";
import { amountInUsd, fetchExchangeRates, usdRevenue } from "./exchange-rates";
import { mapPurchase } from "./purchases";

const fx = { rates: { USD: 1, PLN: 4, EUR: 0.8 }, dates: { PLN: "2026-10-12", EUR: "2026-10-12" } };
const purchase = (amount: number | null, currency: string, extra = {}) => mapPurchase("p", {
  amount, currency, purchaseState: "purchased", ...extra,
});
afterEach(() => vi.unstubAllGlobals());

describe("USD revenue", () => {
  it("divides foreign amounts by units per USD and combines currencies before rounding", () => {
    expect(amountInUsd(13.99, "PLN", fx)).toBeCloseTo(3.4975);
    expect(usdRevenue([purchase(13.99, "PLN"), purchase(8, "EUR"), purchase(2, "USD")], fx).value).toBe("$15.50");
  });
  it("never reports a partial total when an amount or currency rate is unavailable", () => {
    expect(usdRevenue([purchase(1, "USD"), purchase(3, "XYZ")], fx).value).toBe("Unavailable");
    expect(usdRevenue([purchase(null, "USD")], fx).value).toBe("Unavailable");
    expect(usdRevenue([purchase(3, "PLN")]).value).toBe("Unavailable");
    expect(amountInUsd(3, "PLN", { rates: { PLN: 0 }, dates: {} })).toBeNull();
  });
  it("excludes test and refunded orders and supports USD or empty periods without FX", () => {
    expect(usdRevenue([purchase(99, "PLN", { testPurchase: true }), purchase(50, "PLN", { purchaseState: "voided" }), purchase(2, "USD")]).value).toBe("$2.00");
    expect(usdRevenue([]).value).toBe("$0.00");
    expect(usdRevenue([purchase(1, "PLN")], fx).hint).toContain("2026-10-12");
  });
  it("loads and validates public rates without sending purchase data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { base: "USD", quote: "PLN", rate: 4, date: "2026-10-12" },
      { base: "USD", quote: "BAD", rate: -1, date: "2026-10-12" },
    ] });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchExchangeRates()).rates).toEqual({ USD: 1, PLN: 4 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.frankfurter.dev/v2/rates?base=USD");
    fetchMock.mockResolvedValue({ ok: false });
    await expect(fetchExchangeRates()).rejects.toThrow("could not be loaded");
  });
});

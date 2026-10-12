import { formatCurrency } from "@/lib/format";
import { summarizePurchases, type Purchase } from "@/services/purchases";

export interface ExchangeRates {
  // Units of each currency per one USD.
  rates: Record<string, number>;
  dates: Record<string, string>;
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch("https://api.frankfurter.dev/v2/rates?base=USD", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("USD exchange rates could not be loaded.");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid exchange rate response.");
  const result: ExchangeRates = { rates: { USD: 1 }, dates: {} };
  for (const row of rows) {
    if (
      row?.base === "USD" && /^[A-Z]{3}$/.test(row.quote) &&
      typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate > 0 &&
      typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    ) {
      result.rates[row.quote] = row.rate;
      result.dates[row.quote] = row.date;
    }
  }
  if (Object.keys(result.rates).length === 1) throw new Error("No USD exchange rates available.");
  return result;
}

export function amountInUsd(amount: number | null, currency: string | null, fx?: ExchangeRates): number | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || !currency) return null;
  const rate = currency === "USD" ? 1 : fx?.rates[currency];
  return rate && Number.isFinite(rate) && rate > 0 ? amount / rate : null;
}

export function usdRevenue(purchases: Purchase[], fx?: ExchangeRates) {
  const { granted } = summarizePurchases(purchases);
  const values = granted.map((p) => amountInUsd(p.amount, p.currency, fx));
  const missing = values.filter((value) => value === null).length;
  const dates = [...new Set(granted.flatMap((p) =>
    p.currency && p.currency !== "USD" && fx?.dates[p.currency] ? [fx.dates[p.currency]] : [],
  ))].sort();
  return {
    value: missing ? "Unavailable" : formatCurrency(values.reduce<number>((sum, value) => sum + (value ?? 0), 0), "USD"),
    hint: missing ? "Payment amount or USD exchange rate unavailable" :
      dates.length ? `Approx. gross USD · FX ${dates.join(" / ")} · Frankfurter` : "Gross USD · before store fees and taxes",
  };
}

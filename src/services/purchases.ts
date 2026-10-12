import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { toDate, formatCurrency } from "@/lib/format";
import { fetchUsers, isLiveData } from "@/services/data-service";
import { reportingRecords } from "@/lib/reporting";

export interface Purchase {
  id: string;
  uid: string;
  productId: string;
  type: string;
  state: string;
  purchasedAt: Date | null;
  expiryTime: Date | null;
  credits: number;
  amount: number | null;
  currency: string | null;
  orderId: string | null;
  testPurchase: boolean;
  autoRenewing: boolean | null;
  latestOrder: boolean;
}

// firstSeenAt is immutable. completedAt and lastVerifiedAt can change on
// renewal/re-verification and must not turn an old purchase into today's sale.
export function mapPurchase(
  id: string,
  data: Record<string, unknown>,
): Purchase {
  const effect = data.entitlementEffect as { credits?: unknown } | undefined;
  const amount =
    typeof data.amount === "number" &&
    Number.isFinite(data.amount) &&
    data.amount >= 0
      ? data.amount
      : null;
  const currency =
    typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency)
      ? data.currency
      : null;
  return {
    id,
    uid: typeof data.uid === "string" ? data.uid : "",
    productId: typeof data.productId === "string" ? data.productId : "unknown",
    type: typeof data.productType === "string" ? data.productType : "unknown",
    state:
      typeof data.purchaseState === "string" ? data.purchaseState : "unknown",
    purchasedAt: toDate(
      (data.firstSeenAt ?? data.processedAt) as Parameters<typeof toDate>[0],
    ),
    expiryTime: toDate(data.expiryTime as Parameters<typeof toDate>[0]),
    credits: typeof effect?.credits === "number" ? effect.credits : 0,
    amount,
    currency,
    orderId: typeof data.orderId === "string" ? data.orderId : null,
    testPurchase: data.testPurchase === true,
    autoRenewing:
      typeof data.autoRenewing === "boolean" ? data.autoRenewing : null,
    latestOrder: data.latestOrder !== false,
  };
}

// A subscription token can contain several charged orders. Use each order's
// transaction date and status instead of the token's latest entitlement status.
export function mapPurchaseRecords(
  id: string,
  data: Record<string, unknown>,
): Purchase[] {
  const orders =
    data.orders && typeof data.orders === "object"
      ? Object.entries(data.orders as Record<string, unknown>)
      : [];
  const records = orders.flatMap(([orderId, value]) => {
    if (!value || typeof value !== "object") return [];
    const order = value as Record<string, unknown>;
    if (
      order.orderId !== orderId ||
      !/^GPA\.\d{4}-\d{4}-\d{4}-\d{5}(?:\.\.\d+)?$/.test(orderId)
    )
      return [];
    const states: Record<string, string> = {
      PROCESSED: "purchased",
      REFUNDED: "voided",
      CANCELED: "cancelled",
      PENDING: "pending",
      PARTIALLY_REFUNDED: "partially_refunded",
    };
    return [
      mapPurchase(`${id}:${orderId}`, {
        ...data,
        ...order,
        orderId,
        latestOrder: data.orderId === orderId,
        firstSeenAt: order.purchasedAt,
        processedAt: null,
        purchaseState: states[String(order.state)] ?? "unknown",
      }),
    ];
  });
  if (!records.length) return [mapPurchase(id, data)];
  // Preserve an unmatched original purchase as an explicitly unpriced record.
  if (
    typeof data.originalOrderId === "string" &&
    !records.some((p) => p.orderId === data.originalOrderId)
  ) {
    records.push(
      mapPurchase(id, {
        ...data,
        orderId: data.originalOrderId,
        amount: null,
        currency: null,
      }),
    );
  }
  return records;
}

export async function fetchPurchases(): Promise<Purchase[]> {
  return reportingRecords(await fetchAllPurchases(), (p) => p.purchasedAt);
}

// Full history is only exposed by the explicit earlier-test-history control
// inside one user's billing details. Global reporting always uses fetchPurchases.
export async function fetchAllPurchases(): Promise<Purchase[]> {
  if (!isLiveData) {
    const users = await fetchUsers();
    return [
      "one_time_1",
      "live_weather_monthly",
      "one_time_3",
      "live_weather_plus_monthly",
    ].map((productId, index) =>
      mapPurchase(`demo_purchase_${index}`, {
        uid: users[index % users.length]?.uid ?? "demo_user",
        productId,
        productType: productId.startsWith("one_time")
          ? "consumable"
          : "subscription",
        purchaseState: "purchased",
        firstSeenAt: new Date(Date.now() - index * 3_600_000),
        entitlementEffect: {
          credits:
            productId === "one_time_1" ? 1 : productId === "one_time_3" ? 3 : 0,
        },
      }),
    );
  }
  const db = getDb();
  if (!db)
    throw new Error(
      "Purchase data is unavailable. Check Firebase configuration.",
    );
  const result: Purchase[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  // Page by document ID so legacy records without timestamps are included too.
  for (;;) {
    const page = await getDocs(
      query(
        collection(db, "billingPurchases"),
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(500),
      ),
    );
    result.push(
      ...page.docs.flatMap((doc) => mapPurchaseRecords(doc.id, doc.data())),
    );
    if (page.size < 500) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return result.sort(
    (a, b) => (b.purchasedAt?.getTime() ?? 0) - (a.purchasedAt?.getTime() ?? 0),
  );
}

export function purchaseLabel(purchase: Pick<Purchase, "productId">): string {
  const labels: Record<string, string> = {
    live_weather_monthly: "LiveWeather · Monthly",
    live_weather_plus_monthly: "LiveWeather Plus · Monthly",
    one_time_1: "Single wallpaper",
    one_time_3: "3 wallpaper pack",
  };
  return labels[purchase.productId] ?? purchase.productId;
}

// Expiry/replacement describes the current entitlement, not a failed original sale.
export function isGrantedPurchase(purchase: Purchase): boolean {
  return ["purchased", "expired", "replaced"].includes(purchase.state);
}

export function purchasesInRange(
  purchases: Purchase[],
  from: Date | null,
  to: Date | null,
): Purchase[] {
  return purchases.filter(
    (p) =>
      p.purchasedAt &&
      (!from || p.purchasedAt >= from) &&
      (!to || p.purchasedAt <= to),
  );
}

export function summarizePurchases(purchases: Purchase[]) {
  const granted = purchases.filter(
    (p) => isGrantedPurchase(p) && !p.testPurchase,
  );
  const subscriptions = granted.filter((p) => p.type === "subscription");
  const oneTime = granted.filter(
    (p) => p.type === "consumable" || p.type === "non_consumable",
  );
  const totals = new Map<string, number>();
  for (const p of granted) {
    if (p.amount !== null && p.currency)
      totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount);
  }
  const missingAmounts = granted.filter(
    (p) => p.amount === null || !p.currency,
  ).length;
  return {
    granted,
    subscriptions,
    oneTime,
    buyers: new Set(granted.map((p) => p.uid).filter(Boolean)).size,
    subscriptionBuyers: new Set(subscriptions.map((p) => p.uid).filter(Boolean))
      .size,
    missingAmounts,
    revenue: missingAmounts
      ? "Unavailable"
      : totals.size
        ? [...totals]
            .map(([currency, amount]) => formatCurrency(amount, currency))
            .join(" · ")
        : "No sales",
  };
}

import { doc, getDoc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useDemoData } from "@/lib/config";
import { validateModelPrice, type ModelPrice, type ModelPrices } from "@/lib/model-pricing";
import type { Actor } from "@/services/data-service";

let demoPrices: ModelPrices = {};

export async function fetchModelPrices(): Promise<ModelPrices> {
  if (useDemoData) return structuredClone(demoPrices);
  const db = getDb();
  if (!db) throw new Error("Firebase is unavailable.");
  const snapshot = await getDoc(doc(db, "admin_config", "model_pricing"));
  const raw = snapshot.data()?.models ?? {};
  const prices: ModelPrices = {};
  for (const [id, value] of Object.entries(raw)) {
    const price = value as ModelPrice;
    validateModelPrice(price);
    prices[id] = price;
  }
  return prices;
}

export async function saveModelPrice(id: string, price: ModelPrice, actor: Actor): Promise<ModelPrice> {
  validateModelPrice(price);
  function versioned(previous?: ModelPrice): ModelPrice {
    const { history: oldHistory, ...oldPrice } = previous ?? price;
    return { type: price.type, mode: price.mode, amountUsd: price.amountUsd,
      fixedDurationSeconds: price.fixedDurationSeconds, effectiveFrom: Date.now(),
      history: previous ? [...(oldHistory ?? []), oldPrice] : [] };
  }
  if (useDemoData) {
    const next = versioned(demoPrices[id]);
    demoPrices = { ...demoPrices, [id]: next };
    return structuredClone(next);
  }
  const db = getDb();
  if (!db) throw new Error("Firebase is unavailable.");
  const ref = doc(db, "admin_config", "model_pricing");
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const models = snapshot.data()?.models ?? {};
    const next = versioned(models[id]);
    transaction.set(ref, { models: { ...models, [id]: next },
      updatedAt: serverTimestamp(), updatedBy: actor.uid }, { merge: true });
    transaction.set(doc(collection(db, "admin_audit_logs")), {
      adminUid: actor.uid, adminEmail: actor.email, action: "MODEL_PRICING_UPDATED",
      target: id, before: models[id] ?? null, after: next, createdAt: serverTimestamp(),
    });
    return next;
  });
}

import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useDemoData } from "@/lib/config";
import { validateGenerationCost, type GenerationCosts } from "@/lib/generation-costs";
import type { Actor } from "@/services/data-service";
import { recordDemoAudit } from "@/services/demo-store";

const demoCosts: GenerationCosts = {};

export async function fetchGenerationCosts(): Promise<GenerationCosts> {
  if (useDemoData) return { ...demoCosts };
  const db = getDb();
  if (!db) throw new Error("Firebase is unavailable.");
  const snapshots = await getDocs(query(collection(db, "admin_config"), where("kind", "==", "generation_cost")));
  const costs: GenerationCosts = {};
  for (const snapshot of snapshots.docs) {
    const { generationId, amountUsd } = snapshot.data();
    validateGenerationCost(amountUsd);
    if (typeof generationId === "string") costs[generationId] = amountUsd;
  }
  return costs;
}

export async function saveGenerationCost(id: string, cost: number, actor: Actor): Promise<void> {
  validateGenerationCost(cost);
  if (!id || id.includes("/")) throw new Error("Invalid generation ID.");
  if (useDemoData) {
    const before = demoCosts[id] ?? null;
    demoCosts[id] = cost;
    recordDemoAudit({ adminUid: actor.uid, adminEmail: actor.email,
      action: "GENERATION_COST_UPDATED", target: id, before, after: cost });
    return;
  }
  const db = getDb();
  if (!db) throw new Error("Firebase is unavailable.");
  const ref = doc(db, "admin_config", `generation_cost_${id}`);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    transaction.set(ref, { kind: "generation_cost", generationId: id, amountUsd: cost,
      updatedBy: actor.uid, updatedAt: serverTimestamp() });
    transaction.set(doc(collection(db, "admin_audit_logs")), {
      adminUid: actor.uid, adminEmail: actor.email, action: "GENERATION_COST_UPDATED",
      target: id, before: snapshot.data()?.amountUsd ?? null, after: cost,
      createdAt: serverTimestamp(),
    });
  });
}

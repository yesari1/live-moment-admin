import type { AdminUser, TestDeviceLabel } from "@/types";

/** How a user is labelled on `users/{uid}.testDevice`, or `"real"`. */
export type TestAccountKind = "device" | "suspected" | "manual" | "real";

/** Toolbar filter over the Users table. */
export type TestAccountFilter = "real" | "all" | "test";

/**
 * The fields the helpers need. They are optional so callers that only carry
 * the label (for example the analytics user series) can still be checked.
 */
export interface TestAccountInput {
  testDevice?: TestDeviceLabel | null;
  plan?: AdminUser["plan"] | null;
  billingVerified?: boolean;
  email?: string | null;
  createdAt?: Date | null;
  hasPurchase?: boolean;
  testAccountOverride?: boolean;
  testLabelCleared?: boolean;
}

/** Manual decisions take priority; missing labels use a conservative Google robot guess. */
export function testAccountKind(user: TestAccountInput): TestAccountKind {
  if (user.testAccountOverride === true) return "manual";
  if (user.testAccountOverride === false) return "real";
  const label = user.testDevice;
  if (label?.kind === "device") return "device";
  if (label?.kind === "suspected") return "suspected";
  if (!user.testLabelCleared && (!user.plan || user.plan === "free") &&
    !user.billingVerified && !user.hasPurchase &&
    (user.createdAt?.getTime() ?? 0) >= Date.UTC(2026, 8, 19) &&
    /^[a-z]{2,}(?:[._-][a-z]+)*\.(?:\d{5}|\d{2,3}-\d{3})@gmail\.com$/i.test(user.email?.trim() ?? "")) {
    return "suspected";
  }
  return "real";
}

/**
 * Whether a user counts as a test account for filters and the user stats.
 *
 * Unless explicitly marked by an admin, an account on a paid plan or with verified billing counts as a real
 * user: robots cannot pay, so it is a mislabel. Its badge still shows and the
 * label can still be cleared.
 */
export function isTestAccount(user: TestAccountInput): boolean {
  if (user.testAccountOverride !== undefined) return user.testAccountOverride;
  if (testAccountKind(user) === "real") return false;
  if (user.plan && user.plan !== "free") return false;
  if (user.billingVerified === true) return false;
  return true;
}

/** Apply the toolbar "real / all / test" filter to a user list. */
export function filterByTestAccount<T extends TestAccountInput>(
  users: T[],
  filter: TestAccountFilter,
): T[] {
  if (filter === "all") return users;
  if (filter === "test") return users.filter(isTestAccount);
  return users.filter((user) => !isTestAccount(user));
}

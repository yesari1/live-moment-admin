import type { AdminUser, TestDeviceLabel } from "@/types";

/** How a user is labelled on `users/{uid}.testDevice`, or `"real"`. */
export type TestAccountKind = "device" | "suspected" | "real";

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
}

/**
 * The label stored on the account. `device` wins over `suspected`, including
 * over an admin-cleared `suspected: false`: the device flag is a fact reported
 * by the app and the console never clears it.
 *
 * This is the raw label, so badges keep showing a mislabelled paid account and
 * the clear action stays offered for it. Use {@link isTestAccount} to decide
 * whether it counts as a test account for filters and user stats.
 */
export function testAccountKind(user: TestAccountInput): TestAccountKind {
  const label = user.testDevice;
  if (label?.kind === "device") return "device";
  if (label?.kind === "suspected") return "suspected";
  return "real";
}

/**
 * Whether a user counts as a test account for filters and the user stats.
 *
 * A labelled account on a paid plan or with verified billing counts as a real
 * user: robots cannot pay, so it is a mislabel. Its badge still shows and the
 * label can still be cleared.
 */
export function isTestAccount(user: TestAccountInput): boolean {
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

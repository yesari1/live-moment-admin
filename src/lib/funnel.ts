import type { AnalyticsFunnelStep } from "@/services/backend";

export const FUNNEL_LABELS: Record<string, string> = {
  installs: "Installs",
  onboarding_seen: "Onboarding seen",
  photo_selected: "Photo selected",
  login_seen: "Login screen seen",
  sign_in_started: "Sign-in started",
  sign_in_completed: "Signed in",
  preview_started: "Free preview started",
  preview_ready: "Free preview ready",
  paywall_viewed: "Paywall viewed",
  purchase_started: "Play checkout opened",
  purchase: "Purchased",
};

export interface FunnelRow {
  key: string;
  label: string;
  devices: number;
  /** Share of the previous step, or null for the first step / empty previous. */
  ofPrevious: number | null;
  /** Share of installs, or null when there are no installs. */
  ofInstalls: number | null;
}

/** Adds "% of previous step" and "% of installs" to the ordered steps. */
export function buildFunnelRows(steps: AnalyticsFunnelStep[]): FunnelRow[] {
  const installs = steps[0]?.devices ?? 0;
  return steps.map((step, index) => {
    const previous = index > 0 ? steps[index - 1].devices : 0;
    return {
      key: step.key,
      label: FUNNEL_LABELS[step.key] ?? step.key,
      devices: step.devices,
      ofPrevious: index > 0 && previous > 0 ? step.devices / previous : null,
      ofInstalls: installs > 0 ? step.devices / installs : null,
    };
  });
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

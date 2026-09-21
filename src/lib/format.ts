import { format, formatDistanceToNowStrict, isValid } from "date-fns";

type DateInput =
  | Date
  | string
  | number
  | null
  | undefined
  | { seconds?: number; nanoseconds?: number; toDate?: () => Date }
  | { toMillis?: () => number };

/** Normalise Firestore Timestamps, epoch millis, ISO strings and Dates. */
export function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === "number") {
    const d = new Date(input < 1e12 ? input * 1000 : input);
    return isValid(d) ? d : null;
  }
  if (typeof input === "string") {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }
  if (typeof input === "object") {
    if (typeof (input as { toDate?: () => Date }).toDate === "function") {
      try {
        const d = (input as { toDate: () => Date }).toDate();
        return isValid(d) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof (input as { toMillis?: () => number }).toMillis === "function") {
      const ms = (input as { toMillis: () => number }).toMillis();
      const d = new Date(ms);
      return isValid(d) ? d : null;
    }
    const seconds = (input as { seconds?: number }).seconds;
    if (typeof seconds === "number") {
      const d = new Date(seconds * 1000);
      return isValid(d) ? d : null;
    }
  }
  return null;
}

export function formatDate(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, "MMM d, yyyy") : "—";
}

export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, "MMM d, yyyy · HH:mm") : "—";
}

export function formatTime(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, "HH:mm:ss") : "—";
}

export function formatRelative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  maximumFractionDigits = 2,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
  }).format(value);
}

export function formatCost(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return formatCurrency(value, "USD", 6);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    const text = Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1);
    return `${text} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  return `${seconds.toFixed(seconds % 1 === 0 ? 0 : 1)} s`;
}

export function truncateMiddle(value: string, max = 22): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

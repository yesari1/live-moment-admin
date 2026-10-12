import { toDate } from "@/lib/format";

// A fixed launch boundary, independent of the administrator's browser timezone.
export const REPORTING_START_ISO = "2026-10-12T00:00:00+03:00";
export const REPORTING_START_MS = Date.parse(REPORTING_START_ISO);
export const REPORTING_START_DATE = "2026-10-12";
export const REPORTING_LABEL = "12 Oct 2026 · 00:00 Europe/Istanbul";
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;

export function reportingDateKey(value: Date): string {
  return new Date(value.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function reportingDayStart(value = new Date()): Date {
  return new Date(`${reportingDateKey(value)}T00:00:00+03:00`);
}

export function isInReportingPeriod(
  value: Parameters<typeof toDate>[0],
): boolean {
  const date = toDate(value);
  return date !== null && date.getTime() >= REPORTING_START_MS;
}

export function reportingRecords<T>(
  records: T[],
  date: (record: T) => Parameters<typeof toDate>[0],
): T[] {
  return records.filter((record) => isInReportingPeriod(date(record)));
}

export function clampReportingStart(value?: Date | null): Date {
  return new Date(
    Math.max(value?.getTime() ?? REPORTING_START_MS, REPORTING_START_MS),
  );
}

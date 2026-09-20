import type {
  AppSettings,
  AuditLog,
  ErrorLog,
  GenerationRecord,
  PlanConfig,
  RoutingConfig,
  TemplateRecord,
} from "@/types";
import {
  demoAppSettings,
  demoAuditLogs,
  demoErrorLogs,
  demoGenerations,
  demoPlans,
  demoRoutingConfigs,
  demoTemplates,
  demoUsageEvents,
  demoUsers,
} from "@/services/demo-data";

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

export interface DemoState {
  users: ReturnType<typeof clone<(typeof demoUsers)[number]>>[];
  generations: GenerationRecord[];
  usageEvents: typeof demoUsageEvents;
  templates: TemplateRecord[];
  routing: RoutingConfig[];
  plans: PlanConfig[];
  settings: AppSettings;
  errorLogs: ErrorLog[];
  auditLogs: AuditLog[];
}

export const demoState = {
  users: clone(demoUsers),
  generations: clone(demoGenerations),
  usageEvents: clone(demoUsageEvents),
  templates: clone(demoTemplates),
  routing: clone(demoRoutingConfigs),
  plans: clone(demoPlans),
  settings: clone(demoAppSettings),
  errorLogs: clone(demoErrorLogs),
  auditLogs: clone(demoAuditLogs),
};

export function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function recordDemoAudit(entry: {
  adminUid: string;
  adminEmail: string | null;
  action: AuditLog["action"];
  target: string;
  before?: unknown;
  after?: unknown;
}) {
  demoState.auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminUid: entry.adminUid,
    adminEmail: entry.adminEmail,
    action: entry.action,
    target: entry.target,
    before: entry.before ?? null,
    after: entry.after ?? null,
    createdAt: new Date(),
  });
}

export function pushDemoLog(log: Omit<ErrorLog, "id"> & { id?: string }) {
  demoState.errorLogs.unshift({ ...log, id: log.id ?? `log_${Date.now()}` });
}

export type AccountPlan = "free" | "live_weather" | "live_weather_plus";

export type PlanId = "free" | "single" | "live_weather" | "live_weather_plus";

export type GenerationType = "image" | "video";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/** Raw statuses stored by the Live Moment backend. */
export type RawJobStatus =
  | "draft"
  | "uploading"
  | "queued"
  | "generating"
  | "processing"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type RoutingContext =
  | "onboarding"
  | "free"
  | "single"
  | "live_weather"
  | "live_weather_plus";

export type AccountStatus =
  | "active"
  | "disabled"
  | "deletion_pending"
  | "review";

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  plan: AccountPlan;
  status: AccountStatus;
  credits: number;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  lastGenerationAt: Date | null;
  imageGenerationCount: number;
  videoGenerationCount: number;
  failedGenerationCount: number;
  estimatedTotalCost: number;
  freePreviewUsed: boolean;
  billingVerified: boolean;
  providers: string[];
}

export interface GenerationRecord {
  id: string;
  uid: string;
  userEmail: string | null;
  type: GenerationType;
  routingContext: RoutingContext | null;
  status: GenerationStatus;
  rawStatus: RawJobStatus;
  provider: string | null;
  actualProvider: string | null;
  model: string | null;
  imageModelId: string | null;
  videoModelId: string | null;
  primaryProvider: string | null;
  primaryModel: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  fallbackUsed: boolean;
  providerRequestId: string | null;
  retryCount: number;
  presetId: string | null;
  personType: string | null;
  createdAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  estimatedCost: number | null;
  currency: string;
  errorCode: string | null;
  errorMessage: string | null;
  timeout: boolean;
}

export interface UsageEvent {
  id: string;
  userId: string;
  jobId: string;
  templateId: string | null;
  stage: GenerationType;
  provider: string;
  model: string;
  status: "success" | "failure";
  estimatedCostUsd: number | null;
  estimatedCostTry: number | null;
  durationSeconds: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
}

export interface TemplateRecord {
  id: string;
  title: string;
  description: string;
  iconKey: string;
  category: string;
  type: GenerationType;
  enabled: boolean;
  sortOrder: number;
  activeVersion: number;
  defaultLoopFix: boolean;
  supportedPlans: PlanId[];
  previewUrl: string | null;
  updatedAt: Date | null;
}

export interface TemplatePromptVersion {
  version: number;
  keyframePrompt: Record<string, unknown> | null;
  videoPrompt: Record<string, unknown> | null;
  createdAt: Date | null;
}

export interface PlanConfig {
  id: PlanId;
  displayName: string;
  enabled: boolean;
  imageGenerations: number;
  videoGenerations: number;
  maxImageQuality: "standard" | "high";
  maxVideoResolution: "720p" | "1080p";
  maxVideoDurationSeconds: number;
  creditAmount: number;
  generationPriority: "low" | "normal" | "high";
  storeProductId: string | null;
  internalSku: string | null;
  priceLabel: string | null;
  features: string[];
}

export interface RoutingRetryConfig {
  enabled: boolean;
  count: number;
}

export interface RoutingEndpoint {
  provider: string;
  model: string;
}

export interface RoutingConfig {
  id: string;
  type: GenerationType;
  context: RoutingContext;
  enabled: boolean;
  primary: RoutingEndpoint;
  fallback: RoutingEndpoint & { enabled: boolean };
  retry: RoutingRetryConfig;
  timeoutSeconds: number;
  quality?: string;
  resolution?: string;
  durationSeconds?: number;
  parameters?: Record<string, unknown>;
  version: number;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface AppSettings {
  imageGenerationEnabled: boolean;
  videoGenerationEnabled: boolean;
  newRegistrationsEnabled: boolean;
  maintenanceMode: boolean;
  onboardingGenerationEnabled: boolean;
  freeGenerationLimit: number;
  defaultTimeoutSeconds: number;
  maxConcurrentGenerations: number;
  minimumAppVersion: string;
  supportMessage: string;
  maintenanceMessage: string;
  featureFlags: Record<string, boolean>;
  version: number;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export type LogSeverity = "info" | "warning" | "error" | "critical";

export type LogCategory =
  | "image_provider"
  | "video_provider"
  | "backend"
  | "authentication"
  | "firestore"
  | "storage"
  | "timeout"
  | "fallback"
  | "config_change";

export interface ErrorLog {
  id: string;
  timestamp: Date | null;
  severity: LogSeverity;
  category: LogCategory;
  userId: string | null;
  generationId: string | null;
  provider: string | null;
  model: string | null;
  errorCode: string | null;
  message: string;
}

export interface AuditLog {
  id: string;
  adminUid: string;
  adminEmail: string | null;
  action: AuditAction;
  target: string;
  before: unknown;
  after: unknown;
  createdAt: Date | null;
}

export type AuditAction =
  | "AI_ROUTING_UPDATED"
  | "PLAN_UPDATED"
  | "TEMPLATE_CREATED"
  | "TEMPLATE_UPDATED"
  | "TEMPLATE_DELETED"
  | "APP_SETTINGS_UPDATED"
  | "KILL_SWITCH_TOGGLED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "USER_DELETED"
  | "USER_CREDITS_UPDATED"
  | "USER_PLAN_UPDATED"
  | "USER_MARKED_FOR_REVIEW";

export interface ModelInfo {
  id: string;
  displayName: string;
  type: GenerationType;
  provider: string;
  enabled: boolean;
  estimatedCost: number | null;
  supportsFallback: boolean;
  supportsReference?: boolean;
  recommended?: boolean;
  free?: boolean;
}

export interface ProviderInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  description: string;
  imageModels: ModelInfo[];
  videoModels: ModelInfo[];
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
  preset: "today" | "7d" | "30d" | "custom";
}

export interface DashboardMetrics {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  activeUsersToday: number;
  activeUsers7d: number;
  imageGenerationsToday: number;
  videoGenerationsToday: number;
  successfulGenerationsToday: number;
  failedGenerationsToday: number;
  imageSuccessRate: number;
  videoSuccessRate: number;
  estimatedCostToday: number;
  estimatedCostMonth: number;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  value: number;
  image?: number;
  video?: number;
  success?: number;
  failed?: number;
  cost?: number;
}

export interface BreakdownPoint {
  name: string;
  value: number;
  cost?: number;
}

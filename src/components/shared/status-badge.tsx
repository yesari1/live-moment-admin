import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AccountPlan,
  AccountStatus,
  GenerationStatus,
  GenerationType,
  LogSeverity,
} from "@/types";
import { PLAN_LABELS } from "@/data/plans";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

const generationStyles: Record<
  GenerationStatus,
  { variant: "success" | "info" | "muted" | "destructive" | "warning"; icon: React.ElementType; label: string }
> = {
  completed: { variant: "success", icon: CheckCircle2, label: "Completed" },
  processing: { variant: "info", icon: Loader2, label: "Processing" },
  queued: { variant: "muted", icon: Clock, label: "Queued" },
  failed: { variant: "destructive", icon: XCircle, label: "Failed" },
  cancelled: { variant: "warning", icon: Ban, label: "Cancelled" },
};

export function GenerationStatusBadge({
  status,
  className,
}: {
  status: GenerationStatus;
  className?: string;
}) {
  const style = generationStyles[status];
  const Icon = style.icon;
  return (
    <Badge variant={style.variant} className={cn("gap-1", className)}>
      <Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
      />
      {style.label}
    </Badge>
  );
}

const mediaTypeStyles: Record<
  GenerationType,
  { variant: "info" | "purple"; label: string }
> = {
  image: { variant: "info", label: "Image" },
  video: { variant: "purple", label: "Video" },
};

/**
 * Tag for a generation/template media type. Image and Video use clearly
 * different theme colours; any unknown future value falls back to a neutral
 * badge so the table never breaks.
 */
export function MediaTypeBadge({
  type,
  className,
}: {
  type: GenerationType | string | null | undefined;
  className?: string;
}) {
  if (type === "image" || type === "video") {
    const style = mediaTypeStyles[type];
    return (
      <Badge variant={style.variant} className={className}>
        {style.label}
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className={cn("capitalize", className)}>
      {type ? String(type) : "Unknown"}
    </Badge>
  );
}

const accountStatusStyles: Record<
  AccountStatus,
  { variant: "success" | "muted" | "warning" | "destructive"; label: string }
> = {
  active: { variant: "success", label: "Active" },
  disabled: { variant: "destructive", label: "Disabled" },
  deletion_pending: { variant: "warning", label: "Deletion pending" },
  review: { variant: "warning", label: "Support review" },
};

export function AccountStatusBadge({
  status,
  className,
}: {
  status: AccountStatus;
  className?: string;
}) {
  const style = accountStatusStyles[status];
  return (
    <Badge variant={style.variant} className={className}>
      {style.label}
    </Badge>
  );
}

export function PlanBadge({
  plan,
  className,
}: {
  plan: AccountPlan;
  className?: string;
}) {
  const variant = plan === "live_weather_plus" ? "default" : "secondary";
  return (
    <Badge variant={variant} className={className}>
      {PLAN_LABELS[plan] ?? plan}
    </Badge>
  );
}

const severityStyles: Record<
  LogSeverity,
  { variant: "muted" | "warning" | "destructive" | "info"; label: string }
> = {
  info: { variant: "info", label: "Info" },
  warning: { variant: "warning", label: "Warning" },
  error: { variant: "destructive", label: "Error" },
  critical: { variant: "destructive", label: "Critical" },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: LogSeverity;
  className?: string;
}) {
  const style = severityStyles[severity];
  return (
    <Badge variant={style.variant} className={cn("capitalize", className)}>
      {severity === "critical" && <AlertTriangle className="h-3 w-3" />}
      {style.label}
    </Badge>
  );
}

export function FallbackBadge({ used }: { used: boolean }) {
  if (!used) return <span className="text-muted-foreground">No</span>;
  return (
    <Badge variant="warning" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      Fallback used
    </Badge>
  );
}

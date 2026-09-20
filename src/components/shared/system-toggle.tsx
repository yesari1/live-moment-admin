import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SystemToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}

/**
 * Prominent global control. `danger` switches use warning styling and is
 * intended for controls that affect every user (kill switches).
 */
export function SystemToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  danger,
  className,
}: SystemToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors",
        danger && "border-warning/40 bg-warning/5",
        className,
      )}
    >
      <div className="space-y-0.5">
        <Label className="flex items-center gap-1.5 text-sm">
          {danger && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

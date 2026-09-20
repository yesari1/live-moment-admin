import { cn } from "@/lib/utils";
import { formatCost } from "@/lib/format";

export function CostDisplay({
  value,
  currency = "USD",
  className,
  muted,
}: {
  value: number | null | undefined;
  currency?: "USD" | "TRY";
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        muted ? "text-muted-foreground" : "font-medium",
        className,
      )}
    >
      {value == null
        ? "—"
        : currency === "TRY"
          ? `₺${value.toFixed(2)}`
          : formatCost(value)}
    </span>
  );
}

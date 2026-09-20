import * as React from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/types";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: Array<{ value: DateRange["preset"]; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom" },
];

export function DateRangeFilter({
  value,
  onChange,
  className,
}: DateRangeFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(
    value.from ? value.from.toISOString().slice(0, 10) : "",
  );
  const [to, setTo] = React.useState(
    value.to ? value.to.toISOString().slice(0, 10) : "",
  );

  const applyCustom = () => {
    onChange({
      preset: "custom",
      from: from ? new Date(`${from}T00:00:00`) : null,
      to: to ? new Date(`${to}T23:59:59`) : null,
    });
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tabs
        value={value.preset}
        onValueChange={(next) =>
          onChange({ ...value, preset: next as DateRange["preset"] })
        }
      >
        <TabsList className="h-9">
          {PRESETS.filter((p) => p.value !== "custom").map((preset) => (
            <TabsTrigger key={preset.value} value={preset.value}>
              {preset.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value.preset === "custom" ? "secondary" : "outline"}
            size="sm"
            className="h-9"
          >
            <CalendarRange className="h-4 w-4" />
            {value.preset === "custom" && value.from && value.to
              ? `${value.from.toLocaleDateString()} – ${value.to.toLocaleDateString()}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="range-from" className="text-xs">
              From
            </Label>
            <Input
              id="range-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to" className="text-xs">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button size="sm" className="w-full" onClick={applyCustom}>
            Apply range
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Resolve a DateRange preset into concrete from/to dates. */
export function resolveDateRange(range: DateRange): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  if (range.preset === "today") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (range.preset === "7d" || range.preset === "30d") {
    const days = range.preset === "7d" ? 7 : 30;
    const from = new Date(now.getTime() - days * 86_400_000);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  return { from: range.from, to: range.to };
}

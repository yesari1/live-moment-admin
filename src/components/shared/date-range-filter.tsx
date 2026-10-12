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
import {
  clampReportingStart,
  reportingDateKey,
  reportingDayStart,
  REPORTING_START_DATE,
} from "@/lib/reporting";

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
    value.from
      ? reportingDateKey(clampReportingStart(value.from))
      : REPORTING_START_DATE,
  );
  const [to, setTo] = React.useState(
    value.to ? reportingDateKey(value.to) : reportingDateKey(new Date()),
  );

  const applyCustom = () => {
    onChange({
      preset: "custom",
      from: from
        ? clampReportingStart(new Date(`${from}T00:00:00+03:00`))
        : null,
      to: to ? new Date(`${to}T23:59:59.999+03:00`) : null,
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
              min={REPORTING_START_DATE}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onInput={(e) => setFrom(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to" className="text-xs">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              min={from || REPORTING_START_DATE}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onInput={(e) => setTo(e.currentTarget.value)}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={applyCustom}
            disabled={!from || !to || from > to || from < REPORTING_START_DATE}
          >
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
    return { from: clampReportingStart(reportingDayStart(now)), to: now };
  }
  if (range.preset === "7d" || range.preset === "30d") {
    const days = range.preset === "7d" ? 7 : 30;
    const from = new Date(
      reportingDayStart(now).getTime() - (days - 1) * 86_400_000,
    );
    return { from: clampReportingStart(from), to: now };
  }
  return { from: clampReportingStart(range.from), to: range.to ?? now };
}

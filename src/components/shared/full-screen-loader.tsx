import { Loader2, Waves } from "lucide-react";

export function FullScreenLoader({ label = "Loading admin console…" }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Waves className="h-6 w-6" />
      </span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

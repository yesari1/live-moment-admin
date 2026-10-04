import { Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/shared/brand-logo";

export function FullScreenLoader({ label = "Loading admin console…" }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <BrandLogo className="h-24 w-24 rounded-3xl shadow-lg shadow-[#edc779]/10" />
      <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

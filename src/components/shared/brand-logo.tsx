import { cn } from "@/lib/utils";

export function BrandLogo({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0d14] ring-1 ring-[#edc779]/20", className)}>
      <img src="/live-moment-logo.png" alt={decorative ? "" : "Live Moment"}
        aria-hidden={decorative || undefined} width={1254} height={1254}
        className="h-full w-full scale-125 object-contain" draggable={false} />
    </span>
  );
}

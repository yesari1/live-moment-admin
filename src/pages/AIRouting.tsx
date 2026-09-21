import * as React from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelSkeleton } from "@/components/shared/loading-skeletons";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { RoutingTierCard } from "@/components/shared/routing-card";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRouting, saveRouting } from "@/services/data-service";
import { ROUTING_TIERS, type RoutingTierId } from "@/data/routing";
import {
  getModelDisplayName,
  getProviderDisplayName,
} from "@/data/providers";
import type { RoutingConfig } from "@/types";

export function AIRoutingPage() {
  const { user: actor } = useAuth();
  const [pending, setPending] = React.useState<RoutingConfig[] | null>(null);
  const [activeTier, setActiveTier] = React.useState<RoutingTierId>(
    ROUTING_TIERS[0].id,
  );
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const query = useAsyncData(() => fetchAllRouting(), []);
  const configs = query.data ?? [];
  const activeTierMeta =
    ROUTING_TIERS.find((tier) => tier.id === activeTier) ?? ROUTING_TIERS[0];
  const tierHasConfigs = React.useMemo(
    () =>
      activeTierMeta.imageContexts.some((context) =>
        configs.some((c) => c.type === "image" && c.context === context),
      ) ||
      activeTierMeta.videoContexts.some((context) =>
        configs.some((c) => c.type === "video" && c.context === context),
      ),
    [activeTierMeta, configs],
  );

  const handleSave = React.useCallback(
    (configs: RoutingConfig[]): Promise<boolean> =>
      new Promise((resolve) => {
        setPending(configs);
        resolveRef.current = resolve;
      }),
    [],
  );

  const finish = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPending(null);
  };

  const confirmSave = async () => {
    if (!pending || !actor) return finish(false);
    try {
      for (const config of pending) {
        await saveRouting(config, actor);
      }
      toast.success("Routing configuration updated.");
      await query.refresh();
      finish(true);
    } catch (error) {
      toast.error("Failed to update routing", {
        description: error instanceof Error ? error.message : undefined,
      });
      finish(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Routing"
        description="Choose which AI provider and model Live Moment uses for each tier. Changes take effect on new requests immediately, with no mobile app update."
      />

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertTitle>How routing works</AlertTitle>
        <AlertDescription>
          Pick a plan tab, then open its Image or Video tab to set the primary
          model, an optional fallback, retries and a timeout. Saving
          writes the configuration to Firebase; the backend reads it for every
          new request, picks the model, falls back or retries when needed, and
          records what was actually used. Already-running jobs are never
          changed.
        </AlertDescription>
      </Alert>

      {query.error ? (
        <ErrorState message={query.error} onRetry={query.refresh} />
      ) : query.loading ? (
        <PanelSkeleton rows={4} />
      ) : (
        <Tabs
          value={activeTier}
          onValueChange={(value) => setActiveTier(value as RoutingTierId)}
        >
          <TabsList className="flex-wrap">
            {ROUTING_TIERS.map((tier) => (
              <TabsTrigger key={tier.id} value={tier.id}>
                {tier.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTier} className="mt-4">
            {tierHasConfigs ? (
              <RoutingTierCard
                key={activeTierMeta.id}
                tier={activeTierMeta}
                configs={configs}
                onSave={handleSave}
              />
            ) : (
              <EmptyState
                title="No routing configured"
                description={`No ${activeTierMeta.label} routing document was found in Firebase. The defaults will be used until a configuration is saved.`}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && finish(false)}
        title="Apply this routing change?"
        confirmLabel="Apply change"
        onConfirm={confirmSave}
        description={
          pending && (
            <div className="space-y-2">
              <p>New generation requests will immediately begin using:</p>
              <ul className="space-y-1.5">
                {pending.map((config) => (
                  <li
                    key={config.id}
                    className="rounded-md border bg-muted/40 px-3 py-2"
                  >
                    <p className="text-xs font-medium capitalize text-foreground">
                      {config.type} · {config.context.replace(/_/g, " ")}
                    </p>
                    <p className="font-mono text-xs">
                      {getProviderDisplayName(config.primary.provider)} /{" "}
                      {getModelDisplayName(config.primary.model)}
                    </p>
                    {config.fallback.enabled && (
                      <p className="text-xs text-muted-foreground">
                        Fallback:{" "}
                        {getProviderDisplayName(config.fallback.provider)} /{" "}
                        {getModelDisplayName(config.fallback.model)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                No app update or store release is required.
              </p>
            </div>
          )
        }
      />
    </div>
  );
}

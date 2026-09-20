import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { PanelSkeleton } from "@/components/shared/loading-skeletons";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import { fetchPlans, savePlan } from "@/services/data-service";
import { PLAN_LABELS, PLAN_ORDER } from "@/data/plans";
import { IMAGE_QUALITIES, VIDEO_RESOLUTIONS } from "@/data/routing";
import type { PlanConfig, PlanId } from "@/types";

const schema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  enabled: z.boolean(),
  imageGenerations: z.coerce.number().int().min(0, "Cannot be negative."),
  videoGenerations: z.coerce.number().int().min(0, "Cannot be negative."),
  maxImageQuality: z.enum(["standard", "high"]),
  maxVideoResolution: z.enum(["720p", "1080p"]),
  maxVideoDurationSeconds: z.coerce.number().int().min(0, "Cannot be negative."),
  creditAmount: z.coerce.number().int().min(0, "Cannot be negative."),
  generationPriority: z.enum(["low", "normal", "high"]),
  storeProductId: z.string().optional(),
  internalSku: z.string().optional(),
  priceLabel: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toFormValues(plan: PlanConfig): FormValues {
  return {
    displayName: plan.displayName,
    enabled: plan.enabled,
    imageGenerations: plan.imageGenerations,
    videoGenerations: plan.videoGenerations,
    maxImageQuality: plan.maxImageQuality,
    maxVideoResolution: plan.maxVideoResolution,
    maxVideoDurationSeconds: plan.maxVideoDurationSeconds,
    creditAmount: plan.creditAmount,
    generationPriority: plan.generationPriority,
    storeProductId: plan.storeProductId ?? "",
    internalSku: plan.internalSku ?? "",
    priceLabel: plan.priceLabel ?? "",
  };
}

export function PlansPage() {
  const { user: actor } = useAuth();
  const query = useAsyncData(fetchPlans);
  const [active, setActive] = React.useState<PlanId>("free");
  const [pendingSave, setPendingSave] = React.useState<
    ((value: boolean) => void) | null
  >(null);

  const plans = query.data ?? [];
  const activePlan = plans.find((p) => p.id === active);

  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Plans"
          description="Plan behavior, quotas and entitlements."
        />
        <ErrorState message={query.error} onRetry={query.refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="What each plan allows: quotas, quality limits, credits and store metadata. AI model selection lives under AI Routing."
      />

      {query.loading ? (
        <PanelSkeleton rows={4} />
      ) : (
        <Tabs value={active} onValueChange={(value) => setActive(value as PlanId)}>
          <TabsList className="flex-wrap">
            {PLAN_ORDER.map((plan) => (
              <TabsTrigger key={plan} value={plan}>
                {PLAN_LABELS[plan]}
              </TabsTrigger>
            ))}
          </TabsList>
          {activePlan && (
            <TabsContent value={active} className="mt-4">
              <PlanForm
                key={activePlan.id}
                plan={activePlan}
                onSave={() =>
                  new Promise<boolean>((resolve) => setPendingSave(() => resolve))
                }
                actor={actor}
                onSaved={query.refresh}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      <ConfirmActionDialog
        open={pendingSave !== null}
        onOpenChange={(open) => {
          if (!open) {
            pendingSave?.(false);
            setPendingSave(null);
          }
        }}
        title="Apply plan changes?"
        confirmLabel="Apply changes"
        onConfirm={async () => {
          // Resolve is handled by the PlanForm through the returned promise.
          pendingSave?.(true);
          setPendingSave(null);
        }}
        description={
          <p>
            Plan limits and billing-related metadata affect what every user on
            this plan can generate. Changes are recorded in the audit trail.
          </p>
        }
      />
    </div>
  );
}

function PlanForm({
  plan,
  onSave,
  actor,
  onSaved,
}: {
  plan: PlanConfig;
  onSave: () => Promise<boolean>;
  actor: { uid: string; email: string | null } | null;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(plan),
  });

  React.useEffect(() => {
    form.reset(toFormValues(plan));
  }, [plan, form]);

  const dirty = form.formState.isDirty;

  const submit = form.handleSubmit(async (values) => {
    const confirmed = await onSave();
    if (!confirmed || !actor) return;
    setSaving(true);
    try {
      const next: PlanConfig = {
        ...plan,
        ...values,
        storeProductId: values.storeProductId?.trim() || null,
        internalSku: values.internalSku?.trim() || null,
        priceLabel: values.priceLabel?.trim() || null,
      };
      await savePlan(next, { uid: actor.uid, email: actor.email });
      toast.success(`${next.displayName} plan saved.`);
      await onSaved();
      form.reset(toFormValues(next));
    } catch (error) {
      toast.error("Failed to save plan", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            {plan.displayName}
            <Badge variant={plan.enabled ? "success" : "muted"}>
              {plan.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Internal SKU {plan.internalSku ?? "—"}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Plan enabled</FormLabel>
                      <FormDescription>Available to users.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Plan enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="imageGenerations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image generations</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="videoGenerations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video generations</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="creditAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit amount</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="maxImageQuality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max image quality</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IMAGE_QUALITIES.map((quality) => (
                          <SelectItem key={quality} value={quality}>
                            {quality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxVideoResolution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max video resolution</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((resolution) => (
                          <SelectItem key={resolution} value={resolution}>
                            {resolution}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxVideoDurationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max video duration (s)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="generationPriority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Generation priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeProductId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store product ID</FormLabel>
                    <FormControl>
                      <Input placeholder="live_weather_plus_monthly" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="internalSku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal SKU</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price label</FormLabel>
                    <FormControl>
                      <Input placeholder="$14.99 / mo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {dirty ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    Unsaved changes
                  </>
                ) : (
                  "No unsaved changes"
                )}
              </div>
              <Button type="submit" size="sm" disabled={!dirty || saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

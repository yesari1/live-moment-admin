import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelSelect } from "@/components/shared/model-select";
import {
  IMAGE_QUALITIES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  type RoutingTierMeta,
} from "@/data/routing";
import { resolveModelProvider } from "@/data/providers";
import { formatRelative } from "@/lib/format";
import type { GenerationType, RoutingConfig } from "@/types";

const schema = z
  .object({
    enabled: z.boolean(),
    primaryModel: z.string().min(1, "Select a primary model."),
    fallbackEnabled: z.boolean(),
    fallbackModel: z.string().min(1, "Select a fallback model."),
    retryEnabled: z.boolean(),
    retryCount: z.coerce
      .number({ invalid_type_error: "Enter a number." })
      .int()
      .min(0, "Retry count cannot be negative.")
      .max(5, "Retry count cannot exceed 5."),
    timeoutSeconds: z.coerce
      .number({ invalid_type_error: "Enter a number." })
      .int()
      .min(1, "Timeout must be greater than zero.")
      .max(600, "Timeout is too large."),
    quality: z.string().optional(),
    resolution: z.string().optional(),
    durationSeconds: z.coerce.number().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fallbackEnabled && !value.fallbackModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackModel"],
        message: "Fallback model is required when fallback is enabled.",
      });
    }
    if (
      value.fallbackEnabled &&
      value.fallbackModel &&
      value.fallbackModel === value.primaryModel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackModel"],
        message: "Fallback must differ from the primary model.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function toFormValues(config: RoutingConfig): FormValues {
  return {
    enabled: config.enabled,
    primaryModel: config.primary.model,
    fallbackEnabled: config.fallback.enabled,
    fallbackModel: config.fallback.model,
    retryEnabled: config.retry.enabled,
    retryCount: config.retry.count,
    timeoutSeconds: config.timeoutSeconds,
    quality: config.quality ?? "high",
    resolution: config.resolution ?? "1080p",
    durationSeconds: config.durationSeconds ?? 6,
  };
}

interface RoutingFormProps {
  type: GenerationType;
  /** One or more configs that receive identical values (Free merges onboarding + free). */
  targets: RoutingConfig[];
  onSave: (configs: RoutingConfig[]) => Promise<boolean>;
}

export function RoutingForm({ type, targets, onSave }: RoutingFormProps) {
  const [saving, setSaving] = React.useState(false);
  const base = targets[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(base),
  });

  React.useEffect(() => {
    form.reset(toFormValues(base));
  }, [base, form]);

  const values = form.watch();
  const dirty = form.formState.isDirty;

  const submit = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      const next = targets.map<RoutingConfig>((target) => ({
        ...target,
        enabled: data.enabled,
        primary: {
          provider: resolveModelProvider(
            data.primaryModel,
            target.primary.provider,
          ),
          model: data.primaryModel,
        },
        fallback: {
          enabled: data.fallbackEnabled,
          provider: resolveModelProvider(
            data.fallbackModel,
            target.fallback.provider,
          ),
          model: data.fallbackModel,
        },
        retry: { enabled: data.retryEnabled, count: data.retryCount },
        timeoutSeconds: data.timeoutSeconds,
        quality: type === "image" ? data.quality : undefined,
        resolution: type === "video" ? data.resolution : undefined,
        durationSeconds: type === "video" ? data.durationSeconds : undefined,
      }));
      const ok = await onSave(next);
      if (ok) form.reset(toFormValues(base));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="space-y-0.5">
            <FormLabel>Generation enabled</FormLabel>
            <FormDescription>
              When off, Live Moment will not generate this media type for the
              tier. Existing jobs are unaffected.
            </FormDescription>
          </div>
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Enable routing context"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Primary
          </p>
          <FormField
            control={form.control}
            name="primaryModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{type === "image" ? "Image model" : "Video model"}</FormLabel>
                <FormControl>
                  <ModelSelect
                    type={type}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  Models are grouped by provider. The provider is stored
                  automatically based on the model you pick.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <FormField
            control={form.control}
            name="fallbackEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-0.5">
                  <FormLabel>Fallback enabled</FormLabel>
                  <FormDescription>
                    Use a secondary model automatically if the primary fails.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Enable fallback"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="mt-3">
            <FormField
              control={form.control}
              name="fallbackModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fallback model</FormLabel>
                  <FormControl>
                    <ModelSelect
                      type={type}
                      value={field.value}
                      disabled={!values.fallbackEnabled}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reliability
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="retryEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                  <div className="space-y-0.5">
                    <FormLabel>Retry</FormLabel>
                    <FormDescription>Retry the primary.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Enable retry"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="retryCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retry count</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      disabled={!values.retryEnabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeoutSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout (seconds)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Output
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {type === "image" ? (
              <FormField
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality</FormLabel>
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
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="durationSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VIDEO_DURATIONS.map((duration) => (
                            <SelectItem key={duration} value={String(duration)}>
                              {duration} seconds
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
                  name="resolution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
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
              </>
            )}
          </div>
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
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                All changes saved
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => form.reset(toFormValues(base))}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" size="sm" disabled={!dirty || saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

interface RoutingTierCardProps {
  tier: RoutingTierMeta;
  configs: RoutingConfig[];
  onSave: (configs: RoutingConfig[]) => Promise<boolean>;
}

export function RoutingTierCard({ tier, configs, onSave }: RoutingTierCardProps) {
  const imageTargets = tier.imageContexts
    .map((context) =>
      configs.find((c) => c.type === "image" && c.context === context),
    )
    .filter((c): c is RoutingConfig => Boolean(c));
  const videoTargets = tier.videoContexts
    .map((context) =>
      configs.find((c) => c.type === "video" && c.context === context),
    )
    .filter((c): c is RoutingConfig => Boolean(c));

  const hasVideo = videoTargets.length > 0;
  const [media, setMedia] = React.useState<GenerationType>("image");

  const primary = media === "video" ? videoTargets[0] : imageTargets[0];
  const imageDirty =
    imageTargets.length > 1 &&
    imageTargets.some(
      (c) => c.primary.model !== imageTargets[0].primary.model,
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{tier.label}</CardTitle>
            <p className="text-xs text-muted-foreground">{tier.description}</p>
          </div>
          <Badge variant="muted" className="shrink-0">
            {tier.imageContexts.length > 1
              ? `${tier.imageContexts.length} contexts linked`
              : hasVideo
                ? "Image + Video"
                : "Image"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {imageDirty && (
          <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
            The linked onboarding and free configurations currently differ.
            Saving will apply the same settings to both.
          </p>
        )}
        {hasVideo ? (
          <Tabs
            value={media}
            onValueChange={(value) => setMedia(value as GenerationType)}
          >
            <TabsList>
              <TabsTrigger value="image">
                <ImageIcon className="mr-1.5 h-4 w-4" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video">
                <Video className="mr-1.5 h-4 w-4" />
                Video
              </TabsTrigger>
            </TabsList>
            <TabsContent value="image" className="mt-4">
              {imageTargets[0] && (
                <RoutingForm
                  type="image"
                  targets={imageTargets}
                  onSave={onSave}
                />
              )}
            </TabsContent>
            <TabsContent value="video" className="mt-4">
              {videoTargets[0] && (
                <RoutingForm
                  type="video"
                  targets={videoTargets}
                  onSave={onSave}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : imageTargets[0] ? (
          <RoutingForm type="image" targets={imageTargets} onSave={onSave} />
        ) : null}
        {primary && (
          <p className="mt-4 text-xs text-muted-foreground">
            {primary.updatedAt
              ? `Last updated ${formatRelative(primary.updatedAt)} · v${primary.version}`
              : `Not yet saved · v${primary.version}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** @deprecated kept for backwards compatibility with older imports. */
export const RoutingCard = RoutingTierCard;

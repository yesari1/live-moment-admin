import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { SystemToggle } from "@/components/shared/system-toggle";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import { fetchAppSettings, saveAppSettings } from "@/services/data-service";
import { formatRelative } from "@/lib/format";
import type { AppSettings } from "@/types";

const schema = z.object({
  imageGenerationEnabled: z.boolean(),
  videoGenerationEnabled: z.boolean(),
  newRegistrationsEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  onboardingGenerationEnabled: z.boolean(),
  freeGenerationLimit: z.coerce.number().int().min(0),
  defaultTimeoutSeconds: z.coerce.number().int().min(1),
  maxConcurrentGenerations: z.coerce.number().int().min(1),
  minimumAppVersion: z.string().min(1, "Minimum app version is required."),
  supportMessage: z.string().max(400).optional(),
  maintenanceMessage: z.string().max(400).optional(),
});

type FormValues = z.infer<typeof schema>;

export function AppSettingsPage() {
  const { user: actor } = useAuth();
  const query = useAsyncData(fetchAppSettings);
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [newFlag, setNewFlag] = React.useState("");
  const [confirming, setConfirming] = React.useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(null),
  });

  React.useEffect(() => {
    if (query.data) {
      form.reset(toValues(query.data));
      setFlags(query.data.featureFlags ?? {});
    }
  }, [query.data, form]);

  const values = form.watch();
  const dirty = form.formState.isDirty;

  const performSave = async (
    data: FormValues,
    action: Parameters<typeof saveAppSettings>[2],
  ) => {
    if (!query.data || !actor) return;
    try {
      const next: AppSettings = {
        ...query.data,
        ...data,
        supportMessage: data.supportMessage ?? "",
        maintenanceMessage: data.maintenanceMessage ?? "",
        featureFlags: flags,
      };
      await saveAppSettings(next, { uid: actor.uid, email: actor.email }, action);
      toast.success("App settings saved.");
      await query.refresh();
      form.reset(toValues(next));
    } catch (error) {
      toast.error("Failed to update settings", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const submit = form.handleSubmit(async (data) => {
    const highImpact =
      (query.data?.imageGenerationEnabled && !data.imageGenerationEnabled) ||
      (query.data?.videoGenerationEnabled && !data.videoGenerationEnabled) ||
      (query.data?.newRegistrationsEnabled && !data.newRegistrationsEnabled) ||
      (!query.data?.maintenanceMode && data.maintenanceMode);
    if (highImpact) {
      setConfirming(data);
      return;
    }
    await performSave(data, "APP_SETTINGS_UPDATED");
  });

  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="App Settings"
          description="Global remote controls and emergency kill switches."
        />
        <ErrorState message={query.error} onRetry={query.refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Settings"
        description="Global remote controls for Live Moment. Emergency controls affect every user immediately and are enforced by the backend."
        actions={
          query.data && (
            <Badge variant="muted">
              v{query.data.version} · updated {formatRelative(query.data.updatedAt)}
            </Badge>
          )
        }
      />

      {query.loading ? (
        <PanelSkeleton rows={6} />
      ) : (
        <Form {...form}>
          <form onSubmit={submit} className="space-y-6">
            <Card className="border-warning/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  System control
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Kill switches. New requests are rejected with a controlled
                  application-level error when a feature is disabled.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                <SystemToggle
                  danger
                  label="Image generation"
                  description="Disable all image generation across the app."
                  checked={values.imageGenerationEnabled}
                  onCheckedChange={(checked) =>
                    form.setValue("imageGenerationEnabled", checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <SystemToggle
                  danger
                  label="Video generation"
                  description="Disable all video generation across the app."
                  checked={values.videoGenerationEnabled}
                  onCheckedChange={(checked) =>
                    form.setValue("videoGenerationEnabled", checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <SystemToggle
                  danger
                  label="New registrations"
                  description="Stop accepting new account registrations."
                  checked={values.newRegistrationsEnabled}
                  onCheckedChange={(checked) =>
                    form.setValue("newRegistrationsEnabled", checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <SystemToggle
                  danger
                  label="Maintenance mode"
                  description="Show the maintenance message and block generation."
                  checked={values.maintenanceMode}
                  onCheckedChange={(checked) =>
                    form.setValue("maintenanceMode", checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <SystemToggle
                  label="Onboarding generation"
                  description="Allow the first-run onboarding generation."
                  checked={values.onboardingGenerationEnabled}
                  onCheckedChange={(checked) =>
                    form.setValue("onboardingGenerationEnabled", checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Generation limits</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="freeGenerationLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Free generation limit</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultTimeoutSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default timeout (s)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxConcurrentGenerations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max concurrent generations</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="minimumAppVersion"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-3">
                      <FormLabel>Minimum supported app version</FormLabel>
                      <FormControl>
                        <Input placeholder="1.4.0" {...field} />
                      </FormControl>
                      <FormDescription>
                        Older builds may be asked to update.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Messages</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="supportMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Support message</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maintenanceMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maintenance message</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Feature flags</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Optional toggles read by the backend for gradual rollouts.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(flags).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="font-mono text-xs">{key}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) =>
                          setFlags((prev) => ({ ...prev, [key]: checked }))
                        }
                        aria-label={key}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${key}`}
                        onClick={() =>
                          setFlags((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    value={newFlag}
                    onChange={(e) => setNewFlag(e.target.value)}
                    placeholder="new_flag_key"
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const key = newFlag.trim();
                      if (!key) return;
                      setFlags((prev) => ({ ...prev, [key]: false }));
                      setNewFlag("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add flag
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {dirty
                  ? "You have unsaved changes."
                  : "All changes saved."}
              </p>
              <Button type="submit" disabled={!dirty}>
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      )}

      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Apply high-impact system changes?"
        destructive
        confirmLabel="Apply changes"
        onConfirm={async () => {
          if (confirming) await performSave(confirming, "KILL_SWITCH_TOGGLED");
          setConfirming(null);
        }}
        description={
          <div className="space-y-2">
            <p>
              You are changing global generation controls. New requests will be
              affected immediately across all users.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {confirming && !confirming.imageGenerationEnabled && (
                <li>Image generation will be disabled.</li>
              )}
              {confirming && !confirming.videoGenerationEnabled && (
                <li>Video generation will be disabled.</li>
              )}
              {confirming && !confirming.newRegistrationsEnabled && (
                <li>New registrations will be disabled.</li>
              )}
              {confirming?.maintenanceMode && <li>Maintenance mode will be enabled.</li>}
            </ul>
          </div>
        }
      />
    </div>
  );
}

function toValues(settings: AppSettings | null): FormValues {
  return {
    imageGenerationEnabled: settings?.imageGenerationEnabled ?? true,
    videoGenerationEnabled: settings?.videoGenerationEnabled ?? true,
    newRegistrationsEnabled: settings?.newRegistrationsEnabled ?? true,
    maintenanceMode: settings?.maintenanceMode ?? false,
    onboardingGenerationEnabled: settings?.onboardingGenerationEnabled ?? true,
    freeGenerationLimit: settings?.freeGenerationLimit ?? 1,
    defaultTimeoutSeconds: settings?.defaultTimeoutSeconds ?? 45,
    maxConcurrentGenerations: settings?.maxConcurrentGenerations ?? 3,
    minimumAppVersion: settings?.minimumAppVersion ?? "1.0.0",
    supportMessage: settings?.supportMessage ?? "",
    maintenanceMessage: settings?.maintenanceMessage ?? "",
  };
}

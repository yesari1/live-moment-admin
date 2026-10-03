import * as React from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  Copy,
  FileText,
  Loader2,
  Plus,
  Radio,
  Save,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  ContentEditor,
  Field,
  Notice,
  Picker,
} from "@/components/notifications/content-editor";
import { CampaignEditor } from "@/components/notifications/campaign-editor";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_SETTINGS,
  PLANS,
  STAT_KEYS,
  TEMPLATE_IDS,
  ZERO_STATS,
  audienceSummary,
  canEditCampaign,
  contentErrors,
  emptyCampaign,
  parseUids,
  settingsErrors,
  type NotificationCampaign,
  type NotificationLogEntry,
  type NotificationSettings,
  type NotificationTemplate,
} from "@/lib/notifications";
import {
  fetchNotificationLogs,
  notificationError,
  saveNotificationSettings,
  saveNotificationTemplate,
  sendNotificationTest,
  transitionNotificationCampaign,
  watchCampaigns,
  watchSettings,
  watchTemplates,
} from "@/services/notifications";

export function Busy({ text = "Loading…" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </span>
  );
}
export function TestOutcomes({
  results,
}: {
  results: { uid: string; outcome: string; devices?: number }[];
}) {
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <Notice key={`${r.uid}-${i}`} danger={r.outcome !== "sent"}>
          <span className="font-mono text-xs">{r.uid}</span> · {r.outcome}
          {r.devices != null ? ` · ${r.devices} devices` : ""}
          {r.outcome === "no_devices" && (
            <p className="mt-1">
              Open Live Moment on this account’s phone and allow notifications
              to register a device.
            </p>
          )}
        </Notice>
      ))}
    </div>
  );
}
export function NotificationsPage() {
  const { getIdToken, demoMode } = useAuth();
  const [tab, setTab] = React.useState("templates");
  const [templates, setTemplates] = React.useState<NotificationTemplate[]>([]);
  const [settings, setSettings] =
    React.useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [campaigns, setCampaigns] = React.useState<NotificationCampaign[]>([]);
  const [ready, setReady] = React.useState({
    templates: false,
    settings: false,
    campaigns: false,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [retry, setRetry] = React.useState(0);
  const [editor, setEditor] = React.useState<NotificationCampaign | null>(null);
  const testedContent = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (demoMode) return;
    setErrors({});
    const unsubs: (() => void)[] = [];
    for (const key of ["templates", "settings", "campaigns"] as const) {
      const fail = (e: Error) =>
        setErrors((prev) => ({ ...prev, [key]: notificationError(e) }));
      const done = () => {
        setReady((prev) => ({ ...prev, [key]: true }));
        setErrors((prev) => ({ ...prev, [key]: "" }));
      };
      try {
        if (key === "templates")
          unsubs.push(
            watchTemplates((v) => {
              setTemplates(v);
              done();
            }, fail),
          );
        if (key === "settings")
          unsubs.push(
            watchSettings((v) => {
              setSettings(v);
              done();
            }, fail),
          );
        if (key === "campaigns")
          unsubs.push(
            watchCampaigns((v) => {
              setCampaigns(v);
              done();
            }, fail),
          );
      } catch (e) {
        fail(e as Error);
      }
    }
    return () => unsubs.forEach((stop) => stop());
  }, [demoMode, retry]);
  async function token() {
    const value = await getIdToken();
    if (!value) throw new Error("A live Firebase admin session is required.");
    return value;
  }
  function duplicate(c: NotificationCampaign) {
    setEditor({
      ...c,
      id: "",
      status: "draft",
      stats: { ...ZERO_STATS },
      createdAt: null,
      scheduledAt: null,
      channel: "product_updates",
      lastError: undefined,
    });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Thoughtful messages, in every language. Manage plan reminders and product campaigns."
        actions={
          <Button
            onClick={() => {
              setTab("campaigns");
              setEditor(emptyCampaign());
            }}
            disabled={demoMode || !ready.settings}
          >
            <Plus />
            New campaign
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gradient-to-r from-primary/10 to-transparent p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-primary/10 p-3">
            <Bell className="h-5 w-5 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {ready.settings
                ? settings.enabled
                  ? "Notifications are live"
                  : "Notifications are paused"
                : "Connecting to notification settings"}
            </p>
            <p className="text-xs text-muted-foreground">
              {settings.enabled
                ? "The backend sends scheduled campaigns and automated reminders."
                : "Enable global delivery in Settings. Test sends still work while paused."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTab("settings")}>
          <Settings2 />
          Settings
        </Button>
      </div>
      {demoMode ? (
        <Notice>
          Notifications need live Firebase data. Demo mode cannot save changes
          or send messages.
        </Notice>
      ) : (
        <>
          {!!errors.settings && (
            <Notice danger>
              Settings could not load: {errors.settings}. Sending is disabled.
            </Notice>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="templates" className="gap-2">
                <FileText className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2">
                <Send className="h-4 w-4" />
                Campaigns
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="log" className="gap-2">
                <Radio className="h-4 w-4" />
                Log / stats
              </TabsTrigger>
            </TabsList>
            {(["templates", "settings", "campaigns"] as const).map((key) =>
              errors[key] ? (
                <TabsContent key={key} value={key}>
                  <Notice danger>{errors[key]}</Notice>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() => setRetry((n) => n + 1)}
                  >
                    Retry connection
                  </Button>
                </TabsContent>
              ) : null,
            )}
            <TabsContent value="templates" className="mt-5">
              {!errors.templates &&
                (ready.templates ? (
                  <TemplateList templates={templates} getToken={token} />
                ) : (
                  <Busy />
                ))}
            </TabsContent>
            <TabsContent value="settings" className="mt-5">
              {!errors.settings &&
                (ready.settings ? (
                  <SettingsPanel settings={settings} />
                ) : (
                  <Busy />
                ))}
            </TabsContent>
            <TabsContent value="campaigns" className="mt-5">
              {!errors.campaigns &&
                (ready.campaigns ? (
                  <CampaignList
                    campaigns={campaigns}
                    edit={setEditor}
                    duplicate={duplicate}
                  />
                ) : (
                  <Busy />
                ))}
            </TabsContent>
            <TabsContent value="log" className="mt-5">
              <LogPanel campaigns={campaigns} />
            </TabsContent>
          </Tabs>
          {editor && (
            <CampaignEditor
              key={editor.id || "new"}
              initial={editor}
              settings={settings}
              settingsReady={ready.settings && !errors.settings}
              getToken={token}
              testedContent={testedContent.current}
              onClose={() => setEditor(null)}
              onSettings={() => {
                setEditor(null);
                setTab("settings");
              }}
              liveCampaign={campaigns.find((c) => c.id === editor.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function TemplateList({
  templates,
  getToken,
}: {
  templates: NotificationTemplate[];
  getToken: () => Promise<string>;
}) {
  const { user } = useAuth();
  const [editor, setEditor] = React.useState<NotificationTemplate | null>(null);
  const [toggling, setToggling] = React.useState<string | null>(null);
  async function toggle(template: NotificationTemplate, enabled: boolean) {
    if (!user) return;
    setToggling(template.id);
    try {
      await saveNotificationTemplate(
        {
          ...template,
          enabled,
          channel: "plan_reminders",
          params:
            template.id === "plan_ending_soon"
              ? { daysBefore: 3, sendHourLocal: 9, ...template.params }
              : template.params,
        },
        user,
      );
      toast.success(enabled ? "Reminder enabled" : "Reminder disabled");
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setToggling(null);
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Automated plan reminders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three backend triggers. Edit the message and audience for each
          reminder.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {TEMPLATE_IDS.map((id) => {
          const template = templates.find((t) => t.id === id);
          const names = {
            plan_ending_soon: "Plan ending soon",
            plan_ended: "Plan ended",
            plan_renewed: "Plan renewed",
          };
          return (
            <div
              key={id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={template?.enabled ? "success" : "muted"}>
                    {template?.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Switch
                    aria-label={`Enable ${names[id]}`}
                    checked={template?.enabled ?? false}
                    disabled={!template || !!toggling}
                    onCheckedChange={(enabled) =>
                      template && void toggle(template, enabled)
                    }
                  />
                </div>
              </div>
              <div>
                <h3 className="font-semibold">{names[id]}</h3>
                <p className="mt-2 min-h-10 text-xs leading-relaxed text-muted-foreground">
                  {template?.trigger ||
                    "Seeded template is missing. Run the backend notification seed."}
                </p>
              </div>
              <Badge variant="outline" className="self-start">
                {template?.channel ?? "plan_reminders"}
              </Badge>
              <Button
                variant="outline"
                className="mt-auto"
                disabled={!template}
                onClick={() => template && setEditor(template)}
              >
                Edit reminder
              </Button>
            </div>
          );
        })}
      </div>
      {editor && (
        <TemplateEditor
          key={editor.id}
          initial={editor}
          getToken={getToken}
          close={() => setEditor(null)}
        />
      )}
    </div>
  );
}
function TemplateEditor({
  initial,
  getToken,
  close,
}: {
  initial: NotificationTemplate;
  getToken: () => Promise<string>;
  close: () => void;
}) {
  const { user } = useAuth();
  const [value, setValue] = React.useState({
    ...initial,
    channel: "plan_reminders" as const,
    params:
      initial.id === "plan_ending_soon"
        ? { daysBefore: 3, sendHourLocal: 9, ...initial.params }
        : initial.params,
  });
  const [busy, setBusy] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [results, setResults] = React.useState<
    React.ComponentProps<typeof TestOutcomes>["results"]
  >([]);
  const errors = contentErrors(value, value.enabled);
  const paramsInvalid =
    value.id === "plan_ending_soon" &&
    (!Number.isInteger(value.params.daysBefore) ||
      value.params.daysBefore! < 1 ||
      value.params.daysBefore! > 14 ||
      !Number.isInteger(value.params.sendHourLocal) ||
      value.params.sendHourLocal! < 0 ||
      value.params.sendHourLocal! > 23);
  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      await saveNotificationTemplate(value, user);
      toast.success("Reminder saved");
      close();
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setResults([]);
    try {
      const result = await sendNotificationTest(await getToken(), {
        templateId: value.id,
        target: "self",
      });
      setResults(result.results);
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !translating) close();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.id.replace(/_/g, " ")}</DialogTitle>
          <DialogDescription>{initial.trigger}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Enable this reminder</span>
            <Switch
              aria-label="Enable this reminder"
              checked={value.enabled}
              disabled={translating}
              onCheckedChange={(enabled) => setValue({ ...value, enabled })}
            />
          </div>
          <ContentEditor
            value={value}
            onChange={setValue}
            getToken={getToken}
            onBusyChange={setTranslating}
          />
          {value.id === "plan_ending_soon" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Days before expiry (1–14)">
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={value.params.daysBefore ?? 3}
                  disabled={translating}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      params: {
                        ...value.params,
                        daysBefore: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Local send hour (0–23)">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={value.params.sendHourLocal ?? 9}
                  disabled={translating}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      params: {
                        ...value.params,
                        sendHourLocal: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            </div>
          )}
          <PlanChoices
            selected={value.audience.plans}
            disabled={translating}
            onChange={(plans) =>
              setValue({ ...value, audience: { ...value.audience, plans } })
            }
          />
          <p className="text-xs text-muted-foreground">
            No plans selected means any plan.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.audience.excludeAdminGrant}
              disabled={translating}
              onChange={(e) =>
                setValue({
                  ...value,
                  audience: {
                    ...value.audience,
                    excludeAdminGrant: e.target.checked,
                  },
                })
              }
            />
            Exclude admin grants
          </label>
          {errors.length > 0 && <Notice danger>{errors.join(" · ")}</Notice>}
          {paramsInvalid && (
            <Notice danger>
              Days before expiry must be 1–14; send hour must be 0–23.
            </Notice>
          )}
          <TestOutcomes results={results} />
          <p className="text-xs text-muted-foreground">
            Template tests use the saved reminder and sample values. Save your
            changes first to test them.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={close}
              disabled={busy || translating}
            >
              Close
            </Button>
            <Button
              variant="outline"
              disabled={busy || translating}
              onClick={() => void test()}
            >
              <SmartTestIcon />
              Send test to me
            </Button>
            <Button
              disabled={
                busy || translating || errors.length > 0 || paramsInvalid
              }
              onClick={() => void save()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Save />}Save
              reminder
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
function SmartTestIcon() {
  return <Send className="h-4 w-4" />;
}
export function PlanChoices({
  selected,
  onChange,
  disabled,
}: {
  selected: readonly string[];
  onChange: (plans: NotificationTemplate["audience"]["plans"]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Plans</p>
      <div className="flex flex-wrap gap-2">
        {PLANS.map((p) => (
          <label
            key={p}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(p)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? ([
                        ...selected,
                        p,
                      ] as NotificationTemplate["audience"]["plans"])
                    : (selected.filter(
                        (v) => v !== p,
                      ) as NotificationTemplate["audience"]["plans"]),
                )
              }
            />
            {p === "free"
              ? "Free"
              : p === "live_weather"
                ? "Live Weather"
                : "Live Weather Plus"}
          </label>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings }: { settings: NotificationSettings }) {
  const { user } = useAuth();
  const [value, setValue] = React.useState(settings);
  const [recipients, setRecipients] = React.useState(
    settings.testRecipients.join("\n"),
  );
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => {
    setValue(settings);
    setRecipients(settings.testRecipients.join("\n"));
  }, [settings]);
  const errors = settingsErrors(value);
  async function save(onlyEnabled = false, enabled = settings.enabled) {
    if (!user) return;
    setBusy(true);
    try {
      await saveNotificationSettings(
        { ...value, enabled, testRecipients: parseUids(recipients) },
        user,
        onlyEnabled,
      );
      setConfirm(false);
      toast.success(
        onlyEnabled
          ? enabled
            ? "Global delivery enabled"
            : "Global delivery paused"
          : "Settings saved",
      );
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-5 rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Global delivery
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Controls all real notifications. Turning off takes effect
            immediately. Tests bypass this switch.
          </p>
        </div>
        <Switch
          aria-label="Global delivery"
          className="shrink-0 scale-125"
          checked={settings.enabled}
          disabled={busy}
          onCheckedChange={(enabled) =>
            enabled ? setConfirm(true) : void save(true, false)
          }
        />
      </div>
      <fieldset
        disabled={busy}
        className="space-y-5 rounded-xl border bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Quiet hours</h3>
            <p className="text-xs text-muted-foreground">
              In each user’s local time. Overnight ranges are supported.
            </p>
          </div>
          <Switch
            aria-label="Quiet hours"
            checked={!!value.quietHours}
            onCheckedChange={(enabled) =>
              setValue({
                ...value,
                quietHours: enabled ? { start: "22:00", end: "08:00" } : null,
              })
            }
          />
        </div>
        {value.quietHours && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start">
              <Input
                type="time"
                value={value.quietHours.start}
                onChange={(e) =>
                  setValue({
                    ...value,
                    quietHours: { ...value.quietHours!, start: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={value.quietHours.end}
                onChange={(e) =>
                  setValue({
                    ...value,
                    quietHours: { ...value.quietHours!, end: e.target.value },
                  })
                }
              />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Maximum per user / rolling 24 hours"
            hint="0–20 · accounts at the cap are skipped"
          >
            <Input
              type="number"
              min={0}
              max={20}
              value={value.maxPerUserPerDay}
              onChange={(e) =>
                setValue({ ...value, maxPerUserPerDay: Number(e.target.value) })
              }
            />
          </Field>
          <Field
            label="Fallback time zone"
            hint="Used when a device has never reported a time zone"
          >
            <Input
              value={value.defaultTimezone}
              onChange={(e) =>
                setValue({ ...value, defaultTimezone: e.target.value })
              }
              placeholder="Europe/Istanbul"
            />
          </Field>
        </div>
        <Picker
          label="Default channel"
          value={value.defaultChannel}
          options={{
            plan_reminders: "Plan reminders",
            product_updates: "Product updates",
          }}
          onChange={(defaultChannel) =>
            setValue({
              ...value,
              defaultChannel:
                defaultChannel as NotificationSettings["defaultChannel"],
            })
          }
        />
        <Field
          label="Test recipient account UIDs"
          hint="One UID per line; commas and spaces also work"
        >
          <Textarea
            rows={4}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />
        </Field>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            user &&
            setRecipients(parseUids(`${recipients}\n${user.uid}`).join("\n"))
          }
        >
          Add me
        </Button>
        {errors.length > 0 && <Notice danger>{errors.join(" · ")}</Notice>}
        <div className="flex justify-end">
          <Button
            disabled={busy || errors.length > 0}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Save />}Save
            settings
          </Button>
        </div>
      </fieldset>
      <Dialog open={confirm} onOpenChange={(open) => !busy && setConfirm(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable global notification delivery?</DialogTitle>
            <DialogDescription>
              Automated reminders and waiting scheduled campaigns can now be
              sent by the backend. Check pending campaigns before enabling.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep paused
            </Button>
            <Button disabled={busy} onClick={() => void save(true, true)}>
              {busy && <Loader2 className="animate-spin" />}Enable delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CampaignList({
  campaigns,
  edit,
  duplicate,
}: {
  campaigns: NotificationCampaign[];
  edit: (c: NotificationCampaign) => void;
  duplicate: (c: NotificationCampaign) => void;
}) {
  const { user } = useAuth();
  const [cancel, setCancel] = React.useState<NotificationCampaign | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function change(
    c: NotificationCampaign,
    status: "draft" | "cancelled",
  ) {
    if (!user) return;
    setBusy(true);
    try {
      await transitionNotificationCampaign(c.id, status, user);
      setCancel(null);
      toast.success(
        status === "draft" ? "Returned to draft" : "Campaign cancelled",
      );
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Product campaigns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled delivery is checked every 10 minutes. Statistics update
            live.
          </p>
        </div>
        {campaigns.some((c) => c.status === "sending") && (
          <Badge variant="success">
            <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live
          </Badge>
        )}
      </div>
      {!campaigns.length && (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Your first campaign starts here. Create a draft, test it, then
          schedule.
        </div>
      )}
      {campaigns.map((c) => (
        <div key={c.id} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words font-semibold">
                  {c.title[c.sourceLocale] || c.title.en || "Untitled campaign"}
                </h3>
                <Badge
                  variant={
                    c.status === "sent"
                      ? "success"
                      : c.status === "failed"
                        ? "destructive"
                        : c.status === "sending"
                          ? "warning"
                          : "muted"
                  }
                >
                  {c.status}
                </Badge>
              </div>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {audienceSummary(c.audience)} ·{" "}
                {c.scheduledAt
                  ? formatDateTime(c.scheduledAt)
                  : "Next dispatcher run (≤ 10 min)"}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {c.id}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditCampaign(c.status) && (
                <Button size="sm" variant="outline" onClick={() => edit(c)}>
                  Edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => duplicate(c)}>
                <Copy />
                Duplicate
              </Button>
              {c.status === "scheduled" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void change(c, "draft")}
                >
                  Return to draft
                </Button>
              )}
              {["scheduled", "sending"].includes(c.status) && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setCancel(c)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {STAT_KEYS.map((k) => (
              <div key={k} className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-xs capitalize text-muted-foreground">{k}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {c.stats[k].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          {c.lastError && (
            <Notice danger>Backend validation: {c.lastError}</Notice>
          )}
        </div>
      ))}
      <Dialog
        open={!!cancel}
        onOpenChange={(open) => !open && !busy && setCancel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this campaign?</DialogTitle>
            <DialogDescription>
              {cancel?.status === "sending"
                ? "Some users may already have received it. The dispatcher stops at the next batch."
                : "This campaign will no longer be dispatched. Cancelled campaigns cannot be edited or restarted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCancel(null)}
            >
              Keep campaign
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => cancel && void change(cancel, "cancelled")}
            >
              {busy && <Loader2 className="animate-spin" />}Cancel campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function LogPanel({ campaigns }: { campaigns: NotificationCampaign[] }) {
  const [logs, setLogs] = React.useState<NotificationLogEntry[]>([]);
  const [summaryLogs, setSummaryLogs] = React.useState<NotificationLogEntry[]>(
    [],
  );
  const [status, setStatus] = React.useState("all");
  const [templateId, setTemplateId] = React.useState("");
  const [campaignId, setCampaignId] = React.useState("");
  const [days, setDays] = React.useState("7");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let stale = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetchNotificationLogs({
        templateId: templateId || undefined,
        campaignId: campaignId || undefined,
      }),
      fetchNotificationLogs({}, Number(days)),
    ])
      .then(([latest, period]) => {
        if (!stale) {
          setLogs(latest);
          setSummaryLogs(period);
        }
      })
      .catch((e) => {
        if (!stale) setError(notificationError(e));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [templateId, campaignId, days, retry]);
  const filtered = logs
    .filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (!templateId || l.templateId === templateId) &&
        (!campaignId || l.campaignId === campaignId),
    )
    .slice(0, 100);
  const groups = new Map<string, Record<string, number>>();
  for (const log of summaryLogs) {
    if (
      (templateId && log.templateId !== templateId) ||
      (campaignId && log.campaignId !== campaignId)
    )
      continue;
    const key = log.campaignId
      ? `Campaign · ${log.campaignId}`
      : log.templateId
        ? `Template · ${log.templateId}`
        : "Tests";
    const row = groups.get(key) ?? {};
    row[log.status] = (row[log.status] ?? 0) + 1;
    groups.set(key, row);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Picker
          label="Status"
          value={status}
          onChange={setStatus}
          options={{
            all: "All statuses",
            sending: "Sending",
            sent: "Sent",
            failed: "Failed",
            deferred: "Deferred",
            expired: "Expired",
          }}
        />
        <Picker
          label="Template"
          value={templateId}
          onChange={(v) => {
            setTemplateId(v);
            setCampaignId("");
          }}
          options={{
            "": "All templates",
            ...Object.fromEntries(TEMPLATE_IDS.map((id) => [id, id])),
          }}
        />
        <Picker
          label="Campaign"
          value={campaignId}
          onChange={(v) => {
            setCampaignId(v);
            setTemplateId("");
          }}
          options={{
            "": "All campaigns",
            ...Object.fromEntries(
              campaigns.map((c) => [c.id, `${c.title.en || c.id} · ${c.id}`]),
            ),
          }}
        />
        <Picker
          label="Summary period"
          value={days}
          onChange={setDays}
          options={{ "7": "Last 7 days", "30": "Last 30 days" }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <p>Latest 100 entries · retained for 90 days</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRetry((n) => n + 1)}
          disabled={loading}
        >
          Refresh logs
        </Button>
      </div>
      {error ? (
        <Notice danger>{error}</Notice>
      ) : loading ? (
        <Busy text="Loading delivery records…" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {[
                    "Time",
                    "Account",
                    "Source",
                    "Status",
                    "Delivered / devices",
                    "Reason",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(log.sentAt ?? log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-mono text-primary hover:underline"
                        to={`/users?uid=${encodeURIComponent(log.uid)}`}
                      >
                        {log.uid}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {log.templateId ?? log.campaignId ?? log.kind}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          log.status === "failed" ? "destructive" : "muted"
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {log.deliveredCount} / {log.deviceCount}
                    </td>
                    <td className="px-4 py-3">{log.reason ?? "—"}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-10 text-center text-muted-foreground"
                    >
                      No notification records match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Delivery outcomes · last {days} days
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {[...groups].map(([key, counts]) => (
                <div key={key} className="space-y-3 rounded-xl border p-4">
                  <p className="break-all text-xs font-medium">{key}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(counts).map(([s, n]) => (
                      <Badge key={s} variant="outline">
                        {s}: {n.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {!groups.size && (
                <p className="text-xs text-muted-foreground">
                  No deliveries in this period.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

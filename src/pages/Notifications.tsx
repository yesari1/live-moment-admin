import * as React from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  Copy,
  FileText,
  Loader2,
  Plus,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ManualTemplateEditor } from "@/components/notifications/manual-template-editor";
import { DeviceStatus } from "@/components/notifications/device-status";
import { TestNotificationButton } from "@/components/notifications/test-notification-button";
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
  emptyManualTemplate,
  isManualTemplate,
  templateCampaign,
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
  transitionNotificationCampaign,
  watchCampaigns,
  watchSettings,
  watchTemplates,
} from "@/services/notifications";
export function Busy({ text = "Loading…" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </span>
  );
}
const REMINDERS = {
  plan_ending_soon: {
    name: "Before a plan expires",
    description: "Remind subscribers while their plan is still active.",
  },
  plan_ended: {
    name: "When a plan expires",
    description: "Let subscribers know their plan has ended.",
  },
  plan_renewed: {
    name: "When a plan renews",
    description: "Confirm that their plan has been renewed.",
  },
};
export function NotificationsPage() {
  const { user, getIdToken, demoMode } = useAuth();
  const [tab, setTab] = React.useState("history");
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
  const [logsOpen, setLogsOpen] = React.useState(false);
  React.useEffect(() => {
    if (demoMode) return;
    setErrors({});
    const unsubs: (() => void)[] = [];
    for (const key of ["templates", "settings", "campaigns"] as const) {
      const fail = (e: Error) =>
        setErrors((p) => ({ ...p, [key]: notificationError(e) }));
      const done = () => {
        setReady((p) => ({ ...p, [key]: true }));
        setErrors((p) => ({ ...p, [key]: "" }));
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
    const token = await getIdToken();
    if (!token) throw new Error("Sign in again to continue.");
    return token;
  }
  function create() {
    setEditor({ ...emptyCampaign(), audience: { kind: "all" } });
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
  function sendTemplate(t: NotificationTemplate) {
    if (user)
      setEditor({
        ...templateCampaign(t, user.uid),
        audience: { kind: "all" },
      });
  }
  function connection(
    key: "templates" | "settings" | "campaigns",
    content: React.ReactNode,
  ) {
    return errors[key] ? (
      <div className="space-y-3">
        <Notice danger>{errors[key]}</Notice>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          Try again
        </Button>
      </div>
    ) : ready[key] ? (
      content
    ) : (
      <Busy />
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Send a message now, schedule it for later, or set up automatic reminders."
        actions={
          <Button onClick={create} disabled={demoMode}>
            <Plus />
            New notification
          </Button>
        }
      />
      {demoMode ? (
        <Notice>Sign in to create and send notifications.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="history">
                  <Bell className="mr-2 h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="templates">
                  <FileText className="mr-2 h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="reminders">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Automatic reminders
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {ready.settings && !settings.enabled && (
              <button
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={() => setTab("settings")}
              >
                Sending paused · Settings
              </button>
            )}
          </div>
          {tab === "history" &&
            connection(
              "campaigns",
              <div className="space-y-8">
                <CampaignList
                  campaigns={campaigns}
                  edit={setEditor}
                  duplicate={duplicate}
                />
                <details
                  className="rounded-xl border p-4"
                  onToggle={(e) => setLogsOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Delivery details & logs
                  </summary>
                  {logsOpen && (
                    <div className="mt-5">
                      <LogPanel campaigns={campaigns} />
                    </div>
                  )}
                </details>
              </div>,
            )}
          {(tab === "templates" || tab === "reminders") &&
            connection(
              "templates",
              <TemplateList
                key={tab}
                templates={templates}
                getToken={token}
                onSend={sendTemplate}
                reminders={tab === "reminders"}
              />,
            )}
          {tab === "settings" &&
            connection(
              "settings",
              <div className="space-y-6">
                <SettingsPanel settings={settings} />
                <details className="max-w-3xl rounded-xl border p-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    My phone registration
                  </summary>
                  <div className="mt-4">
                    <DeviceStatus getToken={token} />
                  </div>
                </details>
              </div>,
            )}
          {editor && (
            <CampaignEditor
              key={editor.id || "new"}
              initial={editor}
              settings={settings}
              settingsReady={ready.settings && !errors.settings}
              getToken={token}
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
  onSend,
  reminders,
}: {
  templates: NotificationTemplate[];
  getToken: () => Promise<string>;
  onSend: (t: NotificationTemplate) => void;
  reminders: boolean;
}) {
  const { user } = useAuth();
  const [editor, setEditor] = React.useState<NotificationTemplate | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function toggle(t: NotificationTemplate, enabled: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      await saveNotificationTemplate(
        {
          ...t,
          enabled,
          channel: "plan_reminders",
          params:
            t.id === "plan_ending_soon"
              ? { daysBefore: 3, sendHourLocal: 9, ...t.params }
              : t.params,
        },
        user,
      );
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {reminders ? "Automatic reminders" : "Saved messages"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reminders
              ? "These messages are sent automatically when someone’s plan changes."
              : "Keep messages here to reuse them later."}
          </p>
        </div>
        {!reminders && (
          <Button
            variant="outline"
            onClick={() => setEditor(emptyManualTemplate())}
          >
            <Plus />
            Create template
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(reminders
          ? TEMPLATE_IDS.map((id) => templates.find((t) => t.id === id)).filter(
              (t): t is NotificationTemplate => !!t,
            )
          : templates.filter((t) => isManualTemplate(t.id))
        ).map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">
                {reminders
                  ? REMINDERS[t.id as keyof typeof REMINDERS].name
                  : t.name || "Untitled template"}
              </h3>
              {reminders && (
                <Switch
                  aria-label={`Enable ${REMINDERS[t.id as keyof typeof REMINDERS].name}`}
                  checked={t.enabled}
                  disabled={busy}
                  onCheckedChange={(enabled) => void toggle(t, enabled)}
                />
              )}
            </div>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {reminders
                ? REMINDERS[t.id as keyof typeof REMINDERS].description
                : t.body[t.sourceLocale] || t.body.en || "No message yet."}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditor(t)}>
                Edit
              </Button>
              {!reminders && (
                <Button size="sm" onClick={() => onSend(t)}>
                  Use template
                  <Send />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!reminders && !templates.some((t) => isManualTemplate(t.id)) && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FileText className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium">No saved messages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a template for a message you send often.
          </p>
        </div>
      )}
      {reminders &&
        !TEMPLATE_IDS.some((id) => templates.some((t) => t.id === id)) && (
          <p className="text-sm text-muted-foreground">
            Automatic reminders are not set up yet.
          </p>
        )}
      {editor &&
        (isManualTemplate(editor.id) ? (
          <ManualTemplateEditor
            key={editor.id}
            initial={editor}
            getToken={getToken}
            onClose={() => setEditor(null)}
          />
        ) : (
          <TemplateEditor
            initial={editor}
            getToken={getToken}
            close={() => setEditor(null)}
          />
        ))}
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
  const [error, setError] = React.useState("");
  async function save() {
    if (!user) return;
    const error = contentErrors(value, value.enabled)[0];
    if (error) {
      setError(error);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveNotificationTemplate(value, user);
      toast.success("Reminder saved");
      close();
    } catch (e) {
      setError(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !translating && close()}
    >
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b p-6 pr-12">
          <DialogTitle>
            {REMINDERS[initial.id as keyof typeof REMINDERS].name}
          </DialogTitle>
          <DialogDescription>
            Plan name and expiry date are filled automatically for each person.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <fieldset disabled={busy} className="space-y-6">
            <ContentEditor
              value={value}
              onChange={setValue}
              getToken={getToken}
              onBusyChange={setTranslating}
              allowVariables
            />
            {value.id === "plan_ending_soon" && (
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <Field label="Days before expiry">
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
                <Field label="Send hour (local time)">
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
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm">
                Recipient filters{" "}
                <span className="text-muted-foreground">Optional</span>
              </summary>
              <div className="mt-4 space-y-4">
                <PlanChoices
                  selected={value.audience.plans}
                  disabled={translating}
                  onChange={(plans) =>
                    setValue({
                      ...value,
                      audience: { ...value.audience, plans },
                    })
                  }
                />
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
                  Exclude plans granted by an admin
                </label>
              </div>
            </details>
          </fieldset>
        </div>
        <div className="shrink-0 border-t p-4 px-6">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TestNotificationButton
              content={value}
              getToken={getToken}
              disabled={busy || translating}
            />
            <Button disabled={busy || translating} onClick={() => void save()}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}Save
              reminder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [filter, setFilter] = React.useState("all");
  const [cancel, setCancel] = React.useState<NotificationCampaign | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function remove() {
    if (!user || !cancel) return;
    setBusy(true);
    try {
      await transitionNotificationCampaign(cancel.id, "cancelled", user);
      setCancel(null);
      toast.success("Notification cancelled");
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  const rows = campaigns.filter(
    (c) =>
      filter === "all" ||
      (filter === "scheduled"
        ? ["scheduled", "sending"].includes(c.status)
        : c.status === filter),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold">Your notifications</h2>
        <select
          aria-label="Filter notifications"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All notifications</option>
          <option value="scheduled">Upcoming</option>
          <option value="draft">Drafts</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      {!rows.length && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">
            {campaigns.length
              ? "No notifications in this view"
              : "Your notifications will appear here"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {campaigns.length
              ? "Choose another filter."
              : "Use New notification to write your first message."}
          </p>
        </div>
      )}
      {rows.map((c) => (
        <div key={c.id} className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words font-medium">
                  {c.title[c.sourceLocale] ||
                    c.title.en ||
                    "Untitled notification"}
                </h3>
                <Badge
                  variant={
                    c.status === "sent"
                      ? "success"
                      : c.status === "failed"
                        ? "destructive"
                        : "muted"
                  }
                >
                  {c.status === "scheduled" && !c.scheduledAt
                    ? "Queued"
                    : c.status[0].toUpperCase() + c.status.slice(1)}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {c.body[c.sourceLocale] || c.body.en}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {audienceSummary(c.audience)}
                {c.scheduledAt
                  ? ` · ${formatDateTime(c.scheduledAt)}`
                  : c.status === "scheduled"
                    ? " · Delivery begins shortly"
                    : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {canEditCampaign(c.status) && (
                <Button size="sm" variant="outline" onClick={() => edit(c)}>
                  Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => duplicate(c)}>
                <Copy />
                {["draft", "scheduled"].includes(c.status)
                  ? "Copy"
                  : "Send again"}
              </Button>
              {["scheduled", "sending"].includes(c.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setCancel(c)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
          {c.status !== "draft" && (
            <details className="mt-4 border-t pt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Delivery details
              </summary>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                {STAT_KEYS.map((k) => (
                  <span key={k} className="capitalize">
                    {k}: <strong>{c.stats[k].toLocaleString()}</strong>
                  </span>
                ))}
              </div>
              {c.lastError && (
                <p className="mt-3 text-xs text-destructive">{c.lastError}</p>
              )}
            </details>
          )}
        </div>
      ))}
      <Dialog
        open={!!cancel}
        onOpenChange={(open) => !open && !busy && setCancel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this notification?</DialogTitle>
            <DialogDescription>
              {cancel?.status === "sending"
                ? "Some people may already have received it. Remaining delivery will stop."
                : "This notification will no longer be sent."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCancel(null)}
            >
              Keep notification
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy && <Loader2 className="animate-spin" />}Cancel notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
            Allow notifications
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pause or resume scheduled messages and automatic reminders.
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
        <div className="max-w-sm">
          <Field
            label="Daily limit per person"
            hint="Maximum notifications in 24 hours"
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
        </div>
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm">
            Advanced settings
          </summary>
          <div className="mt-4 space-y-4">
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
                setRecipients(
                  parseUids(`${recipients}\n${user.uid}`).join("\n"),
                )
              }
            >
              Add me
            </Button>
          </div>
        </details>
        {errors.length > 0 && (
          <p className="text-sm text-destructive">{errors[0]}</p>
        )}
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
              Automated reminders and scheduled notifications can now be sent by
              the backend. Check upcoming notifications before enabling.
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
      ? `Notification · ${log.campaignId}`
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
          label="Notification"
          value={campaignId}
          onChange={(v) => {
            setCampaignId(v);
            setTemplateId("");
          }}
          options={{
            "": "All notifications",
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

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentEditor, Field, Picker } from "./content-editor";
import { TestNotificationButton } from "./test-notification-button";
import { useAuth } from "@/hooks/use-auth";
import {
  LANGUAGE_NAMES,
  LOCALES,
  PLANS,
  audienceSummary,
  campaignErrors,
  canEditCampaign,
  parseUids,
  renderNotificationVariables,
  sendContentErrors,
  type Audience,
  type NotificationCampaign,
  type NotificationSettings,
} from "@/lib/notifications";
import {
  notificationError,
  previewAudience,
  saveNotificationCampaign,
  type AudienceCount,
} from "@/services/notifications";
import { cn } from "@/lib/utils";

function dateInput(date: Date | null) {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function CampaignEditor({
  initial,
  liveCampaign,
  settings,
  settingsReady,
  getToken,
  onClose,
  onSettings,
}: {
  initial: NotificationCampaign;
  liveCampaign?: NotificationCampaign;
  settings: NotificationSettings;
  settingsReady: boolean;
  getToken: () => Promise<string>;
  onClose: () => void;
  onSettings: () => void;
}) {
  const { user } = useAuth();
  const [value, setValue] = React.useState({
    ...initial,
    channel: "product_updates" as const,
  });
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [count, setCount] = React.useState<AudienceCount | null>(null);
  const [uids, setUids] = React.useState(
    initial.audience.uids?.join("\n") ?? "",
  );
  const [timing, setTiming] = React.useState(
    initial.scheduledAt ? "later" : "now",
  );
  const [time, setTime] = React.useState(dateInput(initial.scheduledAt));
  const [plan, setPlan] = React.useState("");
  const [date, setDate] = React.useState("");
  const hasPlan = LOCALES.some((l) =>
    (value.title[l] + value.body[l]).includes("{planName}"),
  );
  const hasDate = LOCALES.some((l) =>
    (value.title[l] + value.body[l]).includes("{date}"),
  );
  const locked =
    !!initial.id && (!liveCampaign || !canEditCampaign(liveCampaign.status));
  const content = renderNotificationVariables(value, plan, date);
  const notification = {
    ...value,
    ...content,
    scheduledAt: timing === "later" && time ? new Date(time) : null,
  };
  const audienceChoice =
    value.audience.kind === "uids" &&
    value.audience.uids?.length === 1 &&
    value.audience.uids[0] === user?.uid
      ? "me"
      : value.audience.kind;
  function audience(kind: string) {
    setError("");
    const next: Audience =
      kind === "me"
        ? { kind: "uids", uids: user ? [user.uid] : [] }
        : {
            kind: kind as Audience["kind"],
            ...(kind === "plans"
              ? { plans: [] }
              : kind === "uids"
                ? { uids: parseUids(uids) }
                : {}),
          };
    setValue((v) => ({ ...v, audience: next }));
  }
  function messageError() {
    if ((hasPlan && !plan) || (hasDate && !date))
      return "Choose the plan and date to use in this message.";
    return sendContentErrors(content)[0] ?? "";
  }
  async function next() {
    setError("");
    if (step === 0) {
      const error = messageError();
      if (error) {
        setError(error);
        return;
      }
      setStep(1);
      return;
    }
    const errors = [
      ...campaignErrors(notification, true),
      ...(timing === "later" && !time
        ? ["Choose when to send this notification."]
        : []),
    ];
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    if (locked) {
      setError(
        "This notification is already being delivered. Use Send again from your history.",
      );
      return;
    }
    if (!settingsReady) {
      setError("Notification settings are still loading. Try again shortly.");
      return;
    }
    if (!settings.enabled) {
      setError("Sending is paused. Turn it on in Settings to continue.");
      return;
    }
    setBusy(true);
    try {
      const result = await previewAudience(
        await getToken(),
        notification.audience,
      );
      if (!result.reachable) {
        setError(
          "No registered phones match these recipients. Choose another group.",
        );
        return;
      }
      setCount(result);
      setStep(2);
    } catch (e) {
      setError(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(status: "draft" | "scheduled") {
    if (!user || busy || locked) return;
    setError("");
    const errors = campaignErrors(notification, status === "scheduled");
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    if (status === "scheduled" && step !== 2) return;
    setBusy(true);
    try {
      await saveNotificationCampaign(notification, status, user);
      toast.success(
        status === "draft"
          ? "Draft saved"
          : timing === "later"
            ? "Notification scheduled"
            : "Notification queued",
        {
          description:
            status === "scheduled" && timing === "now"
              ? "Delivery will begin within 10 minutes."
              : undefined,
        },
      );
      onClose();
    } catch (e) {
      setError(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !translating && onClose()}
    >
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>
            {initial.id ? "Edit notification" : "New notification"}
          </DialogTitle>
          <DialogDescription>
            {
              [
                "Write your message.",
                "Choose who receives it and when.",
                "Check the details, then send.",
              ][step]
            }
          </DialogDescription>
          <nav aria-label="Notification steps" className="flex gap-5 pt-4">
            {["Message", "Recipients & time", "Review"].map((name, i) => (
              <span
                key={name}
                aria-current={step === i ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  step === i
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    step === i &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {name}
              </span>
            ))}
          </nav>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <fieldset disabled={busy || locked} className="space-y-6">
            {step === 0 && (
              <>
                <ContentEditor
                  value={value}
                  onChange={setValue}
                  getToken={getToken}
                  onBusyChange={setTranslating}
                  previewContent={content}
                />
                {(hasPlan || hasDate) && (
                  <div className="max-w-xl space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-medium">Fill in this message</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {hasPlan && (
                        <Picker
                          label="Plan name"
                          value={plan}
                          options={{
                            "": "Choose a plan",
                            "Live Weather": "Live Weather",
                            "Live Weather Plus": "Live Weather Plus",
                          }}
                          onChange={setPlan}
                        />
                      )}
                      {hasDate && (
                        <Field label="Date">
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {step === 1 && (
              <div className="mx-auto max-w-xl space-y-6">
                <Picker
                  label="Send to"
                  value={audienceChoice}
                  onChange={audience}
                  options={{
                    all: "Everyone",
                    me: "Only me",
                    plans: "People on a plan",
                    lapsedOnly: "People whose plan expired",
                    uids: "Selected accounts",
                  }}
                />
                {value.audience.kind === "plans" && (
                  <div className="flex flex-wrap gap-3">
                    {PLANS.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={value.audience.plans?.includes(p) ?? false}
                          onChange={(e) =>
                            setValue((v) => ({
                              ...v,
                              audience: {
                                ...v.audience,
                                plans: e.target.checked
                                  ? [...(v.audience.plans ?? []), p]
                                  : v.audience.plans?.filter((x) => x !== p),
                              },
                            }))
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
                )}
                {value.audience.kind === "uids" && audienceChoice !== "me" && (
                  <Field
                    label="Account IDs"
                    hint="One per line. You can copy these from the Users page."
                  >
                    <Textarea
                      rows={3}
                      value={uids}
                      onChange={(e) => {
                        setUids(e.target.value);
                        setValue((v) => ({
                          ...v,
                          audience: {
                            ...v.audience,
                            uids: parseUids(e.target.value),
                          },
                        }));
                      }}
                    />
                  </Field>
                )}
                <div className="space-y-3">
                  <p className="text-sm font-medium">When</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["now", "Send now"],
                      ["later", "Schedule"],
                    ].map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        aria-pressed={timing === key}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm",
                          timing === key &&
                            "border-primary bg-primary/5 font-medium",
                        )}
                        onClick={() => setTiming(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {timing === "later" && (
                    <Field
                      label="Date & time"
                      hint={`Your time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                    >
                      <Input
                        type="datetime-local"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </Field>
                  )}
                </div>
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm">
                    Filter by app language{" "}
                    <span className="text-muted-foreground">Optional</span>
                  </summary>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {LOCALES.map((l) => (
                      <label
                        key={l}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={value.audience.locales?.includes(l) ?? false}
                          onChange={(e) =>
                            setValue((v) => {
                              const locales = e.target.checked
                                ? [...(v.audience.locales ?? []), l]
                                : (v.audience.locales ?? []).filter(
                                    (x) => x !== l,
                                  );
                              const { locales: _old, ...base } = v.audience;
                              return {
                                ...v,
                                audience: {
                                  ...base,
                                  ...(locales.length ? { locales } : {}),
                                },
                              };
                            })
                          }
                        />
                        {LANGUAGE_NAMES[l]}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            )}
            {step === 2 && (
              <div className="mx-auto max-w-xl space-y-6">
                <div className="rounded-2xl border bg-muted/20 p-5">
                  <p className="text-lg font-semibold">
                    {content.title[value.sourceLocale]}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {content.body[value.sourceLocale]}
                  </p>
                </div>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Recipients</dt>
                    <dd className="text-right font-medium">
                      {audienceChoice === "me"
                        ? "Only me"
                        : audienceSummary(value.audience)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Can receive it</dt>
                    <dd className="font-medium">
                      {count?.reachable.toLocaleString()} accounts
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">When</dt>
                    <dd className="text-right font-medium">
                      {notification.scheduledAt
                        ? notification.scheduledAt.toLocaleString()
                        : "Now · delivery starts within 10 minutes"}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your quiet hours and daily limit settings apply to this
                  delivery.
                </p>
              </div>
            )}
          </fieldset>
        </div>
        <div className="shrink-0 border-t bg-background px-6 py-4">
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 text-sm text-destructive"
            >
              <span>{error}</span>
              {!settings.enabled && step > 0 && (
                <Button variant="link" size="sm" onClick={onSettings}>
                  Settings
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {step === 0 ? (
                <TestNotificationButton
                  content={content}
                  getToken={getToken}
                  disabled={busy || translating || locked}
                />
              ) : (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep((s) => s - 1);
                  }}
                >
                  <ArrowLeft />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step === 0 && (
                <Button
                  variant="outline"
                  disabled={busy || translating || locked}
                  onClick={() => void save("draft")}
                >
                  <Save />
                  Save draft
                </Button>
              )}
              <Button
                disabled={busy || translating || locked}
                onClick={() =>
                  step === 2 ? void save("scheduled") : void next()
                }
              >
                {busy ? (
                  <Loader2 className="animate-spin" />
                ) : step === 2 ? (
                  <Send />
                ) : (
                  <ArrowRight />
                )}
                {step === 0
                  ? "Continue"
                  : step === 1
                    ? "Review notification"
                    : timing === "later"
                      ? "Schedule notification"
                      : "Send notification"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

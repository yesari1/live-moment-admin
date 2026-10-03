import * as React from "react";
import { Loader2, Save, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContentEditor,
  Field,
  Notice,
  Picker,
} from "@/components/notifications/content-editor";
import { useAuth } from "@/hooks/use-auth";
import {
  LANGUAGE_NAMES,
  LOCALES,
  PLANS,
  audienceErrors,
  audienceSummary,
  campaignErrors,
  canEditCampaign,
  contentErrors,
  contentFingerprint,
  parseUids,
  type Audience,
  type NotificationCampaign,
  type NotificationSettings,
} from "@/lib/notifications";
import {
  notificationError,
  previewAudience,
  saveNotificationCampaign,
  sendNotificationTest,
  type AudienceCount,
  type TestResult,
} from "@/services/notifications";

const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
function dateInput(date: Date | null): string {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function CampaignEditor({
  initial,
  liveCampaign,
  settings,
  settingsReady,
  getToken,
  testedContent,
  onClose,
  onSettings,
}: {
  initial: NotificationCampaign;
  liveCampaign?: NotificationCampaign;
  settings: NotificationSettings;
  settingsReady: boolean;
  getToken: () => Promise<string>;
  testedContent: Set<string>;
  onClose: () => void;
  onSettings: () => void;
}) {
  const { user } = useAuth();
  const [value, setValue] = React.useState({
    ...initial,
    channel: "product_updates" as const,
  });
  const [uids, setUids] = React.useState(
    initial.audience.uids?.join("\n") ?? "",
  );
  const [scheduledTime, setScheduledTime] = React.useState(
    dateInput(initial.scheduledAt),
  );
  const [timing, setTiming] = React.useState(
    initial.scheduledAt ? "later" : "now",
  );
  const [busy, setBusy] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [count, setCount] = React.useState<AudienceCount | null>(null);
  const [countError, setCountError] = React.useState("");
  const [countLoading, setCountLoading] = React.useState(false);
  const [target, setTarget] = React.useState<"self" | "testRecipients">("self");
  const [results, setResults] = React.useState<TestResult["results"]>([]);
  const [confirmed, setConfirmed] = React.useState<{
    campaign: NotificationCampaign;
    count: AudienceCount;
  } | null>(null);
  const [typed, setTyped] = React.useState("");
  const [testVersion, setTestVersion] = React.useState(0);
  const audienceKey = JSON.stringify(value.audience);
  const locked =
    !!initial.id && (!liveCampaign || !canEditCampaign(liveCampaign.status));
  const scheduleDate =
    timing === "later" && scheduledTime ? new Date(scheduledTime) : null;
  const campaign = { ...value, scheduledAt: scheduleDate };
  const errors = [
    ...campaignErrors(campaign, true),
    ...(timing === "later" && !scheduledTime
      ? ["Choose a future date and time."]
      : []),
  ];
  const tested = React.useMemo(
    () => testedContent.has(contentFingerprint(value)),
    [value, testedContent, testVersion],
  );
  const blockedAll = value.audience.kind === "all" && !tested;
  const contentInvalid = contentErrors(value, true).length > 0;
  const readyToSend =
    !busy &&
    !translating &&
    !locked &&
    settingsReady &&
    settings.enabled &&
    !blockedAll &&
    errors.length === 0;

  React.useEffect(() => {
    setCount(null);
    setCountError("");
    const audience = JSON.parse(audienceKey) as Audience;
    if (audienceErrors(audience).length) {
      setCountLoading(false);
      return;
    }
    setCountLoading(true);
    const controller = new AbortController();
    let stale = false;
    const timer = setTimeout(() => {
      getToken()
        .then((token) => previewAudience(token, audience, controller.signal))
        .then((result) => {
          if (!stale) setCount(result);
        })
        .catch((e) => {
          if (!stale) setCountError(notificationError(e));
        })
        .finally(() => {
          if (!stale) setCountLoading(false);
        });
    }, 500);
    return () => {
      stale = true;
      clearTimeout(timer);
      controller.abort();
    };
    // The serialized audience is the request identity; token function changes must not restart scans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey]);
  function changeAudience(audience: Audience) {
    setValue((v) => ({ ...v, audience }));
  }
  async function test() {
    setBusy(true);
    setResults([]);
    const fingerprint = contentFingerprint(value);
    try {
      const result = await sendNotificationTest(await getToken(), {
        content: value,
        target,
      });
      setResults(result.results);
      if (result.results.some((r) => r.outcome === "sent")) {
        testedContent.add(fingerprint);
        setTestVersion((v) => v + 1);
        toast.success("Test sent", {
          description: "Check the receiving device before scheduling.",
        });
      }
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function draft() {
    if (!user) return;
    setBusy(true);
    try {
      await saveNotificationCampaign(campaign, "draft", user);
      toast.success("Campaign saved as draft");
      onClose();
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (!readyToSend) return;
    setBusy(true);
    setCountError("");
    try {
      // Always obtain a fresh count immediately before presenting the send confirmation.
      const result = await previewAudience(await getToken(), campaign.audience);
      setCount(result);
      if (!result.reachable)
        throw new Error(
          "No matching accounts have a registered device. Adjust the audience before scheduling.",
        );
      setTyped("");
      setConfirmed({ campaign, count: result });
    } catch (e) {
      setCountError(notificationError(e));
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function schedule() {
    if (!confirmed || !user || !settingsReady || !settings.enabled || locked)
      return;
    if (
      confirmed.campaign.audience.kind === "all" &&
      (typed !== "SEND" ||
        !testedContent.has(contentFingerprint(confirmed.campaign)))
    )
      return;
    setBusy(true);
    try {
      await saveNotificationCampaign(confirmed.campaign, "scheduled", user);
      toast.success("Campaign scheduled", {
        description: confirmed.campaign.scheduledAt
          ? "The dispatcher will send it after the scheduled time."
          : "Delivery starts on the next dispatcher run, within 10 minutes.",
      });
      onClose();
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  const draftErrors = campaignErrors(campaign, false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !translating && !confirmed) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial.id ? "Edit campaign" : "Create campaign"}
          </DialogTitle>
          <DialogDescription>
            Compose, translate and test your message before sending.{" "}
            <span className="ml-1 rounded-md border px-2 py-0.5 text-xs">
              product_updates
            </span>
          </DialogDescription>
        </DialogHeader>
        {locked && (
          <Notice danger>
            This campaign is now {liveCampaign?.status ?? "unavailable"}. Close
            the editor and use Duplicate to create a new draft.
          </Notice>
        )}
        <fieldset
          disabled={busy || locked || !!confirmed}
          className="space-y-6"
        >
          <ContentEditor
            value={value}
            onChange={setValue}
            getToken={getToken}
            onBusyChange={setTranslating}
          />
          <fieldset
            disabled={translating}
            className="space-y-4 rounded-xl border bg-muted/10 p-5"
          >
            <h3 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Audience
            </h3>
            <Picker
              label="Who should receive this?"
              value={value.audience.kind}
              onChange={(kind) =>
                changeAudience({
                  kind: kind as Audience["kind"],
                  ...(kind === "plans"
                    ? { plans: [] }
                    : kind === "uids"
                      ? { uids: parseUids(uids) }
                      : {}),
                  ...(value.audience.locales?.length
                    ? { locales: value.audience.locales }
                    : {}),
                })
              }
              options={{
                all: "All accounts",
                plans: "By plan",
                lapsedOnly: "Lapsed subscribers only",
                uids: "Specific account UIDs",
              }}
            />
            {value.audience.kind === "plans" && (
              <div className="flex flex-wrap gap-2">
                {PLANS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={value.audience.plans?.includes(p) ?? false}
                      onChange={(e) =>
                        changeAudience({
                          ...value.audience,
                          plans: e.target.checked
                            ? [...(value.audience.plans ?? []), p]
                            : value.audience.plans?.filter((x) => x !== p),
                        })
                      }
                    />
                    {p.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            )}
            {value.audience.kind === "uids" && (
              <Field
                label="Account UIDs"
                hint="Up to 1,000 · one UID per line, comma or space"
              >
                <Textarea
                  rows={3}
                  value={uids}
                  onChange={(e) => {
                    setUids(e.target.value);
                    changeAudience({
                      ...value.audience,
                      uids: parseUids(e.target.value),
                    });
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!user) return;
                    const next = parseUids(`${uids}\n${user.uid}`);
                    setUids(next.join("\n"));
                    changeAudience({ ...value.audience, uids: next });
                  }}
                >
                  Add me
                </Button>
              </Field>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Device language filter{" "}
                <span className="font-normal text-muted-foreground">
                  · optional
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                {LOCALES.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={value.audience.locales?.includes(l) ?? false}
                      onChange={(e) => {
                        const locales = e.target.checked
                          ? [...(value.audience.locales ?? []), l]
                          : (value.audience.locales?.filter((x) => x !== l) ??
                            []);
                        const { locales: _old, ...base } = value.audience;
                        changeAudience({
                          ...base,
                          ...(locales.length ? { locales } : {}),
                        });
                      }}
                    />
                    {LANGUAGE_NAMES[l]}
                  </label>
                ))}
              </div>
            </div>
            {audienceErrors(value.audience).length > 0 ? (
              <Notice danger>
                {audienceErrors(value.audience).join(" · ")}
              </Notice>
            ) : countLoading ? (
              <Notice>
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Counting reachable accounts…
                </span>
              </Notice>
            ) : (
              count && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-2xl font-semibold tabular-nums text-primary">
                    {count.reachable.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-foreground">
                      can receive this
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {count.users.toLocaleString()} accounts match the audience
                  </p>
                </div>
              )
            )}
            {countError && <Notice danger>{countError}</Notice>}
          </fieldset>
          <fieldset
            disabled={translating}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Picker
              label="Delivery time"
              value={timing}
              onChange={setTiming}
              options={{
                now: "Send now (next run, ≤ 10 min)",
                later: "Schedule for later",
              }}
            />
            {timing === "later" && (
              <Field
                label={`Date and time · ${LOCAL_TIMEZONE}`}
                hint={
                  scheduleDate && Number.isFinite(scheduleDate.getTime())
                    ? `UTC: ${scheduleDate.toISOString()}`
                    : "Choose a time in your browser’s local time zone"
                }
              >
                <Input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </Field>
            )}
          </fieldset>
          <Notice>
            Daily cap: {settings.maxPerUserPerDay} per rolling 24 hours. Capped
            accounts and accounts without devices are skipped.
            {settings.quietHours
              ? ` Quiet hours (${settings.quietHours.start}–${settings.quietHours.end}, user’s local time) defer delivery.`
              : " Quiet hours are off."}
          </Notice>
          {!settingsReady || !settings.enabled ? (
            <Notice danger>
              Send / Schedule is disabled because{" "}
              {settingsReady
                ? "global notifications are paused"
                : "notification settings have not loaded"}
              .{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={onSettings}
              >
                Open Settings
              </button>
            </Notice>
          ) : null}
          {blockedAll && (
            <Notice>
              Before sending to all accounts, send a successful test for this
              exact content in this session. Changing the message, image or
              destination requires a new test.
            </Notice>
          )}
          {errors.length > 0 && <Notice danger>{errors.join(" · ")}</Notice>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <Picker
                label="Send test to"
                value={target}
                onChange={(v) => setTarget(v as typeof target)}
                disabled={translating}
                options={{
                  self: "My devices",
                  testRecipients: "Saved test recipients",
                }}
              />
            </div>
            <Button
              variant="outline"
              disabled={
                busy ||
                translating ||
                locked ||
                contentInvalid ||
                (target === "testRecipients" && !settings.testRecipients.length)
              }
              onClick={() => void test()}
            >
              <Send />
              Send test
            </Button>
            {tested && <Badge variant="success">This content was tested</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Tests ignore global delivery, quiet hours and the daily cap. They
            use the receiving device’s app language.
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <Notice key={`${r.uid}-${i}`} danger={r.outcome !== "sent"}>
                {r.uid} · {r.outcome}
                {r.outcome === "no_devices" && (
                  <p>
                    Open Live Moment on this account’s phone and allow
                    notifications to register a device.
                  </p>
                )}
              </Notice>
            ))}
          </div>
        </fieldset>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy || translating || !!confirmed}
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant="outline"
            disabled={
              busy ||
              translating ||
              locked ||
              !!confirmed ||
              draftErrors.length > 0
            }
            onClick={() => void draft()}
          >
            <Save />
            Save as draft
          </Button>
          <Button
            disabled={!readyToSend || countLoading || !!confirmed}
            onClick={() => void prepare()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            {timing === "now" ? "Review & send" : "Review & schedule"}
          </Button>
        </DialogFooter>
        <Dialog
          open={!!confirmed}
          onOpenChange={(open) => !open && !busy && setConfirmed(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {timing === "now"
                  ? "Send this campaign?"
                  : "Schedule this campaign?"}
              </DialogTitle>
              <DialogDescription>
                Send to {confirmed?.count.reachable.toLocaleString()} devices’
                owners ({confirmed?.count.users.toLocaleString()} match the
                audience).{" "}
                {confirmed && audienceSummary(confirmed.campaign.audience)}
              </DialogDescription>
            </DialogHeader>
            <Notice>
              {confirmed?.campaign.scheduledAt
                ? `Scheduled: ${confirmed.campaign.scheduledAt.toLocaleString()} (${LOCAL_TIMEZONE}) · UTC ${confirmed.campaign.scheduledAt.toISOString()}`
                : "The backend begins delivery on its next run, within 10 minutes."}{" "}
              Quiet hours can defer delivery; the daily cap can skip accounts.
            </Notice>
            {confirmed?.campaign.audience.kind === "all" && (
              <Field label="Type SEND to confirm delivery to all accounts">
                <Input
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="SEND"
                />
              </Field>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmed(null)}
              >
                Back to editing
              </Button>
              <Button
                disabled={
                  busy ||
                  locked ||
                  !settingsReady ||
                  !settings.enabled ||
                  (confirmed?.campaign.audience.kind === "all" &&
                    typed !== "SEND")
                }
                onClick={() => void schedule()}
              >
                {busy && <Loader2 className="animate-spin" />}Confirm{" "}
                {timing === "now" ? "send" : "schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

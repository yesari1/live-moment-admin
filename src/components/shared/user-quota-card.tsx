import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useAuth } from "@/hooks/use-auth";
import { PLAN_LABELS } from "@/data/plans";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  parseQuotaGrant,
  QUOTA_FIELDS,
  quotaErrorMessage,
  quotaGrantSummary,
  validQuotaReason,
} from "@/lib/quota";
import {
  BackendError,
  backendAdjustQuota,
  backendGetQuota,
  type QuotaAdjustment,
  type QuotaOverview,
} from "@/services/backend";
import type { AdminUser } from "@/types";
import { isInReportingPeriod } from "@/lib/reporting";

const LABELS = {
  images: "Images",
  motions: "Motions",
  regenerations: "Regenerations",
};
const EMPTY_INPUTS = { images: "0", motions: "0", regenerations: "0" };

export function UserQuotaCard({
  uid,
  users,
}: {
  uid: string;
  users: AdminUser[];
}) {
  const { getIdToken, demoMode } = useAuth();
  const [overview, setOverview] = React.useState<QuotaOverview | null>(null);
  const [loading, setLoading] = React.useState(!demoMode);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [inputs, setInputs] = React.useState(EMPTY_INPUTS);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState<QuotaAdjustment | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const busy = React.useRef(false);
  const loadSequence = React.useRef(0);
  const inputId = React.useId();
  const grant = parseQuotaGrant(inputs);
  const reasonValid = validQuotaReason(reason);

  const token = React.useCallback(async () => {
    const value = await getIdToken();
    if (!value) throw new BackendError("Sign in again.", 401, "AUTH_REQUIRED");
    return value;
  }, [getIdToken]);

  const refresh = React.useCallback(async () => {
    if (demoMode || busy.current) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await backendGetQuota(uid, await token());
      if (loadSequence.current === sequence) setOverview(data);
    } catch (error) {
      if (loadSequence.current === sequence)
        setLoadError(quotaErrorMessage(error));
    } finally {
      if (loadSequence.current === sequence) setLoading(false);
    }
  }, [uid, token, demoMode]);

  React.useEffect(() => {
    void refresh();
    return () => {
      ++loadSequence.current;
    };
  }, [refresh]);

  const submit = async (action: "grant" | "reset") => {
    if (busy.current || loading || !overview || demoMode) return;
    if (!pending && (!reasonValid || (action === "grant" && !grant))) return;
    const adjustment: QuotaAdjustment =
      pending ??
      (action === "grant"
        ? {
            action,
            ...grant!,
            reason: reason.trim(),
            requestId: crypto.randomUUID(),
          }
        : { action, reason: reason.trim(), requestId: crypto.randomUUID() });
    busy.current = true;
    setSaving(true);
    setPending(adjustment);
    setActionError(null);
    setSuccess(null);
    try {
      const result = await backendAdjustQuota(uid, await token(), adjustment);
      setOverview(result.overview);
      setLoadError(null);
      setSuccess(
        `${adjustment.action === "grant" ? `Granted ${quotaGrantSummary(adjustment)}` : "Reset this cycle's usage; admin grants kept."}${result.replayed ? " (Already applied; no duplicate change.)" : ""}`,
      );
      setPending(null);
      setInputs(EMPTY_INPUTS);
      setReason("");
      setConfirmReset(false);
    } catch (error) {
      setActionError(quotaErrorMessage(error));
      // A definitive rejection did not apply anything. Unknown/network/server
      // failures retain the exact payload and requestId for a safe retry.
      if (
        error instanceof BackendError &&
        error.status >= 400 &&
        error.status < 500
      )
        setPending(null);
      setConfirmReset(false);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const locked = saving || pending !== null;
  const history = [...(overview?.history ?? [])]
    .filter((entry) => isInReportingPeriod(entry.createdAtEpochMs))
    .sort((a, b) => b.createdAtEpochMs - a.createdAtEpochMs);
  const earlierGrants =
    overview?.plan === "free" &&
    (overview?.history ?? []).some(
      (entry) =>
        entry.action === "grant" && entry.cycleKey !== overview.cycleKey,
    );

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">Quota</CardTitle>
          {overview && (
            <p className="break-all text-xs text-muted-foreground">
              {PLAN_LABELS[overview.plan as keyof typeof PLAN_LABELS] ??
                overview.plan}{" "}
              ·{" "}
              {overview.cycle === "lifetime"
                ? "lifetime"
                : `${overview.cycle === "billing_period" ? "period" : "month"} ${overview.cycleKey.replace(/^(period|month):/, "")}`}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || saving || demoMode}
          onClick={() => void refresh()}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />{" "}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Current entitlement balance and billing-cycle usage. Reporting starts
          on 12 Oct; it does not reset purchased credits or quota limits.
        </p>
        {demoMode && (
          <p className="text-sm text-muted-foreground">
            Quota adjustments require a live backend session and are unavailable
            in demo mode.
          </p>
        )}
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading quota…
          </p>
        )}
        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        )}
        {overview && (
          <>
            <div className="space-y-3" aria-busy={loading}>
              {QUOTA_FIELDS.map((field) => {
                const used = overview.used[field];
                const limit = overview.effectiveLimits[field];
                const atLimit = used >= limit;
                const percent =
                  limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
                return (
                  <div key={field} className="space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span>{LABELS[field]}</span>
                      <span className="tabular-nums">
                        {used} / {limit}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${LABELS[field]} usage`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      aria-valuetext={`${used} used out of ${limit}`}
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          "h-full",
                          atLimit ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    {overview.adminGrant[field] > 0 && (
                      <p className="text-xs text-muted-foreground">
                        plan {overview.planLimits[field]} + admin{" "}
                        {overview.adminGrant[field]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Standalone wallpaper credits granted:{" "}
                {overview.standaloneWallpapersGranted} (separate from quota).
              </p>
              <p>
                Free preview used: {overview.freePreviewUsed ? "Yes" : "No"}.
              </p>
              <p>
                {overview.cycle === "lifetime"
                  ? "Grants last for this lifetime cycle."
                  : "Grants apply only to this billing cycle and expire when it changes."}{" "}
                The daily creation limit is separate.
              </p>
              {earlierGrants && (
                <p className="text-warning">
                  This account is now Free. Grants from earlier paid cycles no
                  longer apply.
                </p>
              )}
            </div>
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit("grant");
              }}
            >
              <h4 className="text-sm font-medium">+ Grant</h4>
              <fieldset
                disabled={locked || loading || !!loadError}
                className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {QUOTA_FIELDS.map((field) => (
                  <div key={field} className="min-w-0 space-y-1">
                    <Label htmlFor={`${inputId}-${field}`}>
                      {LABELS[field]}
                    </Label>
                    <Input
                      id={`${inputId}-${field}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      required
                      value={inputs[field]}
                      onChange={(event) =>
                        setInputs((value) => ({
                          ...value,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </fieldset>
              <div className="space-y-1">
                <Label htmlFor={`${inputId}-reason`}>Reason (required)</Label>
                <Textarea
                  id={`${inputId}-reason`}
                  required
                  minLength={3}
                  maxLength={500}
                  disabled={locked}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby={`${inputId}-reason-help`}
                />
                <p
                  id={`${inputId}-reason-help`}
                  className="text-xs text-muted-foreground"
                >
                  {reason.trim().length} / 500 characters · minimum 3. Used for
                  grants and resets.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    locked || loading || !!loadError || !grant || !reasonValid
                  }
                >
                  {saving ? "Working…" : "Grant"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={locked || loading || !!loadError || !reasonValid}
                  onClick={() => setConfirmReset(true)}
                >
                  Reset this cycle
                </Button>
              </div>
            </form>
            {success && (
              <p role="status" className="text-sm text-success">
                {success}
              </p>
            )}
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            {pending && !saving && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  The result is uncertain. Retry the saved {pending.action} with
                  the same request ID to avoid applying it twice.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void submit(pending.action)}
                >
                  Retry {pending.action}
                </Button>
              </div>
            )}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium">History</h4>
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No quota changes yet.
                </p>
              )}
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="space-y-1 rounded-md border p-3 text-xs"
                >
                  <p className="font-medium">
                    {entry.action === "reset"
                      ? "Reset"
                      : `Grant ${quotaGrantSummary(entry.delta)}`}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(entry.createdAtEpochMs)}
                    {entry.cycleKey !== overview.cycleKey && " · earlier cycle"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {entry.reason}
                  </p>
                  <p className="break-all text-muted-foreground">
                    Admin:{" "}
                    {users.find((user) => user.uid === entry.adminUid)?.email ??
                      entry.adminUid}
                  </p>
                  <p className="break-all text-muted-foreground">
                    Cycle: {entry.cycleKey}
                  </p>
                </div>
              ))}
            </div>
            <ConfirmActionDialog
              open={confirmReset}
              onOpenChange={(open) => {
                if (!saving) setConfirmReset(open);
              }}
              title="Reset this cycle's usage?"
              destructive
              confirmLabel="Reset usage"
              loading={saving}
              onConfirm={() => submit("reset")}
              description={
                <div className="space-y-2">
                  <p>
                    This zeroes {overview.used.images} images,{" "}
                    {overview.used.motions} motions and{" "}
                    {overview.used.regenerations} regenerations used in the
                    current cycle, plus the daily creation count and per-image
                    regeneration markers. Admin grants stay.
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    Reason: {reason.trim()}
                  </p>
                  <p>The change is audited on the server.</p>
                </div>
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

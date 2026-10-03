import * as React from "react";
import { Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "./content-editor";
import { useAuth } from "@/hooks/use-auth";
import {
  notificationError,
  previewAudience,
  type AudienceCount,
  type TestResult,
} from "@/services/notifications";

export function DeviceStatus({
  getToken,
}: {
  getToken: () => Promise<string>;
}) {
  const { user } = useAuth();
  const [count, setCount] = React.useState<AudienceCount | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    if (!user) return;
    let stale = false;
    const abort = new AbortController();
    setBusy(true);
    setError("");
    getToken()
      .then((token) =>
        previewAudience(
          token,
          { kind: "uids", uids: [user.uid] },
          abort.signal,
        ),
      )
      .then((result) => {
        if (!stale) setCount(result);
      })
      .catch((e) => {
        if (!stale) setError(notificationError(e));
      })
      .finally(() => {
        if (!stale) setBusy(false);
      });
    return () => {
      stale = true;
      abort.abort();
    };
  }, [user?.uid, retry]);
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4" />
          My phone · {user?.email ?? "Current account"}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Check
          again
        </Button>
      </div>
      <p className="break-all font-mono text-xs text-muted-foreground">
        Account UID: {user?.uid}
      </p>
      {busy ? (
        <p className="text-xs text-muted-foreground">
          Checking backend device registration…
        </p>
      ) : error ? (
        <Notice danger>{error}</Notice>
      ) : (
        count &&
        (count.reachable > 0 ? (
          <p className="text-sm text-success">
            This account has a registered device and can receive a test.
          </p>
        ) : (
          <Notice danger>
            The backend has no registered device for this account. Android
            notification permission alone does not register the phone. In Live
            Moment, check that you use the account above, then open Debug Tools
            → Notifications → Register. If registration fails, the app’s “Push
            error” shows why. An app update is required if your version cannot
            register.
          </Notice>
        ))
      )}
    </div>
  );
}
export function TestResults({ results }: { results: TestResult["results"] }) {
  const { user } = useAuth();
  return (
    <div className="space-y-2" aria-live="polite">
      {results.map((r, i) => (
        <Notice key={`${r.uid}-${i}`} danger={r.outcome !== "sent"}>
          <p className="break-all">
            {r.uid === user?.uid ? (user.email ?? "My account") : r.uid} ·{" "}
            {r.outcome}
            {r.devices != null ? ` · ${r.devices} registered devices` : ""}
          </p>
          <p className="mt-1 break-all font-mono text-xs">
            Target UID: {r.uid}
          </p>
          {r.outcome === "no_devices" && (
            <p className="mt-2">
              The test reached the backend, but this account has no registered
              phone. Check the signed-in account and use the registration check
              above; enabling Android notifications is only the first step.
            </p>
          )}
          {r.outcome === "invalid_content" && (
            <p className="mt-2">
              The receiving device could not resolve this content. Check the
              source text and message variables.
            </p>
          )}
        </Notice>
      ))}
    </div>
  );
}

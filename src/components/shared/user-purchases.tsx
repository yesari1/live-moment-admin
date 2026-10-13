import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { isInReportingPeriod } from "@/lib/reporting";
import {
  fetchAllPurchases,
  purchaseLabel,
  summarizePurchases,
} from "@/services/purchases";
import type { AdminUser } from "@/types";

export function UserPurchases({ user }: { user: AdminUser }) {
  const history = useAsyncData(fetchAllPurchases, [], {
    pollIntervalMs: 60_000,
  });
  const [earlier, setEarlier] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const all = (history.data ?? []).filter((p) => p.uid === user.uid);
  const current = all.filter((p) => isInReportingPeriod(p.purchasedAt));
  const older = all.filter((p) => !isInReportingPeriod(p.purchasedAt));
  const visible = earlier ? all : current;
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const activePage = Math.min(page, pages - 1);
  const summary = summarizePurchases(current);
  const hasFutureExpiry = Boolean(
    user.planExpiresAt && user.planExpiresAt > new Date(),
  );
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
        <p className="font-medium">Current subscription</p>
        <p>
          {user.plan === "free"
            ? "No active subscription"
            : user.planProductId
              ? purchaseLabel({ productId: user.planProductId })
              : user.plan === "live_weather_plus"
                ? "LiveWeather Plus"
                : "LiveWeather"}
        </p>
        {user.plan !== "free" && user.planExpiresAt && (
          <p className="text-xs text-muted-foreground">
            {hasFutureExpiry && user.planAutoRenewing === true
              ? "Next renewal"
              : "Paid until / expired"}
            : {formatDateTime(user.planExpiresAt)}
            {user.planAutoRenewing !== null &&
              user.planAutoRenewing !== undefined &&
              ` · Auto-renew ${user.planAutoRenewing ? "on" : "off"}`}
          </p>
        )}
        {user.plan !== "free" && !user.planExpiresAt && (
          <p className="text-xs text-muted-foreground">
            Renewal date is not recorded.
          </p>
        )}
      </div>
      <div>
        <p className="font-medium text-sm">Payments & packages</p>
        <p className="text-xs text-muted-foreground">
          {summary.granted.length} payments · {summary.revenue}
        </p>
      </div>
      {older.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEarlier((value) => !value);
            setPage(0);
          }}
          aria-pressed={earlier}
        >
          {earlier
            ? "Hide older purchases"
            : `Show older purchases (${older.length})`}
        </Button>
      )}
      {history.error ? (
        <ErrorState
          message={history.error}
          onRetry={() => void history.refresh()}
        />
      ) : history.loading ? (
        <p className="text-sm text-muted-foreground">
          Loading payment history…
        </p>
      ) : !visible.length ? (
        <EmptyState
          title="No purchases"
          description="Verified package purchases and subscription renewals will appear here."
          className="border-0"
        />
      ) : (
        <>
          {visible.slice(activePage * 10, activePage * 10 + 10).map((p) => (
            <div key={p.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{purchaseLabel(p)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.type === "subscription"
                      ? p.orderId?.includes("..")
                        ? "Subscription renewal"
                        : "Subscription purchase"
                      : "One-time purchase"}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {p.amount !== null && p.currency
                    ? formatCurrency(p.amount, p.currency)
                    : "Not recorded"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Payment date: {formatDateTime(p.purchasedAt)}
              </p>
              <p className="break-all font-mono text-xs">
                {p.orderId ?? "Order number not recorded"}
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="muted">{p.state}</Badge>
                {p.testPurchase && (
                  <Badge variant="outline">Test payment</Badge>
                )}
              </div>
              {p.type === "subscription" && p.latestOrder && p.expiryTime && (
                <p className="text-xs text-muted-foreground">
                  Subscription paid until: {formatDateTime(p.expiryTime)}
                  {p.autoRenewing !== null &&
                    ` · Auto-renew ${p.autoRenewing ? "on" : "off"}`}
                </p>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Page {activePage + 1} of {pages} · {visible.length} orders
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={activePage === 0}
                onClick={() => setPage(activePage - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={activePage + 1 >= pages}
                onClick={() => setPage(activePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

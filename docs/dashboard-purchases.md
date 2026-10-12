# Launch reporting and purchase history

Reporting starts at `2026-10-12T00:00:00+03:00` (Europe/Istanbul), configured in
`src/lib/reporting.ts`. This is a fixed boundary, not a rolling today-only filter.
Presets and custom ranges cannot include earlier days. The Dashboard defaults to
Today; later dates continue accumulating normally. Daily chart buckets and daily
metrics use Istanbul time.

## Scope

- Purchase reports, generation lists and counts, AI costs, feedback, error logs,
  audit logs, notification history and campaign history exclude earlier activity.
- Registrations count only users created after the boundary. Existing accounts
  remain searchable. Active-user metrics include existing users who are active
  after launch. Account labels still exclude identified test accounts.
- Current paid-member metrics require a real subscription purchase in the
  reporting period. Store test purchases never contribute to sales or revenue.
- Per-user image/video/failure and AI-cost counters are derived from filtered
  event history. Legacy cumulative profile counters are not used as fallbacks.
- Configuration (templates, routing, pricing, plans), existing account identities,
  current entitlement balances and quota limits remain operational. A reporting
  boundary never resets customer rights or deletes records. Quota usage describes
  the actual billing cycle and is explicitly labelled separately from reporting.
- Firestore generation and usage queries apply the cutoff and paginate. Activity
  filtering also applies at the service layer and the analytical boundary.

## Users: Purchases tab

A selected user's Purchases tab displays package names, individual charge dates,
actual gross amounts and currencies, order numbers, states and test markers.
Renewals are separate transactions and history is paginated. Current paid-until,
next-renewal and auto-renew information comes from verified profile fields, with
unknown dates clearly labelled rather than estimated.

Default history starts at launch. Earlier test orders can be opened explicitly
for account support; that optional view never changes global reporting or revenue.
Current subscription state is distinct from historical purchases.

## Google Play storage

The backend saves Google's verified `orderId`, `googlePurchaseTime`, and
`testPurchase` marker. Financial queries run after durable entitlement completion
and on verification/refund notifications. A financial API failure cannot block a
verified grant. Returned token hashes and product IDs must match existing stored
purchases. Raw tokens from order responses and buyer addresses are not persisted.

`billingPurchases/{tokenHash}.orders[orderId]` upserts each order with actual gross
amount/currency, tax, developer revenue, timestamp, state and sync timestamp.
Literal map keys preserve renewals. The existing admin-only Firestore rule covers
this map. The reader paginates by document ID and flattens orders without counting
the parent token again. Legacy records use immutable `firstSeenAt` with
`processedAt` as fallback; completion and re-verification dates are not sale dates.

Revenue uses recorded gross amounts per currency, excluding test, pending,
cancelled, refunded, partially refunded and unknown orders. Partial refunds are
conservatively excluded because remaining charge amounts are not modeled. Missing
amounts make revenue Unavailable; empty periods show No sales. Catalog prices are
never substituted for actual payments. Gross revenue is not net profit.

## Recovery and verification

The mobile backend's `src/tools/backfill-billing-orders.ts` performs metadata-only
recovery using retained tokens, RTDN payloads and optional Play Console order IDs.
It never grants, acknowledges, consumes or refunds. Default mode is read-only;
`--apply` writes metadata after identity checks. Logs contain counts and unresolved
hashes, not tokens. Temporary recovery jobs use the existing billing identity and
are removed after verification.

Automated coverage checks the exact midnight boundary, prelaunch exclusions,
legacy-user preservation, cumulative-counter reset, clamped date filters,
Istanbul chart buckets, renewal dates, currency totals and test-payment exclusion.

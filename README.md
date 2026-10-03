# Live Moment Admin

Internal operations and remote-configuration console for the Live Moment mobile
application. Built with React + TypeScript + Vite.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui components (Radix primitives)
- Recharts (via shadcn chart wrappers)
- TanStack Table
- React Hook Form + Zod
- Sonner toasts
- Lucide icons
- Firebase Web SDK (Auth + Firestore)

Dark mode is the default. The layout is desktop-first and remains usable on
laptop and tablet widths.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/admin/
npm run build      # output: admin/dist
npm run typecheck
```

## Runtime configuration

`public/config.js` is served as-is (not bundled). Edit it after deployment to
point the panel at a different Firebase Web App or backend without rebuilding.

The panel runs in **demo mode** until a Firebase Web `appId` is present in that
file; all screens then render representative sample data. See
`../ADMIN-PANEL-KURULUMU.md` for the full setup, Firestore rules and DNS steps.

## Source layout

```text
src/
  components/ui/        shadcn/ui primitives
  components/layout/    sidebar, header, admin layout
  components/shared/    StatCard, DataTable, StatusBadge, RoutingCard, …
  pages/                Dashboard, Users, Generations, AIRouting, Plans,
                        Templates, AppSettings, Feedback, Logs, Login,
                        AccessDenied
  services/             Firestore repo, backend client, demo store, analytics
  data/                 provider/model registry, plan catalog, routing contexts
  hooks/                auth, theme, async data, model catalog
  lib/                  firebase init, runtime config, formatting
  types/                domain types
```

## Model catalog

The provider/model registry starts from a built-in offline catalog and is
replaced on every page load by the backend-owned Firestore documents:

- `ai_models/{modelId}` — `provider`, `stage` (`image`/`video`), `enabled`,
  `displayName`, `capabilities`
- `pricingConfigs/current` — `modelRates.{modelId}` with `flatUsd`/`usdPerImage`
  (whole-request price) or `usdPerSecond` (price per generated second)

A model registered by the backend, a new Higgsfield model for example, is
selectable under AI Routing after reloading the console, with no redeploy. Both
collections are server-owned: the console reads them and never writes them.
Firestore rules grant admins read access to both.

## Firestore collections read

`users`, `generationJobs`, `generationUsageEvents`, `motionTemplates`,
`ai_routing`, `ai_models`, `plans`, `pricingConfigs`, `feedback`,
`admin_config`, `admin_audit_logs`, `admin_error_logs`.

## Notifications

Open **Notifications → Send Notification** to send a message without creating a
campaign first. **Templates** supports named, reusable manual templates (`manual_*`)
with an **Edit template** and **Send Notification** action. The three plan reminders
remain automatic; manual templates are disabled for automatic triggers. One-off
messages still use the backend delivery queue and appear in campaign history.

Open **Notifications** for plan reminder templates, campaign drafts and scheduling,
global delivery settings, and delivery logs with 7/30-day summaries. The panel uses
`notificationTemplates`, `notificationSettings/global`, `notificationCampaigns`,
and the read-only `notificationLog` collection. Notification rules and the three
seeded templates are managed by the app/backend repository; do not deploy the
older example rules in this repository over the backend's deployed rules.

Compose in Turkish (default), English, or any of the six supported source languages.
Translation fills the other language tabs for review, shows loading and per-language
failures, and asks before replacing edited translations. Save explicitly after
reviewing the previews. Every language must be complete before enabling a template
or scheduling a campaign. Tests arrive in the receiving phone's app language;
tests use the current editor text and can run with only the source language filled.
Reminder tests render sample variables; a real one-off send requires actual plan/date
values. The editor footer always shows send/test actions and explains blockers.
The account device check shows the signed-in email/UID and backend registration
status; phone notification permission alone does not imply device registration.

Campaigns always use `product_updates`. Scheduling fetches a fresh reachable audience
count and asks for confirmation. Sending to all accounts also requires a successful
test for the exact content in this page session and typing `SEND`. Global delivery
must be enabled; test sends bypass global delivery, quiet hours, and the daily cap.
The backend dispatcher starts due campaigns within its next 10-minute run.
Campaigns that have started can be cancelled at the next batch or duplicated, but
cannot be edited. Notification changes append an audit record in the same Firestore
transaction, and backend-owned stats/lease fields are preserved.

After deployment, verify real delivery with your own account UID: translate a short
message, send a test, and schedule a campaign targeting only that UID. Check the
phone, campaign stats, and delivery log after the dispatcher run. Browser previews
and automated tests alone cannot verify FCM/device delivery.

## Security

The browser uses the Firebase Web SDK only for authentication and admin-permitted
Firestore reads/writes. It never contains service-account credentials or AI
provider secrets. Privileged operations (deleting Auth users, purging storage)
run through the trusted backend. Firestore security rules enforce admin
authorization server-side (`firebase/firestore.rules`).

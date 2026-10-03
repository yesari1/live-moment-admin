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

**New notification** opens a three-step flow: message, recipients/time, and review.
Choose **Send now** or a future date. Tests are optional and appear only after pressing
**Send me a test**. A real send always shows a fresh reachable recipient count before
confirmation; global delivery and backend-owned campaign status remain checked in the
Firestore transaction. The backend starts due notifications within its 10-minute run.

**Templates** stores reusable messages. **Use template** opens a new notification;
**Edit** saves the message without sending it. **Automatic reminders** is a separate
section for the three plan triggers. Their plan/date placeholders are filled by the
backend per account and are not offered when composing ordinary notifications.

Write in Turkish, English, or another supported language. Translation has a loading
indicator, preserves current text on per-language failures, and confirms replacement
of existing translations. Untranslated notifications may use just the selected source
language; optional translations must have both a title and message. Enabled automatic
reminders still require all six languages. Initial forms show no missing-field alerts;
validation runs when continuing/saving and shows one actionable error at a time.

History contains drafts, queued/scheduled notifications, and completed deliveries.
Delivery statistics and logs are expandable. Phone registration diagnostics live under
Settings and are shown during a failed test only when requested.

The panel uses `notificationTemplates`, `notificationSettings/global`,
`notificationCampaigns`, and `notificationLog`. Manual templates use `manual_*` IDs and
no automatic trigger. Changes write audit records transactionally and preserve
backend stats/lease fields. Notification rules and seeded templates are owned by the
app/backend repository; do not replace its deployed rules with this repo's old examples.

Browser previews and tests alone cannot verify FCM delivery. Check a real phone using
an account that has registered its device.

## Security

The browser uses the Firebase Web SDK only for authentication and admin-permitted
Firestore reads/writes. It never contains service-account credentials or AI
provider secrets. Privileged operations (deleting Auth users, purging storage)
run through the trusted backend. Firestore security rules enforce admin
authorization server-side (`firebase/firestore.rules`).

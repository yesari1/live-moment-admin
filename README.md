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
                        Templates, AppSettings, Logs, Login, AccessDenied
  services/             Firestore repo, backend client, demo store, analytics
  data/                 provider/model registry, plan catalog, routing contexts
  hooks/                auth, theme, async data
  lib/                  firebase init, runtime config, formatting
  types/                domain types
```

## Security

The browser uses the Firebase Web SDK only for authentication and admin-permitted
Firestore reads/writes. It never contains service-account credentials or AI
provider secrets. Privileged operations (deleting Auth users, purging storage)
run through the trusted backend. Firestore security rules enforce admin
authorization server-side (`firebase/firestore.rules`).

import {
  Activity,
  FileText,
  LayoutDashboard,
  Layers,
  Route,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Live overview of users, generations and cost.",
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    description: "Search, inspect and manage Live Moment accounts.",
  },
  {
    to: "/generations",
    label: "Generations",
    icon: Activity,
    description: "Operational history of every AI generation job.",
  },
  {
    to: "/ai-routing",
    label: "AI Routing",
    icon: Route,
    description: "Remote control of providers and models per context.",
  },
  {
    to: "/plans",
    label: "Plans",
    icon: Wallet,
    description: "Plan behavior, quotas and entitlements.",
  },
  {
    to: "/templates",
    label: "Templates",
    icon: Layers,
    description: "Manage generation templates remotely.",
  },
  {
    to: "/app-settings",
    label: "App Settings",
    icon: Settings2,
    description: "Global remote controls and emergency kill switches.",
  },
  {
    to: "/logs",
    label: "Logs",
    icon: FileText,
    description: "Failures, provider errors and admin audit trail.",
  },
];

export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find(
    (item) => item.to !== "/" && pathname.startsWith(item.to),
  );
}

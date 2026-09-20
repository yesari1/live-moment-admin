import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AdminLayout } from "@/components/layout/admin-layout";
import { FullScreenLoader } from "@/components/shared/full-screen-loader";
import { LoginPage } from "@/pages/Login";
import { AccessDeniedPage } from "@/pages/AccessDenied";
import { DashboardPage } from "@/pages/Dashboard";
import { UsersPage } from "@/pages/Users";
import { GenerationsPage } from "@/pages/Generations";
import { AIRoutingPage } from "@/pages/AIRouting";
import { PlansPage } from "@/pages/Plans";
import { TemplatesPage } from "@/pages/Templates";
import { AppSettingsPage } from "@/pages/AppSettings";
import { LogsPage } from "@/pages/Logs";
import { NotFoundPage } from "@/pages/NotFound";

function ProtectedRoutes() {
  const { status } = useAuth();

  if (status === "loading") return <FullScreenLoader />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "unauthorized") return <AccessDeniedPage />;

  return <AdminLayout />;
}

function AppRoutes() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          status === "authenticated" ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/generations" element={<GenerationsPage />} />
        <Route path="/ai-routing" element={<AIRoutingPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/app-settings" element={<AppSettingsPage />} />
        <Route path="/logs" element={<LogsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { useFarm, useNavigation } from "./api/hooks";
import { MOCK_MODE } from "./api/client";
import { AppShell } from "./components/shell/AppShell";
import { Toaster } from "./components/ui/feedback";
import { ErrorState, Skeleton } from "./components/ui/feedback";
import { AlertsPage } from "./pages/alerts/AlertsPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminLayout, RequireAdmin } from "./pages/admin/AdminLayout";
import { AdminSignIn } from "./pages/admin/AdminSignIn";
import { AdminSignUp } from "./pages/admin/AdminSignUp";
import { AdminFarmer } from "./pages/admin/AdminFarmer";
import { AdminFarmers } from "./pages/admin/AdminFarmers";
import { AdminKeys } from "./pages/admin/AdminKeys";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { SignIn } from "./pages/auth/SignIn";
import { FarmSetup } from "./pages/auth/FarmSetup";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { EnterpriseDetail } from "./pages/enterprise/EnterpriseDetail";
import { EnterpriseList } from "./pages/enterprise/EnterpriseList";
import { MoneyPage } from "./pages/money/MoneyPage";
import { NotFound } from "./pages/NotFound";
import { Onboarding } from "./pages/onboarding/Onboarding";
import { PurchasesPage } from "./pages/purchases/PurchasesPage";
import { SalesPage } from "./pages/sales/SalesPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { StockPage } from "./pages/stock/StockPage";
import { WeatherPage } from "./pages/weather/WeatherPage";
import { useMembership, useSession } from "./stores/session";

function RequireAuth() {
  const refresh = useSession((s) => s.refresh);
  const location = useLocation();
  if (!refresh) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function FullPageLoading() {
  return (
    <div style={{ padding: 32, display: "grid", gap: 16, maxWidth: 720 }} aria-busy="true">
      <Skeleton height={32} width="40%" />
      <Skeleton height={120} />
      <Skeleton height={240} />
    </div>
  );
}

/**
 * Setup runs before the portal: a farm first (7.7), then what it keeps (7.8).
 * Leaving before choosing returns the owner to the choice screen, never an
 * empty dashboard. Invited members join farms whose choices are made.
 */
function RequireSetup() {
  const { farm, isLoading, error, refetch } = useFarm();
  const nav = useNavigation();
  const role = useMembership()?.role;
  // As in useFarm: only the first attempt shows the loading screen. If navigation
  // fails, carry on to the portal rather than loop between loading and the page
  // (every page that mounts would retry it, and each retry reads as "loading").
  const navLoading = nav.isLoading && nav.errorUpdateCount === 0;
  if (isLoading || (farm && navLoading)) return <FullPageLoading />;
  // Couldn't load the farms: say so, rather than send an owner to set up a farm they already have.
  if (!farm && error) return <div style={{ padding: 32, maxWidth: 720 }}><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!farm) return role === "owner" ? <Navigate to="/setup/farm" replace /> : <FullPageLoading />;
  if (nav.data && !nav.data.setup_complete && role === "owner") return <Navigate to="/setup/choose" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignIn /> },
  { path: "/reset-password", element: <ResetPassword /> },
  // Shamba OS staff: a separate sign-in and session (stores/adminSession).
  { path: "/admin/sign-in", element: <AdminSignIn /> },
  // Super admin sign-up: not linked from anywhere, and useless without the server's signup key.
  { path: "/admin/sign-up", element: <AdminSignUp /> },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [{ element: <AdminLayout />, children: [{ index: true, element: <AdminDashboard /> }, { path: "farmers", element: <AdminFarmers /> }, { path: "farmers/:id", element: <AdminFarmer /> }, { path: "keys", element: <AdminKeys /> }] }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/setup/farm", element: <FarmSetup /> },
      { path: "/setup/choose", element: <Onboarding /> },
      {
        element: <RequireSetup />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/", element: <Dashboard /> },
              { path: "/farm", element: <Navigate to="/settings?tab=plots" replace /> },
              { path: "/animals", element: <EnterpriseList module="livestock" /> },
              { path: "/animals/:id", element: <EnterpriseDetail module="livestock" /> },
              { path: "/poultry", element: <EnterpriseList module="batches" /> },
              { path: "/poultry/:id", element: <EnterpriseDetail module="batches" /> },
              { path: "/crops", element: <EnterpriseList module="crops" /> },
              { path: "/crops/:id", element: <EnterpriseDetail module="crops" /> },
              { path: "/stock", element: <StockPage /> },
              { path: "/sales", element: <SalesPage /> },
              { path: "/purchases", element: <PurchasesPage /> },
              { path: "/money", element: <MoneyPage /> },
              { path: "/weather", element: <WeatherPage /> },
              { path: "/alerts", element: <AlertsPage /> },
              { path: "/settings", element: <SettingsPage /> },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]);

if (MOCK_MODE !== "none") console.info(`[shamba] API mock mode: ${MOCK_MODE}`);

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

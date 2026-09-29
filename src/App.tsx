import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { useFarm, useNavigation } from "./api/hooks";
import { MOCK_MODE } from "./api/client";
import { AppShell } from "./components/shell/AppShell";
import { Toaster } from "./components/ui/feedback";
import { Skeleton } from "./components/ui/feedback";
import { AlertsPage } from "./pages/alerts/AlertsPage";
import { SignIn } from "./pages/auth/SignIn";
import { FarmSetup } from "./pages/auth/FarmSetup";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { EnterpriseDetail } from "./pages/enterprise/EnterpriseDetail";
import { EnterpriseList } from "./pages/enterprise/EnterpriseList";
import { FarmPage } from "./pages/farm/FarmPage";
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
  const { farm, isLoading } = useFarm();
  const nav = useNavigation();
  const role = useMembership()?.role;
  if (isLoading || (farm && nav.isLoading)) return <FullPageLoading />;
  if (!farm) return role === "owner" ? <Navigate to="/setup/farm" replace /> : <FullPageLoading />;
  if (nav.data && !nav.data.setup_complete && role === "owner") return <Navigate to="/setup/choose" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignIn /> },
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
              { path: "/farm", element: <FarmPage /> },
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

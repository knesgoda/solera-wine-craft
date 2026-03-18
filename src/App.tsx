import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import DataImport from "./pages/DataImport";
import CellarDashboard from "./pages/cellar/CellarDashboard";
import VesselDetail from "./pages/cellar/VesselDetail";
import BarrelInventory from "./pages/cellar/BarrelInventory";
import BlendingTrials from "./pages/cellar/BlendingTrials";
import TrialDetail from "./pages/cellar/TrialDetail";
import WeatherSettings from "./pages/settings/WeatherSettings";
import AlertSettings from "./pages/settings/AlertSettings";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import VineyardList from "./pages/operations/VineyardList";
import VineyardDetail from "./pages/operations/VineyardDetail";
import BlockDetail from "./pages/operations/BlockDetail";
import TaskList from "./pages/tasks/TaskList";
import TaskDetail from "./pages/tasks/TaskDetail";
import VintageList from "./pages/vintages/VintageList";
import VintageDetail from "./pages/vintages/VintageDetail";
import { OfflineBanner } from "./components/OfflineBanner";
import { PushPrompt } from "./components/PushPrompt";
import { useOfflineSync } from "./hooks/useOfflineSync";

const queryClient = new QueryClient();

const AppInner = () => {
  const { isOnline, pendingCount } = useOfflineSync();
  return (
    <>
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
      <PushPrompt />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppInner />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/operations" element={<VineyardList />} />
              <Route path="/operations/:vineyardId" element={<VineyardDetail />} />
              <Route path="/operations/:vineyardId/blocks/:blockId" element={<BlockDetail />} />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/tasks/:taskId" element={<TaskDetail />} />
              <Route path="/vineyard-ops" element={<Navigate to="/operations" replace />} />
              <Route path="/vintages" element={<VintageList />} />
              <Route path="/vintages/:vintageId" element={<VintageDetail />} />
              <Route path="/cellar" element={<CellarDashboard />} />
              <Route path="/cellar/vessels/:vesselId" element={<VesselDetail />} />
              <Route path="/cellar/barrels" element={<BarrelInventory />} />
              <Route path="/cellar/blending" element={<BlendingTrials />} />
              <Route path="/cellar/blending/:trialId" element={<TrialDetail />} />
              <Route path="/ask-solera" element={<ComingSoon />} />
              <Route path="/sales" element={<ComingSoon />} />
              <Route path="/data-import" element={<DataImport />} />
              <Route path="/settings" element={<ComingSoon />} />
              <Route path="/settings/weather" element={<WeatherSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

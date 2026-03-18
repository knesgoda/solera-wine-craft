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
import NotFound from "./pages/NotFound";
import VineyardList from "./pages/operations/VineyardList";
import VineyardDetail from "./pages/operations/VineyardDetail";
import BlockDetail from "./pages/operations/BlockDetail";
import TaskList from "./pages/tasks/TaskList";
import TaskDetail from "./pages/tasks/TaskDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              <Route path="/vintages" element={<ComingSoon />} />
              <Route path="/cellar" element={<ComingSoon />} />
              <Route path="/ask-solera" element={<ComingSoon />} />
              <Route path="/sales" element={<ComingSoon />} />
              <Route path="/data-import" element={<ComingSoon />} />
              <Route path="/settings" element={<ComingSoon />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

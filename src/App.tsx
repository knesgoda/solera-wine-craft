import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { TierGate } from "@/components/TierGate";
import { GrowthTierGate } from "@/components/GrowthTierGate";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ComingSoonPage from "./pages/ComingSoon";
import AskSolera from "./pages/AskSolera";
import Reports from "./pages/Reports";
import DataImport from "./pages/DataImport";
import ReportsBuilder from "./pages/ReportsBuilder";
import CellarDashboard from "./pages/cellar/CellarDashboard";
import VesselDetail from "./pages/cellar/VesselDetail";
import BarrelInventory from "./pages/cellar/BarrelInventory";
import BlendingTrials from "./pages/cellar/BlendingTrials";
import TrialDetail from "./pages/cellar/TrialDetail";
import WeatherSettings from "./pages/settings/WeatherSettings";
import AlertSettings from "./pages/settings/AlertSettings";
import NotificationsPage from "./pages/NotificationsPage";
import GoogleSheetsSettings from "./pages/settings/GoogleSheetsSettings";
import IntegrationsHub from "./pages/settings/IntegrationsHub";
import Commerce7Settings from "./pages/settings/Commerce7Settings";
import WineDirectSettings from "./pages/settings/WineDirectSettings";
import ShopifySettings from "./pages/settings/ShopifySettings";
import ShipCompliantSettings from "./pages/settings/ShipCompliantSettings";
import QuickBooksSettings from "./pages/settings/QuickBooksSettings";
import RatingsSettings from "./pages/settings/RatingsSettings";
import AnalogExplorer from "./pages/analytics/AnalogExplorer";
import InventoryList from "./pages/inventory/InventoryList";
import SkuDetail from "./pages/inventory/SkuDetail";
import PublicStore from "./pages/store/PublicStore";
import StorefrontSettings from "./pages/settings/StorefrontSettings";
import OrderList from "./pages/orders/OrderList";
import OrderDetail from "./pages/orders/OrderDetail";
import CustomerList from "./pages/customers/CustomerList";
import CustomerDetail from "./pages/customers/CustomerDetail";
import ClubList from "./pages/club/ClubList";
import ClubDetail from "./pages/club/ClubDetail";
import ClubShipments from "./pages/club/ClubShipments";
import NotFound from "./pages/NotFound";
import VineyardList from "./pages/operations/VineyardList";
import VineyardDetail from "./pages/operations/VineyardDetail";
import BlockDetail from "./pages/operations/BlockDetail";
import RipeningComparison from "./pages/operations/RipeningComparison";
import TaskList from "./pages/tasks/TaskList";
import TaskDetail from "./pages/tasks/TaskDetail";
import VintageList from "./pages/vintages/VintageList";
import VintageDetail from "./pages/vintages/VintageDetail";
import GrowerList from "./pages/growers/GrowerList";
import GrowerDetail from "./pages/growers/GrowerDetail";
import GrowerContractList from "./pages/growers/GrowerContractList";
import ContractForm from "./pages/growers/ContractForm";
import ContractDetail from "./pages/growers/ContractDetail";
import GrowerIntake from "./pages/growers/GrowerIntake";
import WeighTagForm from "./pages/growers/WeighTagForm";
import WeighTagDetail from "./pages/growers/WeighTagDetail";
import ClientList from "./pages/clients/ClientList";
import ClientDetail from "./pages/clients/ClientDetail";
import ClientLayout from "./components/ClientLayout";
import ClientLogin from "./pages/client/ClientLogin";
import ClientSignup from "./pages/client/ClientSignup";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientVintagesList from "./pages/client/ClientVintagesList";
import ClientVintageDetail from "./pages/client/ClientVintageDetail";
import ClientDocuments from "./pages/client/ClientDocuments";
import ClientMessages from "./pages/client/ClientMessages";
import ComplianceSettings from "./pages/compliance/ComplianceSettings";
import ComplianceReports from "./pages/compliance/ComplianceReports";
import SsoSettings from "./pages/settings/SsoSettings";
import SsoLogin from "./pages/SsoLogin";
import ApiSettings from "./pages/settings/ApiSettings";
import Developers from "./pages/Developers";
import FacilitySettings from "./pages/settings/FacilitySettings";
import BillingSettings from "./pages/settings/BillingSettings";
import UserManagement from "./pages/settings/UserManagement";
import AuditLog from "./pages/settings/AuditLog";
import SmsSettings from "./pages/settings/SmsSettings";
import CostOverview from "./pages/costs/CostOverview";
import MaterialPrices from "./pages/costs/MaterialPrices";
import CostCategorySettings from "./pages/costs/CostCategorySettings";
import CogsDashboard from "./pages/costs/CogsDashboard";
import LotCostDetail from "./pages/costs/LotCostDetail";
import { OfflineBanner } from "./components/OfflineBanner";
import { PushPrompt } from "./components/PushPrompt";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { ImpersonationProvider } from "./contexts/ImpersonationContext";
import { MarketingLayout } from "./components/marketing/MarketingLayout";
import Homepage from "./pages/marketing/Homepage";
import FeaturesPage from "./pages/marketing/FeaturesPage";
import PricingPage from "./pages/marketing/PricingPage";
import ComparePage from "./pages/marketing/ComparePage";
import AboutPage from "./pages/marketing/AboutPage";
import FaqPage from "./pages/marketing/FaqPage";
import ChangelogPage from "./pages/marketing/ChangelogPage";
import PrivacyPage from "./pages/marketing/PrivacyPage";
import TermsPage from "./pages/marketing/TermsPage";
import BlogIndex from "./pages/marketing/BlogIndex";
import BlogPost from "./pages/marketing/BlogPost";
import BlogAdmin from "./pages/admin/BlogAdmin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ContactPage from "./pages/marketing/ContactPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

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
          <ImpersonationProvider>
          <AppInner />
          <Routes>
            {/* Coming soon / waitlist - public */}
            <Route path="/coming-soon" element={<ComingSoonPage />} />
            {/* Marketing routes */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Homepage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/blog" element={<BlogIndex />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/blog" element={<ProtectedRoute><BlogAdmin /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/store" element={<PublicStore />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="/sso/login" element={<SsoLogin />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/operations" element={<VineyardList />} />
              <Route path="/operations/:vineyardId" element={<VineyardDetail />} />
              <Route path="/operations/:vineyardId/blocks/:blockId" element={<BlockDetail />} />
              <Route path="/ripening-comparison" element={<RipeningComparison />} />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/tasks/:taskId" element={<TaskDetail />} />
              <Route path="/vineyard-ops" element={<Navigate to="/operations" replace />} />
              <Route path="/vintages" element={<VintageList />} />
              <Route path="/vintages/:vintageId" element={<VintageDetail />} />
              <Route path="/growers" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><GrowerList /></TierGate>} />
              <Route path="/growers/contracts" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><GrowerContractList /></TierGate>} />
              <Route path="/growers/contracts/new" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><ContractForm /></TierGate>} />
              <Route path="/growers/contracts/:id" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><ContractDetail /></TierGate>} />
              <Route path="/growers/contracts/:id/edit" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><ContractForm /></TierGate>} />
              <Route path="/growers/intake" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><GrowerIntake /></TierGate>} />
              <Route path="/growers/intake/new" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><WeighTagForm /></TierGate>} />
              <Route path="/growers/intake/:id" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><WeighTagDetail /></TierGate>} />
              <Route path="/growers/:id" element={<TierGate requiredTier="enterprise" featureName="Grower Contract Management"><GrowerDetail /></TierGate>} />
              <Route path="/cellar" element={<CellarDashboard />} />
              <Route path="/cellar/vessels/:vesselId" element={<VesselDetail />} />
              <Route path="/cellar/barrels" element={<BarrelInventory />} />
              <Route path="/cellar/blending" element={<BlendingTrials />} />
              <Route path="/cellar/blending/:trialId" element={<TrialDetail />} />
              <Route path="/ask-solera" element={<AskSolera />} />
              <Route path="/sales" element={<Navigate to="/inventory" replace />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/builder" element={<ReportsBuilder />} />
              <Route path="/data-import" element={<DataImport />} />
              <Route path="/analytics/analog" element={<AnalogExplorer />} />
              <Route path="/costs" element={<GrowthTierGate><CostOverview /></GrowthTierGate>} />
              <Route path="/costs/dashboard" element={<GrowthTierGate><CogsDashboard /></GrowthTierGate>} />
              <Route path="/costs/lot/:vintageId" element={<GrowthTierGate><LotCostDetail /></GrowthTierGate>} />
              <Route path="/costs/materials" element={<GrowthTierGate><MaterialPrices /></GrowthTierGate>} />
              <Route path="/costs/settings" element={<GrowthTierGate><CostCategorySettings /></GrowthTierGate>} />
              <Route path="/inventory" element={<InventoryList />} />
              <Route path="/inventory/:skuId" element={<SkuDetail />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/orders/:orderId" element={<OrderDetail />} />
              <Route path="/customers" element={<CustomerList />} />
              <Route path="/customers/:customerId" element={<CustomerDetail />} />
              <Route path="/club" element={<ClubList />} />
              <Route path="/club/:clubId" element={<ClubDetail />} />
              <Route path="/club/shipments" element={<ClubShipments />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/clients/:clientId" element={<ClientDetail />} />
              <Route path="/settings" element={<Navigate to="/settings/billing" replace />} />
              <Route path="/settings/weather" element={<WeatherSettings />} />
              <Route path="/settings/alerts" element={<AlertSettings />} />
              <Route path="/settings/ratings" element={<RatingsSettings />} />
              <Route path="/settings/storefront" element={<StorefrontSettings />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings/integrations" element={<IntegrationsHub />} />
              <Route path="/settings/integrations/google-sheets" element={<GoogleSheetsSettings />} />
              <Route path="/settings/integrations/commerce7" element={<Commerce7Settings />} />
              <Route path="/settings/integrations/winedirect" element={<WineDirectSettings />} />
              <Route path="/settings/integrations/shopify" element={<ShopifySettings />} />
              <Route path="/settings/integrations/shipcompliant" element={<ShipCompliantSettings />} />
              <Route path="/settings/integrations/quickbooks" element={<QuickBooksSettings />} />
              <Route path="/compliance" element={<ComplianceReports />} />
              <Route path="/compliance/settings" element={<ComplianceSettings />} />
              <Route path="/settings/sso" element={<SsoSettings />} />
              <Route path="/settings/api" element={<ApiSettings />} />
              <Route path="/settings/facilities" element={<FacilitySettings />} />
              <Route path="/settings/billing" element={<BillingSettings />} />
              <Route path="/settings/users" element={<UserManagement />} />
              <Route path="/settings/audit" element={<AuditLog />} />
              <Route path="/settings/alerts/sms" element={<SmsSettings />} />
            </Route>
            {/* Client Portal Routes */}
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client/signup" element={<ClientSignup />} />
            <Route path="/client" element={<ClientLayout />}>
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="vintages" element={<ClientVintagesList />} />
              <Route path="vintages/:vintageId" element={<ClientVintageDetail />} />
              <Route path="documents" element={<ClientDocuments />} />
              <Route path="messages" element={<ClientMessages />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

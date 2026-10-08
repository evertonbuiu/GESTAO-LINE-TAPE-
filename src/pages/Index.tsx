import { useState, useCallback, useMemo, lazy, Suspense, memo, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QuickThemeToggle } from "@/components/QuickThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { AlertsBell, AlertsCenter } from "@/components/AlertsCenter";

import { Dashboard } from "@/components/Dashboard";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Lazy load heavy tabs to shrink initial bundle and speed up first paint
const Equipment = lazy(() => import("@/components/Equipment").then(m => ({ default: m.Equipment })));
const Inventory = lazy(() => import("@/components/Inventory").then(m => ({ default: m.Inventory })));
const Rentals = lazy(() => import("@/components/Rentals").then(m => ({ default: m.Rentals })));
const EventEquipment = lazy(() => import("@/components/EventEquipment").then(m => ({ default: m.EventEquipment })));
const InterstateTransport = lazy(() => import("@/components/InterstateTransport").then(m => ({ default: m.InterstateTransport })));
const Clients = lazy(() => import("@/components/Clients").then(m => ({ default: m.Clients })));
const Collaborators = lazy(() => import("@/components/Collaborators").then(m => ({ default: m.Collaborators })));
const FinancialManagement = lazy(() => import("@/components/FinancialManagement").then(m => ({ default: m.FinancialManagement })));
const UserManagement = lazy(() => import("@/components/UserManagement").then(m => ({ default: m.UserManagement })));
const Maintenance = lazy(() => import("@/components/Maintenance").then(m => ({ default: m.Maintenance })));
const SettingsPage = lazy(() => import("@/components/Settings").then(m => ({ default: m.SettingsPage })));
const ExpenseSpreadsheet = lazy(() => import("@/components/ExpenseSpreadsheet").then(m => ({ default: m.ExpenseSpreadsheet })));
const PersonalExpensesPanel = lazy(() => import("@/components/personal/PersonalExpensesPanel").then(m => ({ default: m.PersonalExpensesPanel })));
const UserThemeSettings = lazy(() => import("@/components/UserThemeSettings").then(m => ({ default: m.UserThemeSettings })));
const LineTapeQuoteSystem = lazy(() => import("@/components/LineTapeQuoteSystem").then(m => ({ default: m.LineTapeQuoteSystem })));
const DailyRates = lazy(() => import("@/components/DailyRates").then(m => ({ default: m.DailyRates })));
const FixedExpenses = lazy(() => import("@/components/FixedExpenses").then(m => ({ default: m.FixedExpenses })));
const FinancialDashboard = lazy(() => import("@/components/FinancialDashboard").then(m => ({ default: m.FinancialDashboard })));
const AccountsReport = lazy(() => import("@/components/AccountsReport").then(m => ({ default: m.AccountsReport })));
const WhatsAppMessages = lazy(() => import("@/components/WhatsAppMessages").then(m => ({ default: m.WhatsAppMessages })));
const NFSeInvoices = lazy(() => import("@/components/NFSeInvoices").then(m => ({ default: m.NFSeInvoices })));
const Diagnostics = lazy(() => import("@/components/Diagnostics").then(m => ({ default: m.Diagnostics })));
const ActivityHistory = lazy(() => import("@/components/ActivityHistory").then(m => ({ default: m.ActivityHistory })));
const SecuritySettings = lazy(() => import("@/components/SecuritySettings").then(m => ({ default: m.SecuritySettings })));

const EventChecklists = lazy(() => import("@/components/EventChecklists").then(m => ({ default: m.EventChecklists })));
const EquipmentQRCodes = lazy(() => import("@/components/EquipmentQRCodes").then(m => ({ default: m.EquipmentQRCodes })));
const QuoteApprovals = lazy(() => import("@/components/QuoteApprovals").then(m => ({ default: m.QuoteApprovals })));
const MessageTemplates = lazy(() => import("@/components/MessageTemplates").then(m => ({ default: m.MessageTemplates })));
const ManagementDashboard = lazy(() => import("@/components/ManagementDashboard").then(m => ({ default: m.ManagementDashboard })));
const ReportsCenter = lazy(() => import("@/components/reports/ReportsCenter").then(m => ({ default: m.ReportsCenter })));
const FinanceModule = lazy(() => import("@/components/finance/FinanceModule").then(m => ({ default: m.FinanceModule })));


const TabFallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// Error Boundary like component for individual tabs
const TabErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("Tab error captured:", error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar a página</AlertTitle>
          <AlertDescription className="mt-2">
            Ocorreu um problema ao carregar este conteúdo. Tente recarregar a página.
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 block"
              onClick={() => window.location.reload()}
            >
              Recarregar Sistema
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};

// Memoized wrapper so hidden panes never re-render when activeTab changes
const KeepAlivePane = memo(({ active, children }: { active: boolean; children: React.ReactNode }) => (
  <div style={{ display: active ? "block" : "none" }}>{children}</div>
));
KeepAlivePane.displayName = "KeepAlivePane";

const tabRenderers: Record<string, (onNavigate: (t: string) => void) => React.ReactNode> = {
  "dashboard": (onNavigate) => <Dashboard onNavigate={onNavigate} />,
  "equipment": () => <Equipment />,
  "inventory": () => <Inventory />,
  "rentals": () => <Rentals />,
  "event-equipment": () => <EventEquipment />,
  "interstate-transport": () => <InterstateTransport />,
  "clients": () => <Clients />,
  "nfse": () => <NFSeInvoices />,
  "contracts": () => <LineTapeQuoteSystem />,
  "collaborators": () => <Collaborators />,
  "daily-rates": () => <DailyRates />,
  "financial": () => <FinancialManagement />,
  "finance-titles": () => <div className="p-4 sm:p-6"><FinanceModule /></div>,
  "fixed-expenses": () => <FixedExpenses />,
  "financial-dashboard": () => <FinancialDashboard />,
  "user-management": () => <UserManagement />,
  "maintenance": () => <Maintenance />,
  "expense-spreadsheet": () => <ExpenseSpreadsheet />,
  "personal-expenses": () => <div className="p-4 sm:p-6"><PersonalExpensesPanel /></div>,
  "accounts-report": () => <AccountsReport />,
  "whatsapp": () => <WhatsAppMessages />,
  "theme-settings": () => <UserThemeSettings />,
  "settings": () => <SettingsPage />,
  "diagnostics": () => <Diagnostics />,
  "activity-history": () => <ActivityHistory />,
  "security": () => <SecuritySettings />,
  "alerts": (onNavigate) => <AlertsCenter onNavigate={onNavigate} />,
  "event-checklists": () => <EventChecklists />,
  "equipment-qr": (onNavigate) => <EquipmentQRCodes onNavigate={onNavigate} />,
  "quote-approvals": () => <QuoteApprovals />,
  "message-templates": () => <MessageTemplates />,
  "management-dashboard": () => <ManagementDashboard />,
  "reports": (onNavigate) => <ReportsCenter onNavigate={onNavigate} />,
};


const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  // Keep-alive: once a tab is opened, keep it mounted (hidden) so re-visits are instant
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(["dashboard"]));

  const handleTabChange = useCallback((tab: string) => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

  const mountedList = useMemo(() => Array.from(mountedTabs), [mountedTabs]);

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
        <div className="flex-1 overflow-auto">
          <header className="h-12 flex items-center justify-end gap-2 px-4 border-b border-border bg-card">
            <SidebarTrigger />
            <div className="mr-auto">
              <GlobalSearch onNavigate={handleTabChange} />
            </div>
            <AlertsBell onNavigate={handleTabChange} />
            <QuickThemeToggle />

          </header>
          <TabErrorBoundary>
            <Suspense fallback={<TabFallback />}>
              {mountedList.map((tab) => {
                const render = tabRenderers[tab];
                if (!render) return null;
                return (
                  <KeepAlivePane key={tab} active={tab === activeTab}>
                    {render(handleTabChange)}
                  </KeepAlivePane>
                );
              })}
            </Suspense>
          </TabErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
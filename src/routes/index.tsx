import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QuickThemeToggle } from "@/components/QuickThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { AlertsBell, AlertsCenter } from "@/components/AlertsCenter";

import { Dashboard } from "@/components/Dashboard";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionsSlotProvider, PageHeader } from "@/components/layout/PageHeader";
import { ACCOUNT_ITEMS, ROLE_LABEL, canAccess, findNav } from "@/components/layout/navigation";
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


/** Lê a página atual do endereço (#/orcamentos etc.), para manter a tela ao recarregar. */
function tabFromHash(): string {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h && tabRenderers[h] ? h : "dashboard";
}

function initials(name?: string | null) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const UserMenu = ({ onNavigate }: { onNavigate: (t: string) => void }) => {
  const { user, userRole, signOut } = useCustomAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-background p-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:pr-3"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground dark:bg-sidebar-primary dark:text-white">
            {initials(user?.name)}
          </span>
          <span className="hidden min-w-0 leading-tight lg:block">
            <span className="block max-w-[140px] truncate text-sm font-medium">{user?.name || user?.username}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[userRole || ""] || "Usuário"}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.name || user?.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{user?.username} · {ROLE_LABEL[userRole || ""] || "Usuário"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_ITEMS.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onNavigate(item.id)} className="gap-2">
            <item.icon className="h-4 w-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400">
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Versão {__APP_VERSION__}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Index = () => {
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const { userRole } = useCustomAuth();

  const handleTabChange = useCallback((tab: string) => {
    if (!tabRenderers[tab]) return;
    setActiveTab(tab);
    if (window.location.hash !== `#/${tab}`) window.history.pushState(null, "", `#/${tab}`);
    window.scrollTo({ top: 0 });
    document.getElementById("conteudo-principal")?.scrollTo({ top: 0 });
  }, []);

  // voltar/avançar do navegador
  useEffect(() => {
    const onPop = () => setActiveTab(tabFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const nav = findNav(activeTab);
  const allowed = !nav || canAccess(nav.item, userRole);

  useEffect(() => {
    document.title = nav ? `${nav.item.label} · Gestão Line Tape` : "Gestão Line Tape";
  }, [nav]);

  const renderActiveTab = tabRenderers[activeTab];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
        <div id="conteudo-principal" className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:gap-3 sm:px-5">
            <SidebarTrigger className="shrink-0" />
            <div className="hidden h-5 w-px bg-border xl:block" />
            <nav aria-label="Você está em" className="hidden min-w-0 items-center gap-1.5 text-sm xl:flex">
              {nav?.group && <span className="truncate text-muted-foreground">{nav.group}</span>}
              {nav?.group && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              <span className="truncate font-medium">{nav?.item.label ?? "Painel"}</span>
            </nav>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <GlobalSearch onNavigate={handleTabChange} />
              <AlertsBell onNavigate={handleTabChange} />
              <QuickThemeToggle />
              <UserMenu onNavigate={handleTabChange} />
            </div>
          </header>

          {nav && (
            <PageHeader
              icon={nav.item.icon}
              title={nav.item.label}
              description={nav.item.description}
              onActionsSlot={setActionsSlot}
            />
          )}

          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1600px] [&>*]:min-w-0">
              <ActionsSlotProvider target={actionsSlot}>
                <TabErrorBoundary>
                  <Suspense key={activeTab} fallback={<TabFallback />}>
                    {allowed ? (
                      renderActiveTab?.(handleTabChange) ?? null
                    ) : (
                      <div className="p-6">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Sem acesso a esta página</AlertTitle>
                          <AlertDescription>Seu perfil não tem permissão para abrir {nav?.item.label}.</AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </Suspense>
                </TabErrorBoundary>
              </ActionsSlotProvider>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;

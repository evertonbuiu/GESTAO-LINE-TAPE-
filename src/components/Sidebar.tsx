import {
  Package, Settings, BarChart3, Calendar, Home, Users, Wrench, LogOut, Cog, UserCheck,
  DollarSign, UserCog, FileSpreadsheet, User, Palette, Truck, FileText, Clock,
  PieChart, ClipboardList, MessageSquare, Receipt, Activity, History, ShieldCheck, ChevronDown,
  Bell, ClipboardCheck, QrCode, FileCheck2,

} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

type Role = 'admin' | 'funcionario' | 'financeiro' | 'deposito' | null;

interface Item {
  id: string;
  label: string;
  icon: typeof Home;
  roles?: Role[];
}

interface Group {
  id: string;
  label: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Home },
      { id: "financial-dashboard", label: "Dashboard Financeiro", icon: PieChart, roles: ["admin"] },
      { id: "management-dashboard", label: "Painel Gerencial", icon: BarChart3, roles: ["admin", "financeiro"] },
      { id: "reports", label: "Relatórios", icon: BarChart3, roles: ["admin", "financeiro"] },
      { id: "alerts", label: "Central de Alertas", icon: Bell },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    items: [
      { id: "equipment", label: "Equipamentos", icon: Package, roles: ["admin", "funcionario", "deposito"] },
      { id: "inventory", label: "Estoque", icon: BarChart3, roles: ["admin", "funcionario", "deposito"] },
      { id: "rentals", label: "Locações", icon: Calendar, roles: ["admin", "financeiro", "deposito"] },
      { id: "event-equipment", label: "Equipamentos Eventos", icon: Cog, roles: ["admin", "funcionario", "deposito"] },
      { id: "event-checklists", label: "Checklists de Evento", icon: ClipboardCheck, roles: ["admin", "financeiro", "deposito", "funcionario"] },
      { id: "equipment-qr", label: "QR Code Equipamentos", icon: QrCode, roles: ["admin", "financeiro", "deposito", "funcionario"] },
      { id: "interstate-transport", label: "Transporte Interestadual", icon: Truck },
      { id: "maintenance", label: "Manutenção", icon: Wrench },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { id: "clients", label: "Clientes", icon: Users, roles: ["admin", "financeiro", "deposito"] },
      { id: "contracts", label: "Orçamentos", icon: FileText, roles: ["admin", "financeiro"] },
      { id: "quote-approvals", label: "Aprovação de Orçamentos", icon: FileCheck2, roles: ["admin", "financeiro"] },
      { id: "nfse", label: "Notas Fiscais", icon: Receipt, roles: ["admin", "financeiro"] },
      { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, roles: ["admin", "financeiro"] },
      { id: "message-templates", label: "Mensagens e Lembretes", icon: MessageSquare, roles: ["admin", "financeiro"] },
    ],
  },

  {
    id: "pessoas",
    label: "Pessoas",
    items: [
      { id: "collaborators", label: "Colaboradores", icon: UserCheck },
      { id: "daily-rates", label: "Diárias", icon: Clock, roles: ["admin", "financeiro"] },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { id: "financial", label: "Gestão Financeira", icon: DollarSign, roles: ["admin", "financeiro"] },
      { id: "finance-titles", label: "Contas a Pagar/Receber", icon: ClipboardList, roles: ["admin", "financeiro"] },
      { id: "fixed-expenses", label: "Despesas Fixas", icon: Calendar, roles: ["admin", "financeiro"] },
      { id: "expense-spreadsheet", label: "Gastos Empresa", icon: FileSpreadsheet, roles: ["admin", "financeiro"] },
      { id: "accounts-report", label: "Relatório de Contas", icon: ClipboardList, roles: ["admin", "financeiro"] },
      { id: "personal-expenses", label: "Gastos Pessoais", icon: User, roles: ["admin"] },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { id: "user-management", label: "Gerenciar Usuários", icon: UserCog, roles: ["admin"] },
      { id: "activity-history", label: "Histórico de Atividades", icon: History, roles: ["admin"] },
      { id: "diagnostics", label: "Diagnóstico", icon: Activity, roles: ["admin"] },
      { id: "security", label: "Segurança da Conta", icon: ShieldCheck },
      { id: "theme-settings", label: "Configurar Tema", icon: Palette },
      { id: "settings", label: "Configurações", icon: Settings, roles: ["admin"] },
    ],
  },
];

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const { signOut, userRole } = useCustomAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(userRole)),
  })).filter((g) => g.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.id, true])),
  );

  const toggleGroup = (id: string, open: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [id]: open }));

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader className="border-b border-border p-6">
        <div className={cn("transition-all", collapsed && "hidden")}>
          <Logo size="md" />
        </div>

        {!collapsed && (
          <div className="mt-3">
            <Badge variant={userRole === 'admin' ? 'default' : userRole === 'financeiro' ? 'secondary' : userRole === 'deposito' ? 'destructive' : 'outline'}>
              {userRole === 'admin' ? 'Administrador' : userRole === 'financeiro' ? 'Financeiro' : userRole === 'deposito' ? 'Depósito' : 'Funcionário'}
            </Badge>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const hasActive = group.items.some((i) => i.id === activeTab);
          const isOpen = collapsed ? true : (openGroups[group.id] ?? true) || hasActive;

          return (
            <Collapsible
              key={group.id}
              open={isOpen}
              onOpenChange={(open) => toggleGroup(group.id, open)}
            >
              <SidebarGroup>
                {!collapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="flex cursor-pointer items-center justify-between hover:text-foreground">
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", !isOpen && "-rotate-90")}
                      />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={activeTab === item.id}
                            onClick={() => setActiveTab(item.id)}
                            tooltip={item.label}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              tooltip="Sair"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
  );
};

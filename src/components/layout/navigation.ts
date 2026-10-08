// Mapa único de navegação do sistema: menu lateral, título da página,
// caminho (breadcrumb) e permissões por perfil vêm todos daqui.
import {
  Activity, BarChart3, Bell, Calendar, ClipboardCheck, ClipboardList, Clock, DollarSign,
  FileCheck2, FileSpreadsheet, FileText, History, Home, LineChart, MessageSquare, MessagesSquare,
  Package, Palette, PieChart, QrCode, Receipt, Settings, ShieldCheck, Truck, User, UserCheck,
  UserCog, Users, Warehouse, Wrench, Boxes, type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "funcionario" | "financeiro" | "deposito" | null;

export interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles?: Role[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Início",
    items: [
      { id: "dashboard", label: "Painel", description: "Resumo da operação, estoque e próximos eventos", icon: Home },
      { id: "alerts", label: "Central de alertas", description: "Pendências e avisos que precisam de atenção", icon: Bell },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { id: "clients", label: "Clientes", description: "Cadastro e histórico de clientes", icon: Users, roles: ["admin", "financeiro", "deposito"] },
      { id: "contracts", label: "Orçamentos", description: "Crie, envie e acompanhe orçamentos", icon: FileText, roles: ["admin", "financeiro"] },
      { id: "quote-approvals", label: "Aprovação de orçamentos", description: "Respostas dos clientes aos orçamentos enviados", icon: FileCheck2, roles: ["admin", "financeiro"] },
      { id: "rentals", label: "Locações e eventos", description: "Eventos, pagamentos, equipe e despesas", icon: Calendar, roles: ["admin", "financeiro", "deposito"] },
      { id: "nfse", label: "Notas fiscais", description: "Emissão e consulta de NFS-e", icon: Receipt, roles: ["admin", "financeiro"] },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "equipment", label: "Equipamentos", description: "Cadastro dos equipamentos do almoxarifado", icon: Package, roles: ["admin", "funcionario", "deposito"] },
      { id: "inventory", label: "Estoque", description: "Disponibilidade, alocação e níveis de estoque", icon: Warehouse, roles: ["admin", "funcionario", "deposito"] },
      { id: "event-equipment", label: "Equipamentos nos eventos", description: "Separação e devolução de material por evento", icon: Boxes, roles: ["admin", "funcionario", "deposito"] },
      { id: "event-checklists", label: "Checklists de evento", description: "Conferência de montagem e desmontagem", icon: ClipboardCheck, roles: ["admin", "financeiro", "deposito", "funcionario"] },
      { id: "maintenance", label: "Manutenção", description: "Manutenções agendadas e em andamento", icon: Wrench },
      { id: "interstate-transport", label: "Transporte interestadual", description: "Viagens, custos e documentos de transporte", icon: Truck },
      { id: "equipment-qr", label: "Etiquetas QR", description: "Etiquetas para identificar equipamentos", icon: QrCode, roles: ["admin", "financeiro", "deposito", "funcionario"] },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    items: [
      { id: "collaborators", label: "Colaboradores", description: "Equipe fixa e diaristas", icon: UserCheck },
      { id: "daily-rates", label: "Diárias", description: "Diárias, presença e pagamentos da equipe", icon: Clock, roles: ["admin", "financeiro"] },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { id: "financial", label: "Gestão financeira", description: "Contas bancárias, lançamentos e conciliação", icon: DollarSign, roles: ["admin", "financeiro"] },
      { id: "finance-titles", label: "Contas a pagar e receber", description: "Títulos, parcelas e pagamentos", icon: ClipboardList, roles: ["admin", "financeiro"] },
      { id: "fixed-expenses", label: "Despesas fixas", description: "Despesas recorrentes da empresa", icon: Calendar, roles: ["admin", "financeiro"] },
      { id: "expense-spreadsheet", label: "Gastos da empresa", description: "Planilha de despesas da empresa", icon: FileSpreadsheet, roles: ["admin", "financeiro"] },
      { id: "accounts-report", label: "Relatório de contas", description: "Extrato e saldos por conta", icon: ClipboardList, roles: ["admin", "financeiro"] },
      { id: "personal-expenses", label: "Gastos pessoais", description: "Controle financeiro pessoal", icon: User, roles: ["admin"] },
    ],
  },
  {
    id: "analises",
    label: "Análises",
    items: [
      { id: "financial-dashboard", label: "Painel financeiro", description: "Receitas, despesas e resultado no período", icon: PieChart, roles: ["admin"] },
      { id: "management-dashboard", label: "Painel gerencial", description: "Indicadores da operação e do comercial", icon: LineChart, roles: ["admin", "financeiro"] },
      { id: "reports", label: "Relatórios", description: "Relatórios para análise e exportação", icon: BarChart3, roles: ["admin", "financeiro"] },
    ],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    items: [
      { id: "whatsapp", label: "WhatsApp", description: "Mensagens e comprovantes recebidos", icon: MessageSquare, roles: ["admin", "financeiro"] },
      { id: "message-templates", label: "Mensagens e lembretes", description: "Modelos de mensagens para clientes e equipe", icon: MessagesSquare, roles: ["admin", "financeiro"] },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { id: "user-management", label: "Usuários", description: "Acessos e perfis da equipe", icon: UserCog, roles: ["admin"] },
      { id: "activity-history", label: "Histórico de atividades", description: "Quem alterou o quê e quando", icon: History, roles: ["admin"] },
      { id: "diagnostics", label: "Diagnóstico", description: "Situação técnica do sistema", icon: Activity, roles: ["admin"] },
      { id: "settings", label: "Configurações", description: "Dados da empresa, logo e integrações", icon: Settings, roles: ["admin"] },
    ],
  },
];

/** Páginas acessadas pelo menu do usuário (canto superior direito). */
export const ACCOUNT_ITEMS: NavItem[] = [
  { id: "security", label: "Segurança da conta", description: "Senha e sessões do seu usuário", icon: ShieldCheck },
  { id: "theme-settings", label: "Aparência", description: "Tema, densidade e acessibilidade", icon: Palette },
];

const ALL: Record<string, { item: NavItem; group: string | null }> = {};
for (const g of NAV_GROUPS) for (const item of g.items) ALL[item.id] = { item, group: g.label };
for (const item of ACCOUNT_ITEMS) ALL[item.id] = { item, group: "Minha conta" };

export function findNav(id: string) {
  return ALL[id] ?? null;
}

export function canAccess(item: NavItem, role: Role) {
  return !item.roles || item.roles.includes(role);
}

export function visibleGroups(role: Role) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(i, role)) })).filter(
    (g) => g.items.length > 0,
  );
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  deposito: "Depósito",
  funcionario: "Funcionário",
};

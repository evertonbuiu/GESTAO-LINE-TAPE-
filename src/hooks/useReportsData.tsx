import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/reports";

/**
 * Carga de dados dos Relatórios.
 * Cada seção é uma query independente, filtrada por período no servidor,
 * selecionando apenas as colunas usadas (sem dados sensíveis).
 * Falha de permissão (RLS) não quebra a tela: a seção fica indisponível.
 */

export interface ReportEvent {
  id: string;
  name: string;
  client_name: string | null;
  event_date: string | null;
  status: string | null;
  total_budget: number | null;
  total_expenses: number | null;
  profit_margin: number | null;
  is_paid: boolean | null;
  payment_amount: number | null;
  remaining_payment_amount: number | null;
  is_remaining_paid: boolean | null;
}

export interface ReportExpense {
  id: string;
  scope: "evento" | "empresa";
  description: string;
  category: string | null;
  supplier: string | null;
  total_price: number;
  expense_date: string | null;
  is_paid: boolean | null;
  event_id: string | null;
  event_name: string | null;
}

export interface ReportQuote {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  event_name: string | null;
  quote_date: string | null;
  status: string | null;
  total_amount: number | null;
}

export interface ReportContract {
  id: string;
  contract_number: string | null;
  client_name: string | null;
  status: string | null;
  start_date: string | null;
  total_value: number | null;
  signed_at: string | null;
}

export interface ReportDailyRate {
  id: string;
  worker_name: string;
  event_id: string | null;
  event_name: string | null;
  date: string;
  amount: number;
  overtime_amount: number | null;
  food_amount: number | null;
  transport_amount: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  attendance_status: string | null;
}

export interface ReportEquipment {
  id: string;
  name: string;
  category: string | null;
  total_stock: number | null;
  available: number | null;
  rented: number | null;
  min_stock: number | null;
  price_per_day: number | null;
  status: string | null;
}

export interface ReportInvoice {
  id: string;
  invoice_number: string | null;
  rps_number: string | null;
  taker_name: string | null;
  issue_date: string | null;
  status: string | null;
  service_value: number | null;
  iss_value: number | null;
  net_value: number | null;
}

export interface ReportTitle {
  id: string;
  kind: "receber" | "pagar";
  status: string;
  description: string;
  total_amount: number;
  due_date: string;
  category: string | null;
  event_id: string | null;
  client_id: string | null;
}

export interface ReportPayment {
  id: string;
  title_id: string;
  amount: number;
  paid_at: string;
  is_reversal: boolean;
}

const isDenied = (error: unknown) => {
  const code = (error as { code?: string })?.code ?? "";
  return code === "42501" || code === "PGRST301" || code === "401";
};

async function safeList<T>(
  run: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ rows: T[]; denied: boolean }> {
  const { data, error } = await run();
  if (error) {
    if (isDenied(error)) return { rows: [], denied: true };
    throw error;
  }
  return { rows: (data as T[]) ?? [], denied: false };
}

export const useReportsData = (range: DateRange, enabled = true) => {
  const key = [range.start, range.end];

  const events = useQuery({
    queryKey: ["reports", "events", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<ReportEvent>(() =>
        supabase
          .from("events")
          .select(
            "id,name,client_name,event_date,status,total_budget,total_expenses,profit_margin,is_paid,payment_amount,remaining_payment_amount,is_remaining_paid",
          )
          .gte("event_date", range.start)
          .lte("event_date", range.end)
          .order("event_date", { ascending: false }),
      );
      return { rows, denied };
    },
  });

  const expenses = useQuery({
    queryKey: ["reports", "expenses", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [eventRes, companyRes] = await Promise.all([
        safeList<Record<string, unknown>>(() =>
          supabase
            .from("event_expenses")
            .select(
              "id,description,category,supplier,total_price,expense_date,is_paid,event_id,events(name)",
            )
            .gte("expense_date", range.start)
            .lte("expense_date", range.end),
        ),
        safeList<Record<string, unknown>>(() =>
          supabase
            .from("company_expenses")
            .select("id,description,category,supplier,total_price,expense_date,is_paid")
            .gte("expense_date", range.start)
            .lte("expense_date", range.end),
        ),
      ]);

      const rows: ReportExpense[] = [
        ...eventRes.rows.map((r) => ({
          id: `event-${r.id}`,
          scope: "evento" as const,
          description: String(r.description ?? ""),
          category: (r.category as string) ?? null,
          supplier: (r.supplier as string) ?? null,
          total_price: Number(r.total_price ?? 0),
          expense_date: (r.expense_date as string) ?? null,
          is_paid: (r.is_paid as boolean) ?? null,
          event_id: (r.event_id as string) ?? null,
          event_name: ((r.events as { name?: string } | null)?.name as string) ?? null,
        })),
        ...companyRes.rows.map((r) => ({
          id: `company-${r.id}`,
          scope: "empresa" as const,
          description: String(r.description ?? ""),
          category: (r.category as string) ?? null,
          supplier: (r.supplier as string) ?? null,
          total_price: Number(r.total_price ?? 0),
          expense_date: (r.expense_date as string) ?? null,
          is_paid: (r.is_paid as boolean) ?? null,
          event_id: null,
          event_name: null,
        })),
      ];

      return { rows, denied: eventRes.denied && companyRes.denied };
    },
  });

  const commercial = useQuery({
    queryKey: ["reports", "commercial", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [quotesRes, contractsRes] = await Promise.all([
        safeList<ReportQuote>(() =>
          supabase
            .from("external_quotes")
            .select("id,quote_number,client_name,event_name,quote_date,status,total_amount")
            .gte("quote_date", range.start)
            .lte("quote_date", range.end)
            .order("quote_date", { ascending: false }),
        ),
        safeList<ReportContract>(() =>
          supabase
            .from("contracts")
            .select("id,contract_number,client_name,status,start_date,total_value,signed_at")
            .gte("start_date", range.start)
            .lte("start_date", range.end)
            .order("start_date", { ascending: false }),
        ),
      ]);
      return {
        quotes: quotesRes.rows,
        contracts: contractsRes.rows,
        denied: quotesRes.denied && contractsRes.denied,
      };
    },
  });

  const people = useQuery({
    queryKey: ["reports", "people", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<Record<string, unknown>>(() =>
        supabase
          .from("daily_rates")
          .select(
            "id,worker_name,event_id,date,amount,overtime_amount,food_amount,transport_amount,discount_amount,payment_status,attendance_status,events(name)",
          )
          .gte("date", range.start)
          .lte("date", range.end)
          .order("date", { ascending: false }),
      );
      const mapped: ReportDailyRate[] = rows.map((r) => ({
        id: String(r.id),
        worker_name: String(r.worker_name ?? ""),
        event_id: (r.event_id as string) ?? null,
        event_name: ((r.events as { name?: string } | null)?.name as string) ?? null,
        date: String(r.date ?? ""),
        amount: Number(r.amount ?? 0),
        overtime_amount: Number(r.overtime_amount ?? 0),
        food_amount: Number(r.food_amount ?? 0),
        transport_amount: Number(r.transport_amount ?? 0),
        discount_amount: Number(r.discount_amount ?? 0),
        payment_status: (r.payment_status as string) ?? null,
        attendance_status: (r.attendance_status as string) ?? null,
      }));
      return { rows: mapped, denied };
    },
  });

  // Estoque é uma fotografia atual (não depende do período).
  const equipment = useQuery({
    queryKey: ["reports", "equipment"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<ReportEquipment>(() =>
        supabase
          .from("equipment")
          .select("id,name,category,total_stock,available,rented,min_stock,price_per_day,status")
          .order("name"),
      );
      return { rows, denied };
    },
  });

  const invoices = useQuery({
    queryKey: ["reports", "invoices", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<ReportInvoice>(() =>
        supabase
          .from("nfse_invoices")
          .select(
            "id,invoice_number,rps_number,taker_name,issue_date,status,service_value,iss_value,net_value",
          )
          .gte("issue_date", range.start)
          .lte("issue_date", range.end)
          .order("issue_date", { ascending: false }),
      );
      return { rows, denied };
    },
  });

  const finance = useQuery({
    queryKey: ["reports", "finance", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [titlesRes, paymentsRes] = await Promise.all([
        safeList<ReportTitle>(() =>
          supabase
            .from("finance_titles")
            .select(
              "id,kind,status,description,total_amount,due_date,category,event_id,client_id",
            )
            .gte("due_date", range.start)
            .lte("due_date", range.end),
        ),
        safeList<ReportPayment>(() =>
          supabase
            .from("finance_payments")
            .select("id,title_id,amount,paid_at,is_reversal")
            .gte("paid_at", range.start)
            .lte("paid_at", range.end),
        ),
      ]);
      return {
        titles: titlesRes.rows,
        payments: paymentsRes.rows,
        denied: titlesRes.denied || paymentsRes.denied,
      };
    },
  });

  return { events, expenses, commercial, people, equipment, invoices, finance };
};

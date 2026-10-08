/**
 * Carga de dados dos RELATÓRIOS da Gestão Financeira.
 * Consulta apenas o necessário, sempre filtrando por período no servidor,
 * e nunca consulta dados sensíveis (person_sensitive_data, credenciais).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/reports";
import { dateOnly } from "@/lib/reports";
import type { LedgerEntry } from "@/lib/financeReports";
import type { FinanceInstallment, FinancePayment, FinanceTitle } from "@/lib/finance";

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

export interface FinanceReportAccount {
  id: string;
  name: string;
  bank_name: string | null;
  current_balance: number;
  is_active: boolean | null;
}

export interface FinanceReportEvent {
  id: string;
  name: string;
  event_date: string | null;
  total_budget: number | null;
  status: string | null;
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));

export const useFinanceReportsData = (range: DateRange, enabled = true) => {
  const key = [range.start, range.end];

  const accounts = useQuery({
    queryKey: ["fin-reports", "accounts"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<FinanceReportAccount>(() =>
        supabase
          .from("bank_accounts")
          .select("id,name,bank_name,current_balance,is_active")
          .order("name"),
      );
      return { rows, denied };
    },
  });

  const events = useQuery({
    queryKey: ["fin-reports", "events", ...key],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { rows, denied } = await safeList<FinanceReportEvent>(() =>
        supabase
          .from("events")
          .select("id,name,event_date,total_budget,status")
          .gte("event_date", range.start)
          .lte("event_date", range.end),
      );
      return { rows, denied };
    },
  });

  const ledger = useQuery({
    queryKey: ["fin-reports", "ledger", ...key],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const [bankRes, accountsRes, eventExpRes, companyExpRes, cardRes, eventRes] =
        await Promise.all([
          safeList<Record<string, unknown>>(() =>
            supabase
              .from("bank_transactions")
              .select(
                "id,bank_account_id,transaction_date,transaction_time,created_at,description,category,transaction_type,amount,reference_type,reference_id",
              )
              .gte("transaction_date", range.start)
              .lte("transaction_date", range.end),
          ),
          safeList<Record<string, unknown>>(() =>
            supabase.from("bank_accounts").select("id,name"),
          ),
          safeList<Record<string, unknown>>(() =>
            supabase
              .from("event_expenses")
              .select(
                "id,event_id,category,description,total_price,expense_date,expense_bank_account,reference_type,reference_id,events(name)",
              )
              .gte("expense_date", range.start)
              .lte("expense_date", range.end),
          ),
          safeList<Record<string, unknown>>(() =>
            supabase
              .from("company_expenses")
              .select(
                "id,category,description,total_price,expense_date,expense_bank_account",
              )
              .gte("expense_date", range.start)
              .lte("expense_date", range.end),
          ),
          safeList<Record<string, unknown>>(() =>
            supabase
              .from("bank_card_transactions")
              .select("id,card_id,transaction_date,description,amount,category,transaction_type")
              .gte("transaction_date", range.start)
              .lte("transaction_date", range.end),
          ),
          safeList<Record<string, unknown>>(() =>
            supabase
              .from("events")
              .select(
                "id,name,event_date,is_paid,payment_date,payment_amount,payment_bank_account,remaining_payment_amount,remaining_payment_date,remaining_payment_bank_account,is_remaining_paid",
              )
              .gte("event_date", range.start)
              .lte("event_date", range.end),
          ),
        ]);

      const accountName = new Map<string, string>();
      accountsRes.rows.forEach((a) => accountName.set(str(a.id), str(a.name)));

      const entries: LedgerEntry[] = [];

      bankRes.rows.forEach((r) => {
        const amount = Math.abs(num(r.amount));
        const type = str(r.transaction_type) === "income" ? "income" : "expense";
        entries.push({
          id: `bank-${str(r.id)}`,
          date: dateOnly(str(r.transaction_date)),
          time: (r.transaction_time as string | null) ?? null,
          createdAt: (r.created_at as string | null) ?? null,
          description: str(r.description),
          category: str(r.category) || "Sem categoria",
          type,
          amount,
          accountId: (r.bank_account_id as string) ?? null,
          accountName: accountName.get(str(r.bank_account_id)) ?? null,
          source: "bank_transactions",
          sourceId: str(r.id),
          referenceType: (r.reference_type as string) ?? null,
          referenceId: (r.reference_id as string) ?? null,
          status: "realizado",
        });
      });

      eventExpRes.rows.forEach((r) => {
        entries.push({
          id: `evexp-${str(r.id)}`,
          date: dateOnly(str(r.expense_date)),
          description: str(r.description),
          category: str(r.category) || "Despesa de evento",
          type: "expense",
          amount: Math.abs(num(r.total_price)),
          accountId: (r.expense_bank_account as string) ?? null,
          accountName: accountName.get(str(r.expense_bank_account)) ?? null,
          source: "event_expenses",
          sourceId: str(r.id),
          referenceType: (r.reference_type as string) ?? null,
          referenceId: (r.reference_id as string) ?? null,
          eventId: (r.event_id as string) ?? null,
          eventName: ((r.events as { name?: string } | null)?.name as string) ?? null,
          status: "realizado",
        });
      });

      companyExpRes.rows.forEach((r) => {
        entries.push({
          id: `coexp-${str(r.id)}`,
          date: dateOnly(str(r.expense_date)),
          description: str(r.description),
          category: str(r.category) || "Despesa da empresa",
          type: "expense",
          amount: Math.abs(num(r.total_price)),
          accountId: (r.expense_bank_account as string) ?? null,
          accountName: accountName.get(str(r.expense_bank_account)) ?? null,
          source: "company_expenses",
          sourceId: str(r.id),
          status: "realizado",
        });
      });

      cardRes.rows.forEach((r) => {
        entries.push({
          id: `card-${str(r.id)}`,
          date: dateOnly(str(r.transaction_date)),
          description: str(r.description),
          category: str(r.category) || "Cartão",
          type: str(r.transaction_type) === "income" ? "income" : "expense",
          amount: Math.abs(num(r.amount)),
          accountId: null,
          accountName: "Cartão",
          source: "bank_card_transactions",
          sourceId: str(r.id),
          status: "realizado",
        });
      });

      eventRes.rows.forEach((r) => {
        const id = str(r.id);
        const name = str(r.name);
        if (r.is_paid && num(r.payment_amount) > 0) {
          entries.push({
            id: `evpay-${id}`,
            date: dateOnly(str(r.payment_date) || str(r.event_date)),
            description: `Recebimento — ${name}`,
            category: "Receita de evento",
            type: "income",
            amount: num(r.payment_amount),
            accountId: (r.payment_bank_account as string) ?? null,
            accountName: accountName.get(str(r.payment_bank_account)) ?? null,
            source: "events",
            sourceId: `${id}-payment`,
            referenceType: "event_payment",
            referenceId: id,
            eventId: id,
            eventName: name,
            status: "realizado",
          });
        }
        if (r.is_remaining_paid && num(r.remaining_payment_amount) > 0) {
          entries.push({
            id: `evrem-${id}`,
            date: dateOnly(str(r.remaining_payment_date) || str(r.event_date)),
            description: `Recebimento restante — ${name}`,
            category: "Receita de evento",
            type: "income",
            amount: num(r.remaining_payment_amount),
            accountId: (r.remaining_payment_bank_account as string) ?? null,
            accountName: accountName.get(str(r.remaining_payment_bank_account)) ?? null,
            source: "events",
            sourceId: `${id}-remaining`,
            referenceType: "event_remaining_payment",
            referenceId: id,
            eventId: id,
            eventName: name,
            status: "realizado",
          });
        }
      });

      const denied =
        bankRes.denied && eventExpRes.denied && companyExpRes.denied && eventRes.denied;

      return { entries, denied };
    },
  });

  const finance = useQuery({
    queryKey: ["fin-reports", "finance", ...key],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const [titlesRes, instRes, payRes] = await Promise.all([
        safeList<FinanceTitle>(() =>
          supabase
            .from("finance_titles")
            .select(
              "id,kind,status,description,total_amount,due_date,issue_date,category,cost_center,event_id,client_id,contract_id,quote_id,supplier_name,source_type,source_id",
            ),
        ),
        safeList<FinanceInstallment>(() =>
          supabase
            .from("finance_installments")
            .select("id,title_id,number,due_date,amount,status"),
        ),
        safeList<FinancePayment>(() =>
          supabase
            .from("finance_payments")
            .select(
              "id,title_id,installment_id,amount,paid_at,is_reversal,reverses_payment_id,bank_account_id",
            ),
        ),
      ]);
      return {
        titles: titlesRes.rows,
        installments: instRes.rows,
        payments: payRes.rows,
        denied: titlesRes.denied && payRes.denied,
      };
    },
  });

  return { accounts, events, ledger, finance };
};

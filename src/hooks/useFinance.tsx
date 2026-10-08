import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import {
  buildInstallments,
  todaySaoPaulo,
  validatePayment,
  type FinanceInstallment,
  type FinancePayment,
  type FinanceTitle,
  type TitleStatus,
} from "@/lib/finance";

export interface NewTitleInput {
  kind: FinanceTitle["kind"];
  description: string;
  total_amount: number;
  due_date: string;
  issue_date?: string;
  category?: string | null;
  cost_center?: string | null;
  client_id?: string | null;
  event_id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;
  supplier_name?: string | null;
  notes?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  installments?: number;
}

export interface NewPaymentInput {
  titleId: string;
  installmentId?: string | null;
  amount: number;
  paidAt: string;
  method?: string | null;
  bankAccountId?: string | null;
  receiptUrl?: string | null;
  discount?: number;
  interest?: number;
  fine?: number;
  notes?: string | null;
}

const BANK_REF_PAYMENT = "finance_payment";
const BANK_REF_REVERSAL = "finance_payment_reversal";

export const useFinance = () => {
  const { user, userRole } = useCustomAuth();
  const canOperate = userRole === "admin" || userRole === "financeiro";

  const [titles, setTitles] = useState<FinanceTitle[]>([]);
  const [installments, setInstallments] = useState<FinanceInstallment[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!canOperate) {
      setTitles([]);
      setInstallments([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [t, i, p] = await Promise.all([
        supabase.from("finance_titles").select("*").order("due_date", { ascending: true }),
        supabase.from("finance_installments").select("*").order("number", { ascending: true }),
        supabase.from("finance_payments").select("*").order("paid_at", { ascending: false }),
      ]);
      if (t.error) throw t.error;
      if (i.error) throw i.error;
      if (p.error) throw p.error;
      setTitles((t.data ?? []) as unknown as FinanceTitle[]);
      setInstallments((i.data ?? []) as unknown as FinanceInstallment[]);
      setPayments((p.data ?? []) as unknown as FinancePayment[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, [canOperate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const paymentsByTitle = useMemo(() => {
    const map = new Map<string, FinancePayment[]>();
    payments.forEach((p) => {
      const list = map.get(p.title_id) ?? [];
      list.push(p);
      map.set(p.title_id, list);
    });
    return map;
  }, [payments]);

  const installmentsByTitle = useMemo(() => {
    const map = new Map<string, FinanceInstallment[]>();
    installments.forEach((i) => {
      const list = map.get(i.title_id) ?? [];
      list.push(i);
      map.set(i.title_id, list);
    });
    return map;
  }, [installments]);

  /** Cria título (e parcelas). A origem é única por constraint no banco. */
  const createTitle = useCallback(
    async (input: NewTitleInput) => {
      const { installments: count = 1, ...rest } = input;
      const { data, error: insErr } = await supabase
        .from("finance_titles")
        .insert({
          ...rest,
          issue_date: rest.issue_date ?? todaySaoPaulo(),
          status: "pendente",
          created_by: user?.id ?? null,
        } as never)
        .select("*")
        .single();

      if (insErr) throw insErr;
      const title = data as unknown as FinanceTitle;

      const rows = buildInstallments(input.total_amount, Math.max(1, count), input.due_date).map(
        (r) => ({ ...r, title_id: title.id, status: "pendente" }),
      );
      const { error: instErr } = await supabase
        .from("finance_installments")
        .insert(rows as never);
      if (instErr) throw instErr;

      await fetchAll();
      return title;
    },
    [fetchAll, user?.id],
  );

  const updateTitleStatus = useCallback(
    async (titleId: string, status: TitleStatus) => {
      const { error: upErr } = await supabase
        .from("finance_titles")
        .update({ status } as never)
        .eq("id", titleId);
      if (upErr) throw upErr;
      await fetchAll();
    },
    [fetchAll],
  );

  const syncStatuses = useCallback(
    async (titleId: string) => {
      const { data: freshPayments } = await supabase
        .from("finance_payments")
        .select("*")
        .eq("title_id", titleId);
      const list = (freshPayments ?? []) as unknown as FinancePayment[];
      const title = titles.find((t) => t.id === titleId);
      if (!title) return;

      const net = list.reduce((acc, p) => acc + (p.is_reversal ? -p.amount : p.amount), 0);

      const titleInstallments = installmentsByTitle.get(titleId) ?? [];
      await Promise.all(
        titleInstallments.map(async (inst) => {
          const paid = list
            .filter((p) => p.installment_id === inst.id)
            .reduce((acc, p) => acc + (p.is_reversal ? -p.amount : p.amount), 0);
          const next =
            paid <= 0 ? "pendente" : paid + 0.005 >= inst.amount ? "pago" : "parcial";
          if (next !== inst.status && inst.status !== "cancelado") {
            await supabase
              .from("finance_installments")
              .update({ status: next } as never)
              .eq("id", inst.id);
          }
        }),
      );

      const nextTitleStatus: TitleStatus | null =
        net + 0.005 >= title.total_amount
          ? "pago"
          : title.status === "pago"
            ? "pendente"
            : null;
      if (nextTitleStatus && nextTitleStatus !== title.status) {
        await supabase
          .from("finance_titles")
          .update({ status: nextTitleStatus } as never)
          .eq("id", titleId);
      }
    },
    [installmentsByTitle, titles],
  );

  /** Registra pagamento e, se houver conta, lança no livro-caixa exatamente uma vez. */
  const registerPayment = useCallback(
    async (input: NewPaymentInput) => {
      const title = titles.find((t) => t.id === input.titleId);
      if (!title) throw new Error("Título não encontrado.");
      const installment = input.installmentId
        ? installments.find((i) => i.id === input.installmentId)
        : null;

      const check = validatePayment(
        title,
        { amount: input.amount },
        paymentsByTitle.get(title.id) ?? [],
        installment,
      );
      if (!check.ok) throw new Error(check.error);

      const { data, error: payErr } = await supabase
        .from("finance_payments")
        .insert({
          title_id: input.titleId,
          installment_id: input.installmentId ?? null,
          amount: input.amount,
          paid_at: input.paidAt,
          method: input.method ?? null,
          bank_account_id: input.bankAccountId ?? null,
          receipt_url: input.receiptUrl ?? null,
          discount_amount: input.discount ?? 0,
          interest_amount: input.interest ?? 0,
          fine_amount: input.fine ?? 0,
          notes: input.notes ?? null,
          created_by: user?.id ?? null,
        } as never)
        .select("*")
        .single();
      if (payErr) throw payErr;
      const payment = data as unknown as FinancePayment;

      if (input.bankAccountId) {
        const { error: btErr } = await supabase.from("bank_transactions").insert({
          bank_account_id: input.bankAccountId,
          transaction_date: input.paidAt,
          description: `${title.kind === "receber" ? "Recebimento" : "Pagamento"} - ${title.description}`,
          category: title.category ?? (title.kind === "receber" ? "Recebimentos" : "Pagamentos"),
          transaction_type: title.kind === "receber" ? "income" : "expense",
          amount: input.amount,
          reference_type: BANK_REF_PAYMENT,
          reference_id: payment.id,
          receipt_url: input.receiptUrl ?? null,
        } as never);
        // Duplicidade é bloqueada por trigger; o pagamento permanece válido.
        if (btErr && !/Já existe lançamento/i.test(btErr.message)) throw btErr;
      }

      await syncStatuses(input.titleId);
      await fetchAll();
      return payment;
    },
    [fetchAll, installments, paymentsByTitle, syncStatuses, titles, user?.id],
  );

  /** Estorno integral: gera contrapartida no livro-caixa e mantém o histórico. */
  const reversePayment = useCallback(
    async (paymentId: string, paidAt: string = todaySaoPaulo(), notes?: string) => {
      const original = payments.find((p) => p.id === paymentId);
      if (!original) throw new Error("Pagamento não encontrado.");
      const title = titles.find((t) => t.id === original.title_id);
      if (!title) throw new Error("Título não encontrado.");

      const check = validatePayment(
        title,
        { amount: original.amount, isReversal: true, reversesPaymentId: paymentId },
        payments.filter((p) => p.title_id === title.id),
      );
      if (!check.ok) throw new Error(check.error);

      const { data, error: revErr } = await supabase
        .from("finance_payments")
        .insert({
          title_id: original.title_id,
          installment_id: original.installment_id ?? null,
          amount: original.amount,
          paid_at: paidAt,
          method: original.method ?? null,
          bank_account_id: original.bank_account_id ?? null,
          is_reversal: true,
          reverses_payment_id: paymentId,
          notes: notes ?? "Estorno",
          created_by: user?.id ?? null,
        } as never)
        .select("*")
        .single();
      if (revErr) throw revErr;
      const reversal = data as unknown as FinancePayment;

      if (original.bank_account_id) {
        const { error: btErr } = await supabase.from("bank_transactions").insert({
          bank_account_id: original.bank_account_id,
          transaction_date: paidAt,
          description: `Estorno - ${title.description}`,
          category: title.category ?? "Estornos",
          transaction_type: title.kind === "receber" ? "expense" : "income",
          amount: original.amount,
          reference_type: BANK_REF_REVERSAL,
          reference_id: reversal.id,
        } as never);
        if (btErr && !/Já existe lançamento/i.test(btErr.message)) throw btErr;
      }

      await syncStatuses(original.title_id);
      await fetchAll();
      return reversal;
    },
    [fetchAll, payments, syncStatuses, titles, user?.id],
  );

  return {
    canOperate,
    titles,
    installments,
    payments,
    paymentsByTitle,
    installmentsByTitle,
    loading,
    error,
    refresh: fetchAll,
    createTitle,
    updateTitleStatus,
    registerPayment,
    reversePayment,
  };
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PersonalBudgetRow,
  PersonalCategoryRow,
  PersonalExpenseRow,
  buildInstallments,
  buildReversal,
  monthKey,
  monthRange,
} from "@/lib/personalExpenses";

export interface PersonalAccountRow {
  id: string;
  name: string;
  type: string;
  initial_balance_cents: number;
  archived: boolean;
}

interface State {
  expenses: PersonalExpenseRow[];
  categories: PersonalCategoryRow[];
  accounts: PersonalAccountRow[];
  budgets: PersonalBudgetRow[];
  loading: boolean;
  error: string | null;
}

const EMPTY: State = {
  expenses: [],
  categories: [],
  accounts: [],
  budgets: [],
  loading: true,
  error: null,
};

export function usePersonalExpenses(year: number, month: number) {
  const [state, setState] = useState<State>(EMPTY);
  const range = useMemo(() => monthRange(year, month), [year, month]);
  const currentMonthKey = useMemo(() => monthKey(year, month), [year, month]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [expensesRes, categoriesRes, accountsRes, budgetsRes] = await Promise.all([
        supabase
          .from("personal_expenses")
          .select("*")
          .gte("expense_date", range.start)
          .lte("expense_date", range.end)
          .order("expense_date", { ascending: false }),
        supabase.from("personal_categories").select("*").order("name"),
        supabase.from("personal_accounts").select("*").order("name"),
        supabase.from("personal_budgets").select("*").eq("month", currentMonthKey),
      ]);

      const firstError =
        expensesRes.error || categoriesRes.error || accountsRes.error || budgetsRes.error;
      if (firstError) throw firstError;

      setState({
        expenses: (expensesRes.data ?? []) as unknown as PersonalExpenseRow[],
        categories: (categoriesRes.data ?? []) as unknown as PersonalCategoryRow[],
        accounts: (accountsRes.data ?? []) as unknown as PersonalAccountRow[],
        budgets: (budgetsRes.data ?? []) as unknown as PersonalBudgetRow[],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao carregar gastos pessoais";
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, [range.start, range.end, currentMonthKey]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------------- mutações (owner_id é gravado pelo banco) ---------------- */

  const createExpense = useCallback(
    async (draft: {
      description: string;
      amount_cents: number;
      expense_date: string;
      kind: "expense" | "income";
      payment_method?: string | null;
      notes?: string | null;
      category_id?: string | null;
      account_id?: string | null;
      installments?: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const owner_id = auth.user?.id;
      if (!owner_id) throw new Error("Sessão expirada. Entre novamente.");

      const { installments = 1, ...base } = draft;
      if (installments > 1) {
        const parts = buildInstallments(base.amount_cents, installments, base.expense_date);
        const [first, ...rest] = parts;
        const { data: parent, error: parentError } = await supabase
          .from("personal_expenses")
          .insert({ ...base, ...first, owner_id })
          .select("id")
          .single();
        if (parentError) throw parentError;
        if (rest.length) {
          const { error } = await supabase
            .from("personal_expenses")
            .insert(rest.map((p) => ({ ...base, ...p, owner_id, parent_id: parent.id })));
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("personal_expenses").insert({ ...base, owner_id });
        if (error) throw error;
      }
      await load();
    },
    [load],
  );

  const updateExpense = useCallback(
    async (id: string, patch: Partial<PersonalExpenseRow>) => {
      const { error } = await supabase.from("personal_expenses").update(patch).eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const reverseExpense = useCallback(
    async (original: PersonalExpenseRow) => {
      const { data: auth } = await supabase.auth.getUser();
      const owner_id = auth.user?.id;
      if (!owner_id) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase
        .from("personal_expenses")
        .insert({ ...buildReversal(original), owner_id });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const createCategory = useCallback(
    async (input: { name: string; kind: "expense" | "income"; color?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const owner_id = auth.user?.id;
      if (!owner_id) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("personal_categories").insert({ ...input, owner_id });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const archiveCategory = useCallback(
    async (id: string, archived: boolean) => {
      const { error } = await supabase
        .from("personal_categories")
        .update({ archived })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const createAccount = useCallback(
    async (input: { name: string; type: string; initial_balance_cents: number }) => {
      const { data: auth } = await supabase.auth.getUser();
      const owner_id = auth.user?.id;
      if (!owner_id) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("personal_accounts").insert({ ...input, owner_id });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const archiveAccount = useCallback(
    async (id: string, archived: boolean) => {
      const { error } = await supabase.from("personal_accounts").update({ archived }).eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const upsertBudget = useCallback(
    async (categoryId: string | null, limitCents: number) => {
      const { data: auth } = await supabase.auth.getUser();
      const owner_id = auth.user?.id;
      if (!owner_id) throw new Error("Sessão expirada. Entre novamente.");
      const existing = state.budgets.find(
        (b) => b.category_id === categoryId && b.month === currentMonthKey,
      );
      if (existing) {
        const { error } = await supabase
          .from("personal_budgets")
          .update({ limit_cents: limitCents, active: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("personal_budgets").insert({
          owner_id,
          category_id: categoryId,
          month: currentMonthKey,
          limit_cents: limitCents,
        });
        if (error) throw error;
      }
      await load();
    },
    [load, state.budgets, currentMonthKey],
  );

  return {
    ...state,
    range,
    monthKey: currentMonthKey,
    reload: load,
    createExpense,
    updateExpense,
    reverseExpense,
    createCategory,
    archiveCategory,
    createAccount,
    archiveAccount,
    upsertBudget,
  };
}

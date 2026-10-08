import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import {
  type AccountRecord,
  type AccountTx,
  type CardRecord,
  type CardTx,
  type PeriodClosing,
} from "@/lib/accounts";

/** Tabelas opcionais (dependem de migração aprovada). */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST106"]);
const DENIED_CODES = new Set(["42501", "PGRST301"]);

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (MISSING_TABLE_CODES.has(error.code ?? "") || /does not exist/i.test(error.message ?? ""));

export interface AccountsData {
  accounts: AccountRecord[];
  transactions: AccountTx[];
  cards: CardRecord[];
  cardTransactions: CardTx[];
  closings: PeriodClosing[];
  reconciledIds: Set<string>;
  /** true quando as tabelas de conciliação/fechamento ainda não existem. */
  ledgerExtrasPending: boolean;
  loading: boolean;
  error: string | null;
  denied: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
}

export const useAccountsData = (): AccountsData => {
  const { userRole } = useCustomAuth();
  const canOperate = userRole === "admin" || userRole === "financeiro";

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [transactions, setTransactions] = useState<AccountTx[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardTransactions, setCardTransactions] = useState<CardTx[]>([]);
  const [closings, setClosings] = useState<PeriodClosing[]>([]);
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());
  const [ledgerExtrasPending, setLedgerExtrasPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!canOperate) {
      setDenied(true);
      setLoading(false);
      return;
    }
    if (!options?.silent) setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const [accRes, txRes, cardRes, cardTxRes] = await Promise.all([
        supabase.from("bank_accounts").select("*").order("created_at", { ascending: true }),
        supabase
          .from("bank_transactions")
          .select(
            "id, bank_account_id, transaction_date, transaction_time, description, category, transaction_type, amount, reference_type, reference_id, notes, receipt_url, created_at",
          )
          .order("transaction_date", { ascending: false })
          .limit(20000),
        supabase.from("bank_cards").select("*").order("name"),
        supabase
          .from("bank_card_transactions")
          .select("id, card_id, transaction_date, description, category, transaction_type, amount")
          .order("transaction_date", { ascending: false })
          .limit(10000),
      ]);

      const firstError = [accRes.error, txRes.error, cardRes.error, cardTxRes.error].find(Boolean);
      if (firstError) {
        if (DENIED_CODES.has((firstError as { code?: string }).code ?? "")) {
          setDenied(true);
          setLoading(false);
          return;
        }
        throw firstError;
      }

      setAccounts(
        (accRes.data ?? []).map((a: Record<string, unknown>) => ({
          id: String(a.id),
          name: String(a.name ?? ""),
          type: (a.account_type as AccountRecord["type"]) ?? "checking",
          bankName: (a.bank_name as string | null) ?? null,
          agency: (a.agency as string | null) ?? null,
          accountNumber: (a.account_number as string | null) ?? null,
          initialBalance: Number(a.initial_balance ?? 0),
          storedBalance: Number(a.balance ?? a.current_balance ?? 0),
          isActive: a.is_active !== false,
          createdAt: (a.created_at as string | null) ?? null,
        })),
      );

      setTransactions(
        (txRes.data ?? []).map((t: Record<string, unknown>) => ({
          id: String(t.id),
          accountId: (t.bank_account_id as string | null) ?? null,
          date: String(t.transaction_date ?? "").slice(0, 10),
          time: (t.transaction_time as string | null) ?? null,
          description: String(t.description ?? ""),
          category: (t.category as string | null) ?? null,
          type: (t.transaction_type as AccountTx["type"]) === "income" ? "income" : "expense",
          amount: Math.abs(Number(t.amount ?? 0)),
          referenceType: (t.reference_type as string | null) ?? null,
          referenceId: (t.reference_id as string | null) ?? null,
          notes: (t.notes as string | null) ?? null,
          receiptUrl: (t.receipt_url as string | null) ?? null,
          createdAt: (t.created_at as string | null) ?? null,
        })),
      );

      setCards(
        (cardRes.data ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          cardNumber: String(c.card_number ?? ""),
          cardType: (c.card_type as CardRecord["cardType"]) ?? "credit",
          bank: String(c.bank ?? ""),
          limitAmount: c.limit_amount == null ? null : Number(c.limit_amount),
          isActive: c.is_active !== false,
        })),
      );

      setCardTransactions(
        (cardTxRes.data ?? []).map((t: Record<string, unknown>) => ({
          id: String(t.id),
          cardId: String(t.card_id),
          date: String(t.transaction_date ?? "").slice(0, 10),
          description: String(t.description ?? ""),
          category: (t.category as string | null) ?? null,
          type: (t.transaction_type as CardTx["type"]) === "income" ? "income" : "expense",
          amount: Math.abs(Number(t.amount ?? 0)),
        })),
      );

      // Tabelas opcionais: conciliação manual e fechamento de período.
      const [closeRes, recRes] = await Promise.all([
        supabase.from("bank_account_closings" as never).select("*"),
        supabase.from("bank_transaction_reconciliations" as never).select("*"),
      ]);

      if (isMissingTable(closeRes.error as never) || isMissingTable(recRes.error as never)) {
        setLedgerExtrasPending(true);
        setClosings([]);
        setReconciledIds(new Set());
      } else {
        setLedgerExtrasPending(false);
        setClosings(
          ((closeRes.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
            id: String(c.id),
            accountId: String(c.bank_account_id),
            closedThrough: String(c.closed_through ?? "").slice(0, 10),
            closingBalance: Number(c.closing_balance ?? 0),
            notes: (c.notes as string | null) ?? null,
            createdAt: (c.created_at as string | null) ?? null,
          })),
        );
        setReconciledIds(
          new Set(
            ((recRes.data ?? []) as Array<Record<string, unknown>>).map((r) =>
              String(r.bank_transaction_id),
            ),
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados das contas.");
    } finally {
      setLoading(false);
    }
  }, [canOperate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canOperate) return;
    const channel = supabase
      .channel("accounts-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_transactions" }, () => {
        void load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, () => {
        void load({ silent: true });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [canOperate, load]);

  return useMemo(
    () => ({
      accounts,
      transactions,
      cards,
      cardTransactions,
      closings,
      reconciledIds,
      ledgerExtrasPending,
      loading,
      error,
      denied,
      refresh: load,
    }),
    [
      accounts,
      transactions,
      cards,
      cardTransactions,
      closings,
      reconciledIds,
      ledgerExtrasPending,
      loading,
      error,
      denied,
      load,
    ],
  );
};

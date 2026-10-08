import { useCallback, useEffect, useRef, useState } from 'react';

export type DraftStatus = 'idle' | 'saving' | 'saved';

interface StoredDraft<T> {
  version: number;
  savedAt: string;
  data: T;
}

const DRAFT_VERSION = 1;

function safeParse<T>(raw: string | null): StoredDraft<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || parsed.version !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Autosave local (localStorage) com debounce para o assistente de orçamento.
 * Nunca grava segredos: use apenas dados do formulário.
 */
export function useQuoteDraft<T>(key: string, data: T, enabled: boolean, delay = 800) {
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = useRef(true);

  const loadDraft = useCallback((): { data: T; savedAt: string } | null => {
    if (typeof window === 'undefined') return null;
    const stored = safeParse<T>(window.localStorage.getItem(key));
    return stored ? { data: stored.data, savedAt: stored.savedAt } : null;
  }, [key]);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    setStatus('idle');
    setSavedAt(null);
  }, [key]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const payload: StoredDraft<T> = {
          version: DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          data,
        };
        window.localStorage.setItem(key, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
        setStatus('saved');
      } catch {
        setStatus('idle');
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, enabled, delay]);

  return { status, savedAt, loadDraft, clearDraft };
}

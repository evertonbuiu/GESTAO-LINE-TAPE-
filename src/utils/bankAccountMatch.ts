export type BankAccountLike = {
  id: string;
  name: string;
};

export const normalizeAccountName = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export const findBankAccountByName = <T extends BankAccountLike>(
  accounts: T[],
  rawName?: string | null
): T | undefined => {
  const query = normalizeAccountName(rawName);
  if (!query) return undefined;

  const exact = accounts.find((a) => normalizeAccountName(a.name) === query);
  if (exact) return exact;

  // Fallback: handle minor inconsistencies (e.g., saved as "C6 BANK" vs "C6 BANK Letra 3D line tape")
  const candidates = accounts.filter((a) => {
    const n = normalizeAccountName(a.name);
    return n.includes(query) || query.includes(n);
  });

  if (candidates.length === 1) return candidates[0];
  return undefined;
};

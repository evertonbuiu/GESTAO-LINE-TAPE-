const normalizeTime = (value?: string | null) => {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]}:${match[2]}` : null;
};

export const formatTransactionDateTime = (
  date?: string | null,
  time?: string | null,
  fallbackTimestamp?: string | null,
) => {
  const dateOnly = String(date ?? "").slice(0, 10);
  if (!dateOnly) return "—";
  const [year, month, day] = dateOnly.split("-");
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : dateOnly;
  const formattedTime = normalizeTime(time) ?? (() => {
    if (!fallbackTimestamp) return null;
    const parsed = new Date(fallbackTimestamp);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed);
  })();
  return formattedTime ? `${formattedDate} às ${formattedTime}` : formattedDate;
};

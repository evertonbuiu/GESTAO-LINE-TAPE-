// Identificador de build exposto na tela de Diagnóstico.
export const APP_BUILD =
  (import.meta.env.VITE_APP_BUILD as string | undefined) ?? import.meta.env.MODE;

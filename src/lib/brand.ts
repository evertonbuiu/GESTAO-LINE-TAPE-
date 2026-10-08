/** Remove o nome antigo da marca de dados históricos sem alterar o restante da razão social. */
export const normalizeLineTapeBrand = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .replace(/letra\s*3d\s*line\s*tape/gi, 'LINE TAPE')
    .replace(/letra\s*3d/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};


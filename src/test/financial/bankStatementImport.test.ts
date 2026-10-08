import { describe, it, expect } from 'vitest';
import {
  buildImportFingerprint,
  dedupeByFingerprint,
  getFileExtension,
  isSupportedStatementFile,
  normalizeDescription,
  parseOfx,
  parseOfxAmount,
  parseOfxDate,
  summarizeImport,
  toCents,
  validateStatementFile,
} from '@/lib/bankStatementImport';

const TZ = `[-3:${'BRT'}]`;

const OFX_SAMPLE = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260115120000${TZ}<TRNAMT>1500.00<FITID>ABC123<NAME>PIX RECEBIDO JOAO<MEMO>Sinal evento</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260116<TRNAMT>-250.50<FITID>DEF456<NAME>COMPRA DEBITO<MEMO>Supermercado</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260117<TRNAMT>0.00<FITID>ZERO<NAME>Estorno</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261332<TRNAMT>-10.00<FITID>BAD<NAME>Data ruim</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('parser OFX', () => {
  it('lê crédito e débito com FITID, NAME e MEMO', () => {
    const result = parseOfx(OFX_SAMPLE);
    expect(result.transactions).toHaveLength(2);

    const [credit, debit] = result.transactions;
    expect(credit).toMatchObject({
      date: '2026-01-15',
      description: 'PIX RECEBIDO JOAO',
      amount: 1500,
      type: 'income',
      fitId: 'ABC123',
      memo: 'Sinal evento',
    });
    expect(debit).toMatchObject({
      date: '2026-01-16',
      amount: 250.5,
      type: 'expense',
      fitId: 'DEF456',
    });
  });

  it('descarta valor zero e data inválida', () => {
    const result = parseOfx(OFX_SAMPLE);
    expect(result.discarded).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it('rejeita arquivo sem STMTTRN', () => {
    const result = parseOfx('OFXHEADER:100\n<OFX></OFX>');
    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/sem transações/i);
  });

  it('preserva data local sem deslocamento de fuso', () => {
    expect(parseOfxDate(`20260101000000${TZ}`)).toBe('2026-01-01');
    expect(parseOfxDate('20260231')).toBeNull();
    expect(parseOfxDate('lixo')).toBeNull();
  });

  it('interpreta valores em formato americano e brasileiro', () => {
    expect(parseOfxAmount('-1.234,56')).toBe(-1234.56);
    expect(parseOfxAmount('1234.56')).toBe(1234.56);
    expect(parseOfxAmount('')).toBeNull();
  });
});

describe('validação de arquivo', () => {
  it('aceita extensões sem diferenciar maiúsculas', () => {
    expect(getFileExtension('Extrato.OFX')).toBe('.ofx');
    expect(isSupportedStatementFile('EXTRATO.XLSX')).toBe(true);
    expect(isSupportedStatementFile('extrato.pdf')).toBe(false);
  });

  it('rejeita formato inválido e arquivo acima de 10 MB', () => {
    expect(validateStatementFile({ name: 'a.pdf', size: 10 }).ok).toBe(false);
    expect(validateStatementFile({ name: 'a.ofx', size: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(validateStatementFile({ name: 'a.ofx', size: 1024 }).ok).toBe(true);
  });
});

describe('normalização e fingerprint', () => {
  it('normaliza descrição removendo acentos e pontuação', () => {
    expect(normalizeDescription('Transferência  PIX - João!')).toBe('TRANSFERENCIA PIX JOAO');
    expect(toCents(1234.565)).toBe(123457);
  });

  it('gera fingerprint determinístico e sensível aos campos-chave', () => {
    const base = {
      accountId: 'acc-1',
      fitId: 'ABC123',
      date: '2026-01-15',
      type: 'income' as const,
      amount: 1500,
      description: 'PIX Recebido',
    };
    const a = buildImportFingerprint(base);
    expect(a).toBe(buildImportFingerprint({ ...base, description: 'pix  recebido' }));
    expect(a).not.toBe(buildImportFingerprint({ ...base, amount: 1500.01 }));
    expect(a).not.toBe(buildImportFingerprint({ ...base, accountId: 'acc-2' }));
    expect(a).not.toBe(buildImportFingerprint({ ...base, fitId: 'OTHER' }));
    expect(a).not.toBe(buildImportFingerprint({ ...base, type: 'expense' }));
  });

  it('ignora duplicados do arquivo e do banco', () => {
    const rows = [{ fingerprint: 'a' }, { fingerprint: 'a' }, { fingerprint: 'b' }];
    const { toInsert, duplicates } = dedupeByFingerprint(rows, new Set(['b']));
    expect(toInsert).toEqual([{ fingerprint: 'a' }]);
    expect(duplicates).toBe(2);
  });

  it('resume o resultado da importação', () => {
    expect(summarizeImport(0, 5)).toBe('Extrato já sincronizado');
    expect(summarizeImport(3, 0)).toMatch(/3 movimenta/);
    expect(summarizeImport(2, 1)).toMatch(/2 importada\(s\) · 1 duplicada/);
  });
});

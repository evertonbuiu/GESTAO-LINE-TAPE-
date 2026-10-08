import { describe, it, expect } from 'vitest';
import { PRINT_STYLES, buildPrintDocument, waitForDocumentAssets } from '@/components/quotes/QuotePreviewDialog';

describe('estilos de impressão do orçamento', () => {
  it('define A4 retrato com margens de 10-12mm', () => {
    expect(PRINT_STYLES).toContain('@page { size: A4 portrait; margin: 11mm; }');
  });

  it('preserva cores na impressão', () => {
    expect(PRINT_STYLES).toContain('print-color-adjust: exact');
    expect(PRINT_STYLES).toContain('-webkit-print-color-adjust: exact');
  });

  it('repete o cabeçalho da tabela entre páginas', () => {
    expect(PRINT_STYLES).toContain('thead { display: table-header-group; }');
  });

  it('evita quebras dentro de linhas, imagens e totais', () => {
    expect(PRINT_STYLES).toContain('tr, img { break-inside: avoid; page-break-inside: avoid; }');
    expect(PRINT_STYLES).toContain('.doc-totals { width: 62mm; margin-left: auto; break-inside: avoid; page-break-inside: avoid; }');
  });

  it('permite que a lista de itens continue em páginas seguintes', () => {
    expect(PRINT_STYLES).toContain('section.doc-items { break-inside: auto; page-break-inside: auto; }');
  });

  it('usa larguras estáveis de coluna e texto sem corte', () => {
    expect(PRINT_STYLES).toContain('table-layout: fixed');
    expect(PRINT_STYLES).toContain('overflow-wrap: anywhere');
  });
});

describe('buildPrintDocument', () => {
  it('gera documento isolado apenas com o orçamento', () => {
    const html = buildPrintDocument('<section>Conteúdo</section>', 'Orçamento #001');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Orçamento #001</title>');
    expect(html).toContain('<main class="doc-root"><section>Conteúdo</section></main>');
    // nada do app é incluído
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<nav');
  });

  it('embute os estilos de impressão', () => {
    expect(buildPrintDocument('', 'x')).toContain('@page');
  });
});

describe('waitForDocumentAssets', () => {
  function makeDoc(images: any[], fontsReady?: Promise<unknown>) {
    return { images, fonts: fontsReady ? { ready: fontsReady } : undefined } as unknown as Document;
  }

  it('resolve imediatamente quando as imagens já carregaram', async () => {
    await expect(waitForDocumentAssets(makeDoc([{ complete: true }]), 1000)).resolves.toBeUndefined();
  });

  it('aguarda o evento load das imagens pendentes', async () => {
    let handler: (() => void) | null = null;
    const img = {
      complete: false,
      addEventListener: (evt: string, cb: () => void) => {
        if (evt === 'load') handler = cb;
      },
    };
    const promise = waitForDocumentAssets(makeDoc([img]), 2000);
    expect(handler).not.toBeNull();
    handler!();
    await expect(promise).resolves.toBeUndefined();
  });

  it('não trava quando uma imagem nunca carrega (timeout seguro)', async () => {
    const img = { complete: false, addEventListener: () => {} };
    const start = Date.now();
    await waitForDocumentAssets(makeDoc([img]), 50);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it('aguarda document.fonts.ready quando disponível', async () => {
    let resolveFonts: (v?: unknown) => void = () => {};
    const fonts = new Promise((r) => (resolveFonts = r));
    let done = false;
    const p = waitForDocumentAssets(makeDoc([], fonts), 2000).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    resolveFonts();
    await p;
    expect(done).toBe(true);
  });
});

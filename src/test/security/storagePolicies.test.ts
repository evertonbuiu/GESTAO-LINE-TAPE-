import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: vi.fn(),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  },
}));

import {
  buildReceiptPath,
  extractStoragePath,
  fileExtension,
  isSafeStoragePath,
  validateProductImageUpload,
  validateReceiptUpload,
  IMAGE_EXTENSIONS,
  RECEIPT_EXTENSIONS,
  MAX_IMAGE_BYTES,
  MAX_RECEIPT_BYTES,
  RECEIPT_BUCKET,
  PRODUCT_IMAGE_BUCKET,
  FINANCE_RECEIPT_BUCKET,
  EXPENSE_RECEIPT_BUCKET,
  detectReceiptBucket,
  resolveProductImageDisplayUrl,
} from '@/lib/storageUrls';

const file = (name: string, type: string, size: number) => ({ name, type, size });

/** Espelha as policies SQL de storage.objects para validar a matriz de acesso. */
const canWriteProductImages = (role: string | null, path: string) =>
  !!role && ['admin', 'deposito'].includes(role) && isSafeStoragePath(path, IMAGE_EXTENSIONS);

const canAccessReceipt = (
  role: string | null,
  uid: string | null,
  objectName: string,
  owner: string | null = null
) => {
  if (!uid) return false; // anônimo nunca
  if (role && ['admin', 'financeiro'].includes(role)) return true;
  return owner === uid || objectName.startsWith(`receipts/${uid}-`);
};

const canDeleteReceipt = (role: string | null, uid: string | null) =>
  !!uid && !!role && ['admin', 'financeiro'].includes(role);

describe('storage: validação de MIME, tamanho e caminho', () => {
  it('aceita imagens permitidas em product-images', () => {
    expect(validateProductImageUpload(file('a.jpg', 'image/jpeg', 1000)).ok).toBe(true);
    expect(validateProductImageUpload(file('a.png', 'image/png', 1000)).ok).toBe(true);
    expect(validateProductImageUpload(file('a.webp', 'image/webp', 1000)).ok).toBe(true);
  });

  it('rejeita MIME não permitido e arquivos grandes demais', () => {
    expect(validateProductImageUpload(file('a.svg', 'image/svg+xml', 10)).ok).toBe(false);
    expect(validateProductImageUpload(file('x.exe', 'application/x-msdownload', 10)).ok).toBe(false);
    expect(validateProductImageUpload(file('a.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1)).ok).toBe(false);
    expect(validateProductImageUpload(file('a.jpg', 'image/jpeg', 0)).ok).toBe(false);
  });

  it('rejeita extensão divergente do MIME declarado', () => {
    expect(validateProductImageUpload(file('a.php', 'image/jpeg', 100)).ok).toBe(false);
  });

  it('aceita PDF e imagens em comprovantes, respeitando 10 MB', () => {
    expect(validateReceiptUpload(file('c.pdf', 'application/pdf', 1000)).ok).toBe(true);
    expect(validateReceiptUpload(file('c.jpeg', 'image/jpeg', 1000)).ok).toBe(true);
    expect(validateReceiptUpload(file('c.pdf', 'application/pdf', MAX_RECEIPT_BYTES + 1)).ok).toBe(false);
    expect(validateReceiptUpload(file('c.txt', 'text/plain', 10)).ok).toBe(false);
  });

  it('bloqueia path traversal e caminhos inválidos', () => {
    expect(isSafeStoragePath('../../etc/passwd.jpg', IMAGE_EXTENSIONS)).toBe(false);
    expect(isSafeStoragePath('/abs/a.jpg', IMAGE_EXTENSIONS)).toBe(false);
    expect(isSafeStoragePath('a//b.jpg', IMAGE_EXTENSIONS)).toBe(false);
    expect(isSafeStoragePath('a\\b.jpg', IMAGE_EXTENSIONS)).toBe(false);
    expect(isSafeStoragePath(`${'a'.repeat(320)}.jpg`, IMAGE_EXTENSIONS)).toBe(false);
    expect(isSafeStoragePath('receipts/u-1.pdf', RECEIPT_EXTENSIONS)).toBe(true);
  });

  it('extrai extensão em minúsculas', () => {
    expect(fileExtension('Foto.JPG')).toBe('jpg');
    expect(fileExtension('semextensao')).toBe('');
  });
});

describe('storage: caminho isolado por usuário', () => {
  it('gera caminho na pasta receipts prefixado pelo id do usuário', () => {
    const path = buildReceiptPath('user-1', 'nota.pdf', 1700000000000);
    expect(path).toBe('receipts/user-1-1700000000000.pdf');
    expect(isSafeStoragePath(path, RECEIPT_EXTENSIONS)).toBe(true);
  });
});

describe('storage: matriz de autorização (espelho das policies)', () => {
  it('anônimo é negado em escrita de imagens e em qualquer acesso a comprovantes', () => {
    expect(canWriteProductImages(null, 'product-1.jpg')).toBe(false);
    expect(canAccessReceipt(null, null, 'receipts/user-1-1.pdf')).toBe(false);
    expect(canDeleteReceipt(null, null)).toBe(false);
  });

  it('somente admin/deposito escrevem em product-images', () => {
    expect(canWriteProductImages('admin', 'product-1.jpg')).toBe(true);
    expect(canWriteProductImages('deposito', 'product-1.png')).toBe(true);
    expect(canWriteProductImages('funcionario', 'product-1.jpg')).toBe(false);
    expect(canWriteProductImages('financeiro', 'product-1.jpg')).toBe(false);
    expect(canWriteProductImages('admin', 'product-1.svg')).toBe(false);
  });

  it('isola comprovantes entre usuários', () => {
    expect(canAccessReceipt('funcionario', 'u1', 'receipts/u1-1.pdf')).toBe(true);
    expect(canAccessReceipt('funcionario', 'u2', 'receipts/u1-1.pdf')).toBe(false);
    expect(canAccessReceipt('funcionario', 'u2', 'receipts/u1-1.pdf', 'u2')).toBe(true);
  });

  it('admin e financeiro acessam todos os comprovantes e podem excluir', () => {
    expect(canAccessReceipt('admin', 'u9', 'receipts/u1-1.pdf')).toBe(true);
    expect(canAccessReceipt('financeiro', 'u9', 'receipts/u1-1.pdf')).toBe(true);
    expect(canDeleteReceipt('financeiro', 'u9')).toBe(true);
    expect(canDeleteReceipt('funcionario', 'u1')).toBe(false);
  });
});

describe('storage: URLs assinadas e caminhos legados', () => {
  it('extrai o caminho de URL pública legada do bucket de comprovantes', () => {
    const legacy =
      'https://bvmadmmeheyclurvgrju.supabase.co/storage/v1/object/public/worker-receipts/receipts/u1-123.jpeg';
    expect(extractStoragePath(legacy, RECEIPT_BUCKET)).toBe('receipts/u1-123.jpeg');
  });

  it('extrai o caminho de URL assinada e ignora querystring', () => {
    const signed =
      'https://x.supabase.co/storage/v1/object/sign/worker-receipts/receipts/u1-9.pdf?token=abc';
    expect(extractStoragePath(signed, RECEIPT_BUCKET)).toBe('receipts/u1-9.pdf');
  });

  it('aceita caminho puro e rejeita URL de outro bucket', () => {
    expect(extractStoragePath('receipts/u1-1.pdf', RECEIPT_BUCKET)).toBe('receipts/u1-1.pdf');
    expect(extractStoragePath('https://outro.com/arquivo.pdf', RECEIPT_BUCKET)).toBeNull();
    expect(
      extractStoragePath(
        'https://x.supabase.co/storage/v1/object/public/product-images/product-1.jpg',
        PRODUCT_IMAGE_BUCKET
      )
    ).toBe('product-1.jpg');
  });

  it('retorna null para valores vazios', () => {
    expect(extractStoragePath('', RECEIPT_BUCKET)).toBeNull();
  });
});

describe('storage: imagens importadas dos orçamentos', () => {
  it('converte caminho simples do produto em URL pública', () => {
    expect(resolveProductImageDisplayUrl('product-123.jpg')).toBe(
      'https://project.supabase.co/storage/v1/object/public/product-images/product-123.jpg'
    );
  });

  it('reconhece o bucket legado de imagens dos orçamentos', () => {
    expect(resolveProductImageDisplayUrl('quote-product-images/antiga.png')).toBe(
      'https://project.supabase.co/storage/v1/object/public/quote-product-images/antiga.png'
    );
  });

  it('mantém data URL e corrige endereço http antigo', () => {
    expect(resolveProductImageDisplayUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveProductImageDisplayUrl('http://cdn.exemplo.com/item.jpg')).toBe(
      'https://cdn.exemplo.com/item.jpg'
    );
  });
});

/* ---------- Achados críticos: comprovantes financeiros e imagens ---------- */

const canReadFinanceReceipt = (
  role: string | null,
  uid: string | null,
  name: string,
  owner: string | null = null
) => {
  if (!uid) return false; // anon sempre negado (bucket privado, policy só authenticated)
  if (role && ['admin', 'financeiro'].includes(role)) return true;
  return owner === uid || name.startsWith(`expense-advance-receipts/${uid}-`);
};

const canWriteFinanceReceipt = (role: string | null, uid: string | null, name: string) =>
  !!uid &&
  isSafeStoragePath(name, RECEIPT_EXTENSIONS) &&
  ((!!role && ['admin', 'financeiro'].includes(role)) ||
    name.startsWith(`expense-advance-receipts/${uid}-`));

const canReadExpenseReceipt = (
  role: string | null,
  uid: string | null,
  name: string,
  owner: string | null = null
) => {
  if (!uid) return false;
  if (role && ['admin', 'financeiro'].includes(role)) return true;
  return owner === uid || name.startsWith(`${uid}/`);
};

const canDeleteFinanceReceipt = (role: string | null, uid: string | null) =>
  !!uid && !!role && ['admin', 'financeiro'].includes(role);

const canReadPublicImage = () => true; // logos e equipment-images seguem com leitura pública
const canWriteImageBucket = (role: string | null, uid: string | null, name: string) =>
  !!uid && !!role && ['admin', 'deposito'].includes(role) && isSafeStoragePath(name, IMAGE_EXTENSIONS);
const canMutateImageBucket = (
  role: string | null,
  uid: string | null,
  owner: string | null
) =>
  !!uid &&
  !!role &&
  ['admin', 'deposito'].includes(role) &&
  (owner === null || owner === uid || role === 'admin');

describe('storage: comprovantes financeiros (receipts / expense-receipts)', () => {
  it('nega qualquer acesso anônimo', () => {
    expect(canReadFinanceReceipt(null, null, 'expense-advance-receipts/u1-1.jpeg')).toBe(false);
    expect(canWriteFinanceReceipt(null, null, 'expense-advance-receipts/u1-1.jpeg')).toBe(false);
    expect(canReadExpenseReceipt(null, null, 'u1/1.jpg')).toBe(false);
    expect(canDeleteFinanceReceipt(null, null)).toBe(false);
  });

  it('permite admin e financeiro e nega demais papéis alheios', () => {
    expect(canReadFinanceReceipt('admin', 'u9', 'expense-advance-receipts/u1-1.jpeg')).toBe(true);
    expect(canReadFinanceReceipt('financeiro', 'u9', 'expense-advance-receipts/u1-1.jpeg')).toBe(true);
    expect(canReadFinanceReceipt('funcionario', 'u9', 'expense-advance-receipts/u1-1.jpeg')).toBe(false);
    expect(canReadFinanceReceipt('deposito', 'u9', 'expense-advance-receipts/u1-1.jpeg')).toBe(false);
  });

  it('isola por dono (prefixo do uid ou owner)', () => {
    expect(canReadFinanceReceipt('funcionario', 'u1', 'expense-advance-receipts/u1-1.jpeg')).toBe(true);
    expect(canReadFinanceReceipt('funcionario', 'u2', 'expense-advance-receipts/u1-1.jpeg', 'u2')).toBe(true);
    expect(canReadExpenseReceipt('funcionario', 'u1', 'u1/10.jpg')).toBe(true);
    expect(canReadExpenseReceipt('funcionario', 'u2', 'u1/10.jpg')).toBe(false);
  });

  it('exige caminho seguro e extensão válida no upload', () => {
    expect(canWriteFinanceReceipt('funcionario', 'u1', 'expense-advance-receipts/u1-1.pdf')).toBe(true);
    expect(canWriteFinanceReceipt('funcionario', 'u1', 'expense-advance-receipts/u1-1.exe')).toBe(false);
    expect(canWriteFinanceReceipt('admin', 'u1', '../../etc/passwd.pdf')).toBe(false);
    expect(canWriteFinanceReceipt('funcionario', 'u1', 'expense-advance-receipts/u2-1.pdf')).toBe(false);
  });

  it('somente admin/financeiro excluem comprovantes', () => {
    expect(canDeleteFinanceReceipt('financeiro', 'u1')).toBe(true);
    expect(canDeleteFinanceReceipt('funcionario', 'u1')).toBe(false);
  });
});

describe('storage: logos e equipment-images', () => {
  it('mantém leitura pública para impressões e documentos', () => {
    expect(canReadPublicImage()).toBe(true);
  });

  it('somente admin/deposito escrevem, com extensão de imagem', () => {
    expect(canWriteImageBucket('admin', 'u1', 'logo-1.png')).toBe(true);
    expect(canWriteImageBucket('deposito', 'u1', 'equip-1.webp')).toBe(true);
    expect(canWriteImageBucket('financeiro', 'u1', 'logo-1.png')).toBe(false);
    expect(canWriteImageBucket(null, null, 'logo-1.png')).toBe(false);
    expect(canWriteImageBucket('admin', 'u1', 'logo-1.svg')).toBe(false);
  });

  it('respeita proprietário em update/delete, com admin sobrepondo', () => {
    expect(canMutateImageBucket('deposito', 'u1', null)).toBe(true);
    expect(canMutateImageBucket('deposito', 'u1', 'u1')).toBe(true);
    expect(canMutateImageBucket('deposito', 'u2', 'u1')).toBe(false);
    expect(canMutateImageBucket('admin', 'u2', 'u1')).toBe(true);
  });
});

describe('storage: detecção de bucket e URLs legadas de comprovantes', () => {
  it('detecta bucket a partir de URL pública legada e caminho puro', () => {
    expect(
      detectReceiptBucket(
        'https://x.supabase.co/storage/v1/object/public/receipts/expense-advance-receipts/u1-1.jpeg'
      )
    ).toBe(FINANCE_RECEIPT_BUCKET);
    expect(
      detectReceiptBucket('https://x.supabase.co/storage/v1/object/public/expense-receipts/u1/1.jpg')
    ).toBe(EXPENSE_RECEIPT_BUCKET);
    expect(detectReceiptBucket('expense-advance-receipts/u1-1.jpeg')).toBe(FINANCE_RECEIPT_BUCKET);
    expect(detectReceiptBucket('receipts/u1-1.pdf')).toBe(RECEIPT_BUCKET);
    expect(detectReceiptBucket('https://cdn.externo.com/a.jpg')).toBeNull();
  });

  it('extrai o caminho dos buckets financeiros', () => {
    expect(
      extractStoragePath(
        'https://x.supabase.co/storage/v1/object/public/receipts/expense-advance-receipts/u1-1.jpeg',
        FINANCE_RECEIPT_BUCKET
      )
    ).toBe('expense-advance-receipts/u1-1.jpeg');
    expect(extractStoragePath('u1/1.jpg', EXPENSE_RECEIPT_BUCKET)).toBe('u1/1.jpg');
  });
});

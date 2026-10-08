import { describe, expect, it } from 'vitest';
import { normalizeLineTapeBrand } from '@/lib/brand';

describe('marca LINE TAPE', () => {
  it('remove o nome antigo completo de dados históricos', () => {
    expect(normalizeLineTapeBrand('Letra 3D line tape ILUMINAÇÃO E LOCAÇÃO LTDA')).toBe(
      'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA',
    );
  });

  it('remove a expressão antiga isolada', () => {
    expect(normalizeLineTapeBrand('Empresa Letra 3D Serviços')).toBe('Empresa Serviços');
  });

  it('mantém o nome atual', () => {
    expect(normalizeLineTapeBrand('LINE TAPE')).toBe('LINE TAPE');
  });
});


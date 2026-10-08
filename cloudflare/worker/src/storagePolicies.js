// Regras de acesso aos arquivos, traduzidas das políticas de storage.objects
// do banco real (Supabase "sistema line tape 2026").
//
// op: 'select' | 'insert' | 'update' | 'delete'
// name: caminho do arquivo dentro do bucket; owner: quem enviou (ou null).
//
// Diferença proposital em relação ao original: os buckets company_files
// (anexos da planilha de gastos) e worker-photos (foto do diarista) não têm
// regra de envio no original, então o envio falhava para todos. Aqui o envio
// é liberado para administrador e financeiro, os perfis que usam essas telas.

const IMG = ['jpg', 'jpeg', 'png', 'webp'];
const DOC = ['pdf', ...IMG];

/** storage_path_is_safe(name, exts) */
export function pathIsSafe(name, exts) {
  if (!name || name.length > 300) return false;
  if (name.includes('..') || name.startsWith('/') || name.includes('//') || name.includes('\\')) return false;
  const clean = name.split('?')[0].split('#')[0];
  const i = clean.lastIndexOf('.');
  const ext = i === -1 ? '' : clean.slice(i + 1).toLowerCase();
  return exts.includes(ext);
}

export function storageAllowed(ctx, op, bucket, name, owner) {
  if (ctx.service) return true;
  const uid = ctx.uid;
  const any = (...roles) => !!uid && roles.some((r) => ctx.roles?.has(r));
  const fin = () => any('admin', 'financeiro');
  const starts = (p) => name.startsWith(p);
  const mine = () => !!uid && owner === uid;
  const ownOrNullOrAdmin = () => owner == null || mine() || any('admin');

  switch (bucket) {
    case 'product-images':
    case 'equipment-images':
    case 'logos': {
      if (op === 'select') return true;
      const staff = any('admin', 'deposito');
      if (op === 'insert') return staff && pathIsSafe(name, IMG);
      if (op === 'update') return staff && ownOrNullOrAdmin() && pathIsSafe(name, IMG);
      return staff && ownOrNullOrAdmin(); // delete
    }
    case 'quote-product-images':
      return op === 'select' ? true : !!uid;
    case 'budget-pdfs':
      // leitura pública; gravação só pelas funções do servidor
      return op === 'select';
    case 'company_files':
    case 'worker-photos':
      return op === 'select' ? true : fin();
    case 'expense-receipts': {
      const own = !!uid && starts(`${uid}/`);
      if (op === 'select') return fin() || mine() || own;
      if (op === 'insert') return pathIsSafe(name, DOC) && (fin() || own);
      if (op === 'update') return fin() && pathIsSafe(name, DOC);
      return fin();
    }
    case 'fiscal-documents': {
      if (op === 'select') return fin();
      if (op === 'insert' || op === 'update') return fin() && pathIsSafe(name, ['xml', 'pdf']);
      return any('admin');
    }
    case 'receipts': {
      const ownAdvance = !!uid && starts(`expense-advance-receipts/${uid}-`);
      const transport = starts('interstate-transports/');
      const ownTransport = !!uid && starts(`interstate-transports/${uid}-`);
      if (op === 'select') return fin() || mine() || ownAdvance || (transport && ownTransport);
      if (op === 'insert') {
        if (!pathIsSafe(name, DOC)) return false;
        return fin() || ownAdvance || (transport && any('deposito', 'funcionario') && ownTransport);
      }
      if (op === 'update') return fin() && pathIsSafe(name, DOC);
      return fin();
    }
    case 'nfse-certificates':
      return any('admin');
    case 'whatsapp-receipts':
      return op === 'select' ? fin() : false;
    case 'worker-receipts': {
      const own = !!uid && starts(`receipts/${uid}-`);
      if (op === 'select') return fin() || mine() || own;
      if (op === 'insert') return pathIsSafe(name, DOC) && (fin() || own);
      if (op === 'update') return (fin() || mine() || own) && pathIsSafe(name, DOC) && (fin() || own);
      return fin();
    }
    default:
      return !!uid;
  }
}

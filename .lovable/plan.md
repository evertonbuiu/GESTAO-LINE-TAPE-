# Correção dos 3 achados críticos de Storage

## Diagnóstico (auditoria somente leitura)

Buckets hoje:

| Bucket | public | limite | MIME | objetos |
|---|---|---|---|---|
| receipts | **true** | nenhum | nenhum | 16 (todos com owner) |
| expense-receipts | **true** | nenhum | nenhum | 0 |
| logos | true | nenhum | nenhum | 1 |
| equipment-images | true | nenhum | nenhum | 4 |
| worker-receipts / nfse-certificates | false | — | — | já protegidos |

Policies problemáticas em `storage.objects` (todas com role `public`, sem checagem de login):

- `Public access to receipts` (SELECT) + `Authenticated users can upload/update/delete receipts` — apenas testam `bucket_id`. Qualquer pessoa da internet lê, envia, sobrescreve e apaga comprovantes financeiros. → achados 1 e 3.
- `Authenticated users can upload/update/delete logos` e `... equipment-images` — idem, sem exigir autenticação nem papel. → achado 2.
- `expense-receipts` é público mas não tem policy de escrita; a leitura pública ainda expõe comprovantes por URL pública.

Uso no frontend:
- `DailyRates.tsx`: envia para `receipts` em `expense-advance-receipts/<uid>-<ts>.<ext>` e grava a **URL pública** no banco; exibe via `openReceipt` → `resolveReceiptDisplayUrl`.
- `FixedExpenses.tsx`: envia para `expense-receipts` em `<uid>/<ts>.<ext>` e já visualiza com URL assinada.
- `Logo.tsx`/`useLogo`/`Settings.tsx`/`EventEquipment.tsx`: leitura pública de `logos` (usada em telas e impressões).
- `Equipment.tsx`/`Rentals.tsx`/`import-budget`: leitura pública de `equipment-images` (usada em impressão/PDF de orçamentos).
- `ExpenseSpreadsheet.tsx` usa `company_files` (fora destes 3 alertas, mantido como está).

Funções SECURITY DEFINER já existentes e reutilizadas: `current_user_has_any_role(text[])`, `is_current_user_admin()`, `storage_path_is_safe(text, text[])`.

## Decisão de acesso mínimo

- `receipts` e `expense-receipts` → **privados**. Leitura só admin/financeiro ou dono do arquivo (owner ou prefixo do próprio uid). Nunca URL pública; exibição por URL assinada de 1 hora.
- `logos` e `equipment-images` → **leitura pública mantida** (necessária para documentos/impressões). Escrita/alteração/exclusão só `admin`/`deposito`, com dono quando houver, caminho seguro e extensão de imagem.
- Nenhum arquivo é movido ou apagado; URLs legadas continuam resolvendo (o app converte URL pública antiga em caminho e assina).

## SQL da migração (idempotente, restritiva, sem DELETE/backfill)

```sql
-- 1) Remover policies permissivas (role public / sem checagem)
DROP POLICY IF EXISTS "Public access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete equipment-images" ON storage.objects;

-- 2) receipts: privado, admin/financeiro ou dono
CREATE POLICY receipts_select_finance_or_owner ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='receipts' AND (current_user_has_any_role(ARRAY['admin','financeiro'])
  OR owner = auth.uid() OR name LIKE 'expense-advance-receipts/'||auth.uid()::text||'-%'));

CREATE POLICY receipts_insert_finance_or_owner ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='receipts'
  AND storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (current_user_has_any_role(ARRAY['admin','financeiro'])
       OR name LIKE 'expense-advance-receipts/'||auth.uid()::text||'-%'));

CREATE POLICY receipts_update_finance ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='receipts' AND current_user_has_any_role(ARRAY['admin','financeiro']))
WITH CHECK (bucket_id='receipts' AND current_user_has_any_role(ARRAY['admin','financeiro'])
  AND storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp']));

CREATE POLICY receipts_delete_finance ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='receipts' AND current_user_has_any_role(ARRAY['admin','financeiro']));

-- 3) expense-receipts: mesma regra, prefixo <uid>/
CREATE POLICY expense_receipts_select_finance_or_owner ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='expense-receipts' AND (current_user_has_any_role(ARRAY['admin','financeiro'])
  OR owner = auth.uid() OR name LIKE auth.uid()::text||'/%'));

CREATE POLICY expense_receipts_insert_finance_or_owner ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='expense-receipts'
  AND storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
  AND (current_user_has_any_role(ARRAY['admin','financeiro']) OR name LIKE auth.uid()::text||'/%'));

CREATE POLICY expense_receipts_update_finance ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='expense-receipts' AND current_user_has_any_role(ARRAY['admin','financeiro']))
WITH CHECK (bucket_id='expense-receipts' AND current_user_has_any_role(ARRAY['admin','financeiro'])
  AND storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp']));

CREATE POLICY expense_receipts_delete_finance ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='expense-receipts' AND current_user_has_any_role(ARRAY['admin','financeiro']));

-- 4) logos e equipment-images: leitura pública, escrita admin/deposito
CREATE POLICY logos_public_read ON storage.objects FOR SELECT USING (bucket_id='logos');
CREATE POLICY logos_insert_admin_stock ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='logos' AND current_user_has_any_role(ARRAY['admin','deposito'])
  AND storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp','svg']));
CREATE POLICY logos_update_admin_stock ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='logos' AND current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR is_current_user_admin()))
WITH CHECK (bucket_id='logos' AND current_user_has_any_role(ARRAY['admin','deposito'])
  AND storage_path_is_safe(name, ARRAY['jpg','jpeg','png','webp','svg']));
CREATE POLICY logos_delete_admin_stock ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='logos' AND current_user_has_any_role(ARRAY['admin','deposito'])
  AND (owner IS NULL OR owner = auth.uid() OR is_current_user_admin()));

-- (mesmo bloco para equipment-images, extensões jpg/jpeg/png/webp)
```

Além do SQL, os buckets `receipts` e `expense-receipts` passam a privados pela ferramenta de storage (não por SQL), com o mesmo efeito de bloquear URL pública.

## Frontend após aprovação

- `src/lib/storageUrls.ts`: adicionar `FINANCE_RECEIPT_BUCKET = 'receipts'` e `EXPENSE_RECEIPT_BUCKET = 'expense-receipts'`; `resolveReceiptDisplayUrl` passa a detectar e assinar (1h) também esses buckets, mantendo compatibilidade com URLs públicas legadas.
- `src/components/DailyRates.tsx`: parar de gravar URL pública de `receipts`; validar MIME/tamanho no upload e salvar o caminho do objeto.
- `src/components/FixedExpenses.tsx`: validar MIME/tamanho e usar TTL de 1 hora na URL assinada.

## Testes

Ampliar `src/test/security/storagePolicies.test.ts` com: anon negado em leitura/escrita de comprovantes; matriz de papéis (admin/financeiro/funcionario/deposito) por bucket; isolamento entre donos; MIME/tamanho/extensão/path traversal; assinatura de URLs (inclusive URL pública legada) e regressão de exibição de logo/imagens de equipamento.

Depois: typecheck, suíte completa, build e nova verificação de segurança. Sem publicar.

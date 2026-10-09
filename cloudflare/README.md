# GESTÃO LINE TAPE no Cloudflare

Esta pasta tem tudo o que o sistema precisa para rodar fora do Lovable e do Supabase:

- **Worker** (`worker/`): o servidor. Responde nos mesmos endereços do Supabase, então as telas do app funcionam sem mudanças.
  - Login próprio (usuário e senha, com os mesmos perfis: admin, financeiro, funcionário, depósito).
  - Dados no **Cloudflare D1**: 81 tabelas iguais às de hoje.
  - Arquivos (logos, fotos, comprovantes, PDFs, certificado) no **Cloudflare R2**.
  - **135 regras automáticas** reescritas a partir das originais: saldos bancários, lançamentos de vales e adiantamentos, despesas fixas, estoque, manutenção, diárias, totais de eventos, financeiro, contratos, documentos fiscais e auditoria.
  - **Permissões por perfil** iguais às do banco atual.
  - As **16 funções de servidor** (NFS-e, C6, Pluggy, WhatsApp, PDFs, usuários, orçamentos e documentos fiscais) com o código original.
- **Telas** (a raiz do repositório): o mesmo app React, publicado no **Cloudflare Pages**.

---

## Passo a passo para colocar no ar

Tudo é feito pelo painel do Cloudflare (https://dash.cloudflare.com), sem instalar nada no computador.

### 1. Criar a conta e os recursos

1. Crie uma conta gratuita no Cloudflare.
2. **Banco de dados:** menu *Storage & Databases → D1 → Create database*.
   - Nome: `gestao-line-tape`
   - Depois de criado, copie o **Database ID**.
3. **Arquivos:** menu *R2 → Create bucket*.
   - Nome: `gestao-line-tape-arquivos`
   - O R2 pode pedir um cartão para ativar. O uso de uma empresa do seu porte costuma ficar dentro da faixa gratuita.
4. No GitHub, abra `cloudflare/worker/wrangler.toml` e troque `COLE_AQUI_O_ID_DO_BANCO_D1` pelo ID copiado. Se preferir, mande o ID e eu faço a troca.

### 2. Publicar o servidor (Worker)

1. Menu *Workers & Pages → Create → Workers → Import a repository*.
2. Conecte o GitHub e escolha o repositório **GESTAO-LINE-TAPE-**.
3. Configure:
   - **Root directory:** `cloudflare/worker`
   - **Build command:** `npm install`
   - **Deploy command:** `npm run deploy` (cria as tabelas e as regras e publica o servidor)
4. Depois do primeiro deploy, vá em *Settings → Variables and Secrets* e cadastre os **segredos**:

| Nome | O que colocar |
|---|---|
| `JWT_SECRET` | um texto longo e aleatório (mínimo de 32 caracteres) |
| `SETUP_TOKEN` | qualquer senha temporária, usada só no passo 3 |
| `SERVICE_ROLE_KEY` | outro texto longo e aleatório |

5. Ainda em variáveis, preencha `PUBLIC_API_URL` com o endereço do Worker (aparece no topo da página do Worker, algo como `https://gestao-line-tape-api.SUA-CONTA.workers.dev`).

### 3. Criar o primeiro administrador

Abra no navegador: `https://ENDEREÇO-DO-WORKER/setup`

Informe o `SETUP_TOKEN`, seu nome, um usuário e uma senha. Isso só funciona enquanto não existe nenhum usuário. Os demais funcionários você cria depois, pela tela de usuários do sistema, como hoje.

### 4. Publicar as telas (Pages)

1. Menu *Workers & Pages → Create → Pages → Connect to Git*. Escolha o mesmo repositório.
2. Configure:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Variável de ambiente:** `VITE_API_URL` = endereço do Worker (o mesmo do passo 2.5)
3. Ao terminar, o sistema fica em um endereço como `https://gestao-line-tape.pages.dev`. Também dá para ligar um domínio próprio.
4. **Segurança:** volte ao Worker e troque `ALLOWED_ORIGINS` de `*` para o endereço do Pages.

### 5. Integrações (opcional, uma por vez)

| Integração | O que configurar no Worker |
|---|---|
| **NFS-e** (Goiânia e Nacional) | segredo `NFSE_CERT_PASSWORD`; o arquivo .pfx é enviado pela tela de configuração de NFS-e do sistema |
| **Banco C6** | segredos `C6_CLIENT_ID` e `C6_CLIENT_SECRET`; variável `C6_API_ENV` (`sandbox` ou `production`); certificado mTLS (veja `wrangler.toml`) |
| **Pluggy** | segredos `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` |
| **WhatsApp** | segredos `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` e `OPENAI_API_KEY`; no painel da Meta, troque a URL do webhook para `https://ENDEREÇO-DO-WORKER/functions/v1/whatsapp-webhook` |

---

## Diferenças em relação ao sistema atual

- **Atualização automática das telas:** no lugar do Supabase Realtime, o app consulta o servidor a cada 4 segundos. O efeito é o mesmo.
- **Mensagens de erro das regras** têm o mesmo texto, mas sem os valores variáveis. Exemplo: "Transição de status inválida." em vez de "Transição de status inválida: pago -> rascunho".
- **Busca sem diferenciar maiúsculas** (filtros "contém") não iguala letras acentuadas maiúsculas e minúsculas, como "É" e "é".
- **Correções feitas na cópia:**
  - O original não recalculava o saldo da conta antiga quando um lançamento mudava de conta. A cópia recalcula as duas.
  - O mesmo vale para o total do evento antigo quando uma despesa muda de evento.
  - Duas permissões antigas deixavam qualquer pessoa, **mesmo sem login**, ler e alterar usuários e perfis (`user_credentials` e `user_roles`). Elas não foram copiadas.
- **Regras e permissões conferidas com o banco real** (Supabase "sistema line tape 2026", lido em 08/10/2026):
  - As regras automáticas são as 104 que existem lá (`rules/active_triggers.json`), não as 152 do histórico de migrações. Saíram, por exemplo, a baixa de estoque duplicada e as três regras repetidas do vale de colaborador, que faziam o cadastro de vale falhar.
  - As permissões das tabelas vêm de `rules/real_policies.json` (lidas de `pg_policies`).
  - As permissões dos arquivos seguem as do banco real (`worker/src/storagePolicies.js`): certificado digital só para administrador, comprovantes só para financeiro/administrador ou para quem enviou, e assim por diante.
  - Como no original, marcar um evento como pago não lança no financeiro na hora: o lançamento aparece quando a sincronização roda (ícone de sincronizar no saldo da Gestão financeira).
  - Melhoria: no original ninguém conseguia enviar arquivos para `company_files` (anexos da planilha de gastos) e `worker-photos` (foto do diarista), porque faltava a permissão. Na cópia, administrador e financeiro podem.
- **Regras de valor único e validações:** a cópia segue o banco real. Algumas regras do histórico de migrações (lançamento bancário único por origem, número de orçamento único, um pagamento de despesa fixa e um salário por mês, e 8 validações de status/mês) não existem no Supabase atual e foram retiradas (`worker/migrations/0006_align_constraints.sql`).

## Importação dos dados do Supabase

Feita em 08/10/2026 com `src/importer.js` (rota `/import/*`): o próprio Supabase envia as linhas (extensão pg_net) para uma área de espera; a gravação acontece com as regras automáticas desligadas, na ordem das chaves estrangeiras, e as regras são religadas no fim. Os arquivos públicos são baixados direto do Supabase. Usuários entram sem senha (o Supabase guarda senhas em bcrypt, pesado demais para o plano gratuito do Workers): o administrador define uma nova senha na tela Usuários.

## Para quem for mexer no código

- `tools/replay_migrations.py`: lê as 307 migrações do Supabase e monta o modelo final do banco.
- `tools/gen_d1_schema.py`: gera `worker/migrations/0001_schema.sql` (tabelas do D1).
- `tools/gen_policies.py`: gera as permissões por perfil.
- `tools/gen_rules.py` + `rules/functions.py`: geram `worker/migrations/0002_rules.sql` (regras automáticas).
- `tools/port_functions.py`: copia as funções de `supabase/functions` para `worker/src/edge`.
- Testes: `cd cloudflare/worker && npm test` (precisa do Node 22.6 ou mais novo).

As listas reais ficam em `rules/active_triggers.json` (regras automáticas) e `rules/real_policies.json` (permissões). Depois de mudar uma delas, rode `python3 cloudflare/tools/gen_rules.py` e `python3 cloudflare/tools/gen_policies.py`. Para um banco D1 que já está no ar, as diferenças de regras entram por uma migração nova (ver `worker/migrations/0004_real_triggers.sql`).

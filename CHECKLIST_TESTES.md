# ✅ Checklist de Testes do Sistema Line Tape

> **Data de Criação:** 30/01/2026  
> **Objetivo:** Verificar funcionamento de todas as funcionalidades do sistema

---

## 📊 1. DASHBOARD
- [ ] Dashboard carrega corretamente
- [ ] Cards de resumo exibem valores corretos
- [ ] Gráficos renderizam sem erros
- [ ] Navegação para outros módulos funciona

---

## 🔧 2. EQUIPAMENTOS
- [ ] Listagem de equipamentos carrega
- [ ] Adicionar novo equipamento
- [ ] Editar equipamento existente
- [ ] Excluir equipamento
- [ ] Filtrar por categoria
- [ ] Buscar por nome
- [ ] Upload de imagem do equipamento
- [ ] Upload de PDF de orçamento

---

## 📦 3. INVENTÁRIO / PATRIMÔNIO
- [ ] Listagem de itens carrega
- [ ] Adicionar novo item ao patrimônio
- [ ] Editar item existente
- [ ] Excluir item
- [ ] Filtrar por categoria
- [ ] Filtrar por condição
- [ ] Gerar relatório de patrimônio (PDF)

---

## 📅 4. LOCAÇÕES / EVENTOS
- [ ] Listagem de eventos carrega
- [ ] Criar novo evento
- [ ] Editar evento existente
- [ ] Excluir evento
- [ ] Marcar evento como pago (pagamento total)
- [ ] Marcar evento como pago (entrada/sinal)
- [ ] Marcar pagamento restante como pago
- [ ] Vincular equipamentos ao evento
- [ ] Vincular colaboradores ao evento
- [ ] Adicionar despesas ao evento
- [ ] Visualizar orçamento do evento

---

## 📝 5. ORÇAMENTOS (LineTapeQuoteSystem)
- [ ] Listagem de orçamentos carrega
- [ ] Criar novo orçamento
- [ ] Adicionar produtos ao orçamento
- [ ] Calcular subtotal, desconto e total
- [ ] Aplicar taxa de nota fiscal
- [ ] Editar orçamento existente
- [ ] **Sincronização com evento ao editar** (dados atualizados)
- [ ] Gerar PDF do orçamento
- [ ] Criar evento a partir do orçamento
- [ ] Excluir orçamento

---

## 📄 6. CONTRATOS
- [ ] Listagem de contratos carrega
- [ ] Criar novo contrato
- [ ] Editar contrato existente
- [ ] Assinar contrato (assinatura digital)
- [ ] Gerar PDF do contrato
- [ ] Excluir contrato

---

## 👥 7. CLIENTES
- [ ] Listagem de clientes carrega
- [ ] Adicionar novo cliente
- [ ] Editar cliente existente
- [ ] Excluir cliente
- [ ] Buscar cliente por nome
- [ ] Visualizar detalhes do cliente (dialog)
- [ ] Adicionar adiantamento ao cliente
- [ ] Adicionar item personalizado ao cliente

---

## 👷 8. COLABORADORES
- [ ] Listagem de colaboradores carrega
- [ ] Adicionar novo colaborador
- [ ] Editar colaborador existente
- [ ] Excluir colaborador
- [ ] Registrar pagamento de colaborador
- [ ] Registrar adiantamento de colaborador
- [ ] Registrar adiantamento de despesa
- [ ] Registrar diária de alimentação
- [ ] Vincular pagamentos a conta bancária

---

## 💵 9. DIÁRIAS (DIARISTAS)
- [ ] Listagem de diárias carrega
- [ ] Adicionar nova diária
- [ ] Editar diária existente
- [ ] Excluir diária
- [ ] Registrar vale/adiantamento
- [ ] Registrar notinha (adiantamento de despesa)
- [ ] Registrar auxílio alimentação
- [ ] Vincular diária a evento
- [ ] Vincular a conta bancária
- [ ] Exclusão em lote funciona

---

## 💰 10. CONTROLE FINANCEIRO (FinancialManagement)

### 10.1 Fluxo de Caixa
- [ ] Listagem de lançamentos carrega
- [ ] Adicionar lançamento manual (entrada)
- [ ] Adicionar lançamento manual (saída)
- [ ] Editar lançamento manual
- [ ] Excluir lançamento
- [ ] **Exclusão em lote funciona**
- [ ] Filtrar por período (mês/ano)
- [ ] Filtrar por conta bancária
- [ ] Buscar por descrição
- [ ] **Totais (Receita/Despesa/Saldo) atualizam após exclusão**

### 10.2 Contas Bancárias
- [ ] Listagem de contas carrega
- [ ] Criar nova conta bancária
- [ ] Editar conta bancária
- [ ] Excluir conta bancária
- [ ] **Saldo calculado corretamente (transações + eventos)**
- [ ] Visualizar extrato da conta

### 10.3 Sincronização de Extrato
- [ ] Importar extrato Excel (Itaú)
- [ ] Importar extrato Excel (C6 Bank)
- [ ] Categorizar transações importadas
- [ ] Vincular a evento/despesa/colaborador
- [ ] Conciliação bancária funciona

### 10.4 Transferência entre Contas
- [ ] Transferir valores entre contas
- [ ] Saldos atualizam após transferência

---

## 📊 11. DASHBOARD FINANCEIRO
- [ ] Dashboard carrega corretamente
- [ ] **Saldo Total igual ao Controle Financeiro**
- [ ] Total de Receitas correto
- [ ] Total de Despesas correto
- [ ] Gráficos de receita vs despesa
- [ ] Lista de eventos pendentes
- [ ] Lista de despesas atrasadas

---

## 📈 12. RELATÓRIO DE CONTAS (AccountsReport)
- [ ] Relatório carrega
- [ ] Filtrar por período
- [ ] Dados de receita corretos
- [ ] Dados de despesa corretos
- [ ] Gerar PDF do relatório
- [ ] Gerar Excel do relatório

---

## 🔄 13. DESPESAS FIXAS / RECORRENTES
- [ ] Listagem de despesas fixas carrega
- [ ] Criar nova despesa fixa
- [ ] Editar despesa fixa
- [ ] Excluir despesa fixa
- [ ] Marcar mês como pago
- [ ] Vincular pagamento a conta bancária
- [ ] Visualizar calendário de pagamentos
- [ ] **Sincronização com bank_transactions (trigger)**

---

## 🏢 14. GASTOS DA EMPRESA
- [ ] Listagem de gastos carrega
- [ ] Adicionar novo gasto
- [ ] Editar gasto existente
- [ ] Excluir gasto
- [ ] Vincular a conta bancária
- [ ] Marcar como pago
- [ ] Upload de comprovante

---

## 🚚 15. TRANSPORTE INTERESTADUAL
- [ ] Listagem de transportes carrega
- [ ] Criar novo transporte
- [ ] Editar transporte existente
- [ ] Excluir transporte
- [ ] Adicionar lista de equipamentos
- [ ] Adicionar lista de materiais
- [ ] Registrar retorno

---

## 🔧 16. MANUTENÇÃO
- [ ] Listagem de manutenções carrega
- [ ] Criar nova manutenção
- [ ] Editar manutenção existente
- [ ] Excluir manutenção
- [ ] Filtrar por status
- [ ] Filtrar por prioridade
- [ ] Marcar como concluída

---

## 💳 17. CARTÕES BANCÁRIOS
- [ ] Listagem de cartões carrega
- [ ] Criar novo cartão
- [ ] Editar cartão existente
- [ ] Excluir cartão
- [ ] Registrar transação no cartão
- [ ] Visualizar limite disponível

---

## 👤 18. GESTÃO DE USUÁRIOS
- [ ] Listagem de usuários carrega
- [ ] Criar novo usuário
- [ ] Editar usuário existente
- [ ] Desativar/Ativar usuário
- [ ] Alterar senha de usuário
- [ ] Definir permissões

---

## ⚙️ 19. CONFIGURAÇÕES
- [ ] Página de configurações carrega
- [ ] Editar dados da empresa
- [ ] Upload de logo da empresa
- [ ] Alterar cores do tema
- [ ] Salvar configurações

---

## 🎨 20. TEMA / APARÊNCIA
- [ ] Toggle de tema claro/escuro funciona
- [ ] Tema persiste após reload
- [ ] Configurações de tema do usuário

---

## 📱 21. WHATSAPP
- [ ] Página de mensagens carrega
- [ ] Visualizar mensagens recebidas
- [ ] Webhook funcionando

---

## 🔐 22. AUTENTICAÇÃO
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Proteção de rotas (ProtectedRoute)
- [ ] Redirecionamento para login quando não autenticado

---

## 🔄 23. INTEGRAÇÕES E SINCRONIZAÇÕES

### Sincronização Orçamento → Evento
- [ ] Editar orçamento vinculado atualiza evento
- [ ] Produtos do orçamento atualizam event_budgets
- [ ] Dados do cliente sincronizam

### Sincronização Pagamentos → bank_transactions
- [ ] Pagamento de evento gera transação bancária
- [ ] Despesa paga gera transação bancária
- [ ] Despesa fixa paga gera transação (via trigger)

### Exclusão em Cascata
- [ ] Excluir despesa remove bank_transaction vinculada
- [ ] Excluir diária remove registros financeiros vinculados
- [ ] Excluir evento remove despesas e transações vinculadas

---

## 📋 RESUMO DOS TESTES

| Módulo | Status | Observações |
|--------|--------|-------------|
| Dashboard | ⬜ | |
| Equipamentos | ⬜ | |
| Inventário | ⬜ | |
| Eventos/Locações | ⬜ | |
| Orçamentos | ⬜ | |
| Contratos | ⬜ | |
| Clientes | ⬜ | |
| Colaboradores | ⬜ | |
| Diárias | ⬜ | |
| Controle Financeiro | ⬜ | |
| Dashboard Financeiro | ⬜ | |
| Relatório de Contas | ⬜ | |
| Despesas Fixas | ⬜ | |
| Gastos Empresa | ⬜ | |
| Transporte | ⬜ | |
| Manutenção | ⬜ | |
| Cartões | ⬜ | |
| Usuários | ⬜ | |
| Configurações | ⬜ | |
| Tema | ⬜ | |
| WhatsApp | ⬜ | |
| Autenticação | ⬜ | |
| Sincronizações | ⬜ | |

---

## 🐛 BUGS ENCONTRADOS

| # | Módulo | Descrição | Severidade | Status |
|---|--------|-----------|------------|--------|
| 1 | | | | |
| 2 | | | | |

---

## 📝 NOTAS DO TESTADOR

```
Data do teste: ___/___/______
Testador: ________________
Ambiente: Produção / Teste
Navegador: ________________
```

---

**Legenda:**
- ⬜ Não testado
- ✅ Passou
- ❌ Falhou
- ⚠️ Passou com ressalvas

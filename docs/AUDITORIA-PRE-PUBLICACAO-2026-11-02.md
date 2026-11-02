# OLIVER Caixinha — auditoria antes da publicação (02/11/2026)

**Estado: NÃO PUBLICAR.** Revisão preparatória em `fix/admin-audit-finance-chat-20261102`, sem alterações na Production, sem lançamentos, sem atualizações em cotistas e sem créditos retroativos.

## Regras recebidas

### Juros de empréstimo próprio
Juros contratuais: 25% do principal. Distribuição sobre o **principal**: 10% para a administração; 10% para a divisão proporcional por cota (inclui a cota virtual administrativa); 5% exclusivo para o tomador que também recebe a sua participação normal nas cotas reais, caso elegível. A cota virtual NÃO equivale a cotista real, aporte nem mensalidade.

Exemplo Day: R$ 500,00 principal; R$ 125,00 juros. R$ 50,00 taxa ADM; R$ 50,00 base de cotas reais + virtual; R$ 25,00 benefício do tomador. Se houver 11 cotas reais e 1 virtual: cada cota real R$ 4,16, virtual R$ 4,24 (inclui 8 centavos de arredondamento); total ADM R$ 54,24; Day com 1 cota real recebe R$ 29,16 (R$ 25,00 + R$ 4,16). Total entre administração, cotas reais e bônus = R$ 125,00.

### Passeio ônibus
Lucro **corrigido de R$ 1.450,00 para R$ 1.350,00**. Administração: taxa de R$ 135,00 (10%). Base de cotas: R$ 1.215,00, divididos proporcionalmente entre cotas reais elegíveis **mais a cota virtual administrativa**. Simulação hipotética com 11 cotas reais e 1 virtual: R$ 101,25 por cota; ADM R$ 236,25 (taxa e cota virtual); cotas reais R$ 1.113,75. NÃO aplicar ao passado sem validar data efetiva das cotas e receitas/despesas.

## Auditoria 1 — diagnóstico

1. `cotista-chat/index.ts` usava a expressão `/^Bearer\\s+/` (regex incorreta para token), causando 401 em sessão válida. Também usava cliente `service_role` em `get_my_member_dashboard`, que depende de `auth.uid()` e poderia retornar zero.
2. `admin-finance-chat/index.ts` consulta de solicitações de empréstimo buscava `created_at`, inexistente em `loan_requests` (campo real `requested_at`). Log mostra respostas 200/400; não há API de IA externa usada nesses dois assistentes. NÃO atualizar chave OpenAI para este defeito.
3. Fluxo de comprovantes de rifa preenchia valor sem associar tipo/atividade. Outra função só chamava `refreshReceiptReference()` se `window.refreshReceiptReference` estivesse definido; essa verificação falhava apesar da função global existir.
4. Modal de passeio de cotista oferecia pagamento total das poltronas, mesmo com assentos pagos.
5. `interest_distribution_batches` está protegida para leitura administrativa e `interest_distributions` tem política de leitura própria/admin. `profiles`, `trip_seats`, `raffle_numbers`, `payment_receipts` têm RLS própria/admin.
6. A função de distribuição antiga usa taxa ADM e cota virtual sobre o valor bruto de uma transação `interest`. **Isso NÃO implementa ainda a nova divisão 10/10/5 do principal nem o bônus do tomador**, e seus valores históricos não devem ser recalculados sem conciliação.

## Correções preparadas na branch

- Corrigidos regex Bearer e normalização de comandos do assistente do cotista. As consultas de rendimento passam a usar cliente com JWT e RLS do usuário validado; insert do histórico usa `service_role` somente depois da autenticação.
- Corrigida a consulta de empréstimos do Oliver ADM para `requested_at`.
- Incluída ação **read-only** `finance_rules_preview` na Edge Function de administração: exige JWT válido + `app_metadata.role=admin`; devolve valores simulados em centavos; não lança nada.
- Criada prévia administrativa sem números estáticos de dinheiro no HTML ou JavaScript público, mostrando taxa, virtual e total da administração. Só é carregada pela API administrativa autenticada.
- Preparada correção de comprovantes de rifa e de saldos de rifas/poltronas parcialmente pagas, ainda sem publicação para cotistas.
- No fluxo normal do cotista, reduzidas as colunas de `fund_settings` carregadas pelo aplicativo e pelo Pix.

## Auditoria 2 — bloqueios para aprovação

**BLOQUEIO A — privacidade de configuração:** a política `fund_settings.settings_read` permite a cotistas ativos consultar a linha completa. Mesmo com o front-end limitado, uma requisição feita fora do aplicativo ainda pode revelar `admin_virtual_interest_shares` e `interest_admin_beneficiary_id`. RLS controla linhas, não colunas. Preparar uma interface segura separada de leitura de configurações públicas/admin, alterar os consumidores, revogar SELECT abrangente e testar a política **antes de publicar**.

**BLOQUEIO B — apuração real dos juros:** `private.rebuild_interest_distribution` ainda distribui o saldo total de juros após taxa e cota virtual, sem o bônus de 5% do tomador calculado sobre o principal. É necessário alterar a rotina com snapshots históricos, prevenção de duplicidade e rateio exato; nenhuma substituição/reprocessamento foi feita no banco.

**BLOQUEIO C — contabilização de parcela:** `public.admin_agent_execute`, ação `confirm_loan_interest_payment`, registra todo `v_amount` no caixa como `interest`, mesmo quando a parcela contém principal. Isso pode inflar rendimentos e disparar distribuição antiga. Revisar alocação principal x juros e confirmação parcial antes de permitir esse comando em produção.

**BLOQUEIO D — segurança de senhas:** advisor do Supabase acusa `auth_leaked_password_protection` desativada. Ativar nas configurações do Auth e conferir o próximo relatório.

**BLOQUEIO E — testes integrados:** confirmação em conta real de administrador e em duas contas distintas de cotistas não executada. Testar isolamento de IDs, comprovantes, empréstimos, rendimentos, rifa e poltronas, além de atualização de cota, criação/aprovação/quitação de empréstimo, SMS/avisos e idempotência da execução. Não chamar de "100% autônomo" sem esses testes.

**BLOQUEIO F — cronologia:** para lucro de passeio histórico, as cotas elegíveis devem ser as da data do evento, não as 11 atuais. A simulação usa cotas atuais e informa esse limite. Não gravar R$ 1.350,00 como receita/lucro confirmado sem conciliação da movimentação.

## Condições para publicar

1. Preservar dados, snapshots e lote anual consolidado de 2026, sem retrigger nem dupla distribuição.
2. Corrigir bloqueios A–F na branch e testar contra base isolada.
3. Rodar verificação sintática estática dos arquivos JS/TS e testes integrados de autenticação/autorização, cálculos, recibos, reconciliação, funções e telas com diferentes perfis.
4. Fazer **nova** auditoria de segurança e comparação de lançamentos antes/depois; saldo e número de cotas de outros membros não podem ser consultados por um membro.
5. Publicar a API/Edge e o front-end **juntos**, após homologação, e depois testar na Preview. Somente após autorização explícita fazer merge/deploy da Production e eventualmente distribuir para os cotistas.

### Resultado da revisão até agora
- Verificação sintática do JavaScript do front-end na branch: **OK** para `app.js`, `features.js`, `admin-agent.js` e `yield-management.js`.
- Código da Edge Function está **preparado, não deployado**; não foi feito teste HTTP autenticado com usuário real.
- Nenhuma função financeira no Supabase foi substituída.
- **NO-GO** para publicação e para qualquer distribuição de rendimentos.

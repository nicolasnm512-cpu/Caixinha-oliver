# Rendimentos por evento e ajuste individual — OLIVER Caixinha

## Regra da administradora

- As cotas são versionadas por **data efetiva**, sem mudar retroativamente os créditos dos eventos anteriores.
- Exemplo **hipotético**: Jamaica tinha 3 cotas em março e maio e decide manter apenas 1 a partir de 01/08/2026. A base histórica fica 3/3/1. Isto não foi aplicado aos dados reais sem confirmação.
- Cada lucro de rifa **futura** é calculado com a quantidade de cotas válidas na data de encerramento da rifa, nunca com a quantidade do perfil no dia em que o ADM abre a tela.
- A regra de comissão é 10% de taxa + 1 cota virtual da administração; a cota virtual nunca conta como cotista real nem cota mensal paga.
- Cada cálculo guarda `share_count_snapshot`, evitando mudança retroativa de distribuições já efetuadas.
- A redução de cotas agendada atualiza automaticamente o cadastro atual na data efetiva pela rotina `oliver_apply_member_share_schedule`, às 06:15 UTC diariamente, e não antes. Para distribuição de rifa, a data da rifa controla a quantidade de cotas diretamente.

## Ajustes de rendimentos — 3 destinos possíveis

1. **Reter** (sem redistribuição): debitar o cotista de origem e manter a parcela como reserva da caixinha, sem transferir automaticamente à administração.
2. **Redistribuir**: debitar o cotista de origem e dividir o valor entre os demais cotistas do **mesmo lote**, proporcionalmente às cotas capturadas naquele lote. O último centavo segue rateio determinístico.
3. **Transferir**: debitar o cotista de origem e creditar integralmente a **um destinatário específico** no mesmo lote.

Todos exigem valor, motivo, prévia e confirmação do administrador. O lançamento é idempotente por UUID; o histórico original de rendimentos não é apagado. As linhas de ajuste ficam em `yield_adjustment_lines` e as operações em `yield_adjustment_operations`. Totais do cotista e do ADM consultam os ajustes.

## Proteção do fechamento 2026

- O fechamento de **2026 está consolidado** num lote anual histórico: base R$ 3.474,68, cota real R$ 284,29, Jamaica R$ 852,87, administração R$ 631,78.
- Março, maio e agosto já estão incluídos no fechamento. Portanto, o sistema **bloqueia a segunda distribuição das mesmas rifas**. O ADM consegue ver as cotas e ganhos individuais como **simulação** antes de aplicar qualquer mudança.
- Alterar cotas com data retroativa não transforma automaticamente o lote anual histórico em três lotes de rifa; é preciso conciliar esse fechamento com os valores aprovados antes de lançar uma revisão.
- **Nenhum abatimento do Jamaica, transferência para a Tayná ou redução efetiva de cotas foi executado automaticamente** durante a implementação; faltam valor/data e confirmação do responsável.

## Interface e comandos

Painel administrativo → Gestão financeira → Distribuição de rendimentos → Gestão de cotas e rendimentos por período:
- Programar mudança de cotas por data e visualizar a simulação das três rifas.
- Abater, redistribuir ou transferir rendimentos entre cotistas, com motivo e prévia.
- Distribuir lucro de nova rifa encerrada quando arrecadação e despesas estejam conferidas (vedado se fizer parte de fechamento anual já consolidado).
- Auditar os ajustes recentes.

Oliver ADM reconhece frases como:
- `Programar cotas de Jamaica para 1 em agosto de 2026`
- `Abater R$ 50 de rendimento do Jamaica sem redistribuir`
- `Retirar R$ 50 de rendimento do Jamaica e redistribuir entre os demais`
- `Retirar R$ 50 de rendimento do Jamaica e transferir para Tayná`

Se o comando não indicar o destino do valor abatido, deve pedir esclarecimento antes da confirmação.

## Segurança e operação

- As tabelas novas possuem RLS, somente SELECT para ADM e leitura da própria linha de ajuste pelo cotista.
- Escritas privilegiadas são feitas por funções privadas autorizadas, sem permitir que o usuário forje diretamente lançamentos.
- O papel de ADM é verificado em cada RPC e na Edge Function, usando `app_metadata.role`.
- A rotina de aplicação de cotas futuras usa `pg_cron` e não recalcula valores passados.
- A distribuição de lucro de rifa exige evento encerrado, arrecadação e saídas registradas; precisa de aprovação explícita.

**Validações necessárias com a dona antes de mudar 2026:** data real da saída/redução de cotas, evento(s) afetado(s), valor exato da retirada e destino do ajuste para Tayná ou outros cotistas.

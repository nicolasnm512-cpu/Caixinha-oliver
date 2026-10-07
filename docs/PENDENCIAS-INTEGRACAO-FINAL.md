# Pendências para integração final

Tudo abaixo depende do Supabase correto e/ou da publicação final. O front-end e os arquivos pendentes já estão preparados no Git.

## Banco
1. Validar o schema real do projeto correto.
2. Aplicar activity_expenses.
3. Aplicar limite personalizado por cotista.
4. Aplicar campos da política de juros da administração.
5. Localizar a função/trigger atual de distribuição de juros e integrar a regra:
   - taxa administrativa configurável (inicial 10%);
   - saldo líquido dividido por cotas reais + cotas virtuais;
   - cota virtual sem aporte, crédito, rifa ou passeio;
   - administração recebe taxa + valor da cota virtual.
6. Confirmar beneficiário administrativo.
7. Validar RLS e auditoria.

## Chatbot
1. "Meu limite" deve ler o limite efetivo da member_credit_summary.
2. Confirmar o schema real da distribuição de juros antes de ajustar "Meu rendimento de juros".
3. Manter menu fechado e respostas determinísticas.

## Dados 2026
Antes do backfill final:
- identificar os R$ 90,00 restantes da rifa de março;
- identificar os R$ 64,00 restantes da rifa de maio;
- confirmar se Aledidaiana = Leididaiana/Day.

## Testes antes de produção
- ADM mobile;
- cotista mobile;
- criação e desativação de cotista;
- limite automático/personalizado;
- solicitação/aprovação de empréstimo;
- contratos ativos/quitados;
- confirmação de comprovante;
- rifa;
- passeio/poltronas;
- saída/prêmio disponível;
- taxa administrativa + cota virtual;
- chatbot;
- PWA/cache.

## Publicação
Somente depois:
1. merge da branch;
2. deploy;
3. limpar cache/validar versão;
4. teste no telefone da cliente.

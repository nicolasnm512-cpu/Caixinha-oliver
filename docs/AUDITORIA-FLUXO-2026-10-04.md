# Auditoria de interface e fluxo — OLIVER Caixinha

Data: 2026-10-04
Escopo: somente código no Git. Nenhuma alteração em Supabase ou Vercel nesta etapa.

## Objetivo
Entregar uma interface simples para administração e cotistas, com cada tarefa no lugar certo, sem misturar fluxos de ADM com fluxos de cotista.

## Achados principais

### 1. Navegação mistura papéis
- O ADM ainda vê páginas e textos pensados para cotista.
- "Central de solicitações" é, na prática, solicitação de empréstimo.
- "Meus empréstimos" aparece também para ADM, embora o ADM esteja vendo todos os contratos.
- Meu cadastro e formulário de solicitação não fazem parte do fluxo operacional do ADM.

### 2. Painel inicial do ADM pouco explicativo
- Mostra entradas, saldo emprestado e saldo da caixinha.
- Falta uma leitura visual de entradas, saídas, valores emprestados e caixa disponível.
- Falta um roteiro "comece por aqui" para a administradora.

### 3. Gestão de cotistas precisa concentrar ações
Cada cadastro deve reunir:
- situação da cota;
- quantidade de cotas;
- empréstimos;
- limite automático;
- limite personalizado;
- juros/rendimento;
- ativar/desativar;
- redefinir senha.

### 4. Empréstimos
- A separação Contratos ativos / Contratos quitados já foi preparada nesta branch.
- O ADM precisa ter linguagem de "Contratos", não "Meus empréstimos".
- Solicitação é fluxo do cotista; aprovação é fluxo do ADM.

### 5. Limite de crédito
- O cálculo automático permanece.
- Deve existir limite personalizado por cotista.
- O valor efetivo deve ser único para dashboard, aprovação, solicitação e chatbot.
- Banco será preparado em migration, mas não aplicado sem o Supabase correto.

### 6. Juros da administradora
Nova regra solicitada:
- taxa administrativa configurável, inicialmente 10%;
- uma cota virtual de juros para a administradora;
- essa cota virtual não gera contribuição mensal nem principal;
- participa apenas da divisão dos juros;
- beneficiário deve ser configurável;
- histórico deve separar taxa administrativa, juros distribuídos aos cotistas e juros da cota virtual.

### 7. Rifas e passeios
- Precisam de filtro/abas próprios.
- Rifa deve mostrar arrecadação, recebido, a receber, prêmios e saldo.
- Passeio deve mostrar total das poltronas, recebido, a receber e percentual arrecadado.
- Saídas/premiações ficam separadas do progresso de arrecadação.
- Prêmio comprado e não entregue deve poder ficar marcado como disponível/estoque para evento futuro.

### 8. Mobile
Já preparado nesta branch:
- tabelas viram cartões no celular;
- modais móveis com rolagem interna;
- mapa de poltronas responsivo;
- valores monetários sem corte;
- abas de contratos.

## Ordem de implementação
1. Fluxo e navegação por papel.
2. Painel ADM visual.
3. Cadastro do cotista como central individual.
4. Limite individual de empréstimo.
5. Taxa administrativa + cota virtual de juros.
6. Rifas e passeios.
7. Migration SQL pendente para o Supabase correto.
8. Manual ilustrado de uso.

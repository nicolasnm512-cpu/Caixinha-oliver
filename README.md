# OLIVER Caixinha V1

Aplicação interna para até 20 cotistas.

## Backend
- Supabase project: `Oliver caixinha`
- Project ref: `mqmsjdtdvnzpzytsptmh`
- Auth: e-mail/senha
- RLS: habilitado em todas as tabelas públicas
- Storage privado: `payment-receipts` e `loan-documents`
- Edge Functions: `bootstrap-admin` e `admin-users`

## Regras V1
- Cota base: R$ 100/mês por cota
- Limite de crédito: contribuições elegíveis + 25%, descontado o crédito em aberto
- Juros: 20% por operação
- Parcelamento: até 3x
- Terceiro beneficiário: responsabilidade permanece com o cotista solicitante
- Primeiro acesso: aceite da versão vigente do regulamento

## Frontend
Site estático, pronto para Vercel. A chave em `config.js` é uma chave **publishable** do Supabase e pode existir no frontend. Não adicionar `service_role` ou outras chaves secretas ao repositório.

## Inicialização
A rota `/setup.html` cria o primeiro administrador usando um código de ativação de uso único. O código não deve ser commitado no repositório.

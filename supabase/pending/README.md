# Integração final do Supabase

As migrations que estavam nesta pasta foram aplicadas no projeto correto da OLIVER Caixinha em 06/10/2026 e não devem ser reaplicadas manualmente.

Projeto confirmado: `mqmsjdtdvnzpzytsptmh`.

Migrations registradas no Supabase durante o fechamento:
- `activity_expenses_for_events`
- `member_credit_limit_override`
- `admin_interest_fee_virtual_share_and_manual_closing`
- `oliver_admin_agent_actions`
- `allow_admin_interest_distribution_mode`
- `fix_admin_agent_generated_installment_total`
- `fix_manual_interest_distribution_status`
- `final_security_and_fk_indexes`

Também foram ativadas as Edge Functions:
- `cotista-chat` v5, JWT obrigatório
- `admin-finance-chat` v1, JWT obrigatório

A fonte de verdade para o schema aplicado é o histórico de migrations do Supabase. Antes de qualquer mudança futura, conferir a migration history e os advisors do projeto.

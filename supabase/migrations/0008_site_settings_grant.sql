-- =============================================================================
-- imobi — o Master edita a configuração da operação.
--
-- A 0001 criou a policy de UPDATE só para o Master, mas tirou todos os GRANTs
-- de site_settings e devolveu apenas SELECT. Sem o GRANT a policy nunca é
-- avaliada: nem o Master conseguia salvar o número do WhatsApp.
--
-- O GRANT é por coluna e a policy continua sendo a barreira: um autenticado
-- comum passa pelo GRANT e esbarra na policy (0 linhas atualizadas).
-- =============================================================================
grant update (master_whatsapp, master_email, match_budget_tolerance_pct,
  demand_budget_edits_per_day) on public.site_settings to authenticated;

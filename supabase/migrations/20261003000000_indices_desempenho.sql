-- 7.9: índices faltantes, achados relendo os filtros/orders de verdade usados no código
-- (sem acesso ao painel "Query Performance" do Supabase neste ambiente).

-- fin_transactions: `listTransactionsForItem` filtra por item_id; `listTransactions`/`getContactExportData` por contact_id.
create index fin_tx_item_idx on public.fin_transactions (item_id) where item_id is not null;
create index fin_tx_contact_idx on public.fin_transactions (contact_id) where contact_id is not null;

-- reminder_deliveries: `listSentDeliveries`/`listFailedDeliveries` filtram por status e ordenam por occurrence_at;
-- `getContactExportData`/`deleteContactPermanently` (LGPD, 7.7) filtram por contact_id.
create index reminder_deliveries_status_idx on public.reminder_deliveries (status, occurrence_at desc);
create index reminder_deliveries_contact_idx on public.reminder_deliveries (contact_id);

-- jobs: `cleanupOldData` (7.9) filtra done+finished_at; `countFailedJobsSince` (7.6) filtra failed+updated_at.
create index jobs_done_idx on public.jobs (owner_id, finished_at) where status = 'done';
create index jobs_failed_idx on public.jobs (owner_id, updated_at) where status = 'failed';

-- share_link_views: `cleanupOldData` (7.9) apaga por created_at.
create index share_link_views_created_idx on public.share_link_views (owner_id, created_at);

-- automation_event_log: `hasAlreadyRun` (5.3) filtra pelos 4 campos juntos; `cleanupOldData` (7.9) apaga por created_at.
create index automation_event_log_lookup_idx on public.automation_event_log (owner_id, item_id, automation_id, chain_id);
create index automation_event_log_created_idx on public.automation_event_log (owner_id, created_at);

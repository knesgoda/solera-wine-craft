-- Add btree indexes on org_id for all multi-tenant tables that were missing one.
-- Critical for scale: every RLS policy and app-level query filters by org_id,
-- and without an index these become sequential scans once tenants have meaningful
-- data volume (lab samples, weather readings, tasks, notifications, etc.).
--
-- Using IF NOT EXISTS so the migration is idempotent. CONCURRENTLY is not used
-- because it cannot run inside a transaction block; tables are still small.

CREATE INDEX IF NOT EXISTS idx_admin_org_notes_org_id ON public.admin_org_notes (org_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_id ON public.ai_conversations (org_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON public.alert_rules (org_id);
CREATE INDEX IF NOT EXISTS idx_analog_vintages_org_id ON public.analog_vintages (org_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_org_id ON public.anomaly_flags (org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON public.api_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_org_id ON public.backup_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_barrel_groups_org_id ON public.barrel_groups (org_id);
CREATE INDEX IF NOT EXISTS idx_barrels_org_id ON public.barrels (org_id);
CREATE INDEX IF NOT EXISTS idx_blending_trials_org_id ON public.blending_trials (org_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_org_id ON public.client_messages (org_id);
CREATE INDEX IF NOT EXISTS idx_club_members_org_id ON public.club_members (org_id);
CREATE INDEX IF NOT EXISTS idx_club_shipments_org_id ON public.club_shipments (org_id);
CREATE INDEX IF NOT EXISTS idx_contract_block_assignments_org_id ON public.contract_block_assignments (org_id);
CREATE INDEX IF NOT EXISTS idx_facility_transfers_org_id ON public.facility_transfers (org_id);
CREATE INDEX IF NOT EXISTS idx_fermentation_vessels_org_id ON public.fermentation_vessels (org_id);
CREATE INDEX IF NOT EXISTS idx_google_sheet_connections_org_id ON public.google_sheet_connections (org_id);
CREATE INDEX IF NOT EXISTS idx_grading_scale_metrics_org_id ON public.grading_scale_metrics (org_id);
CREATE INDEX IF NOT EXISTS idx_grading_scale_tiers_org_id ON public.grading_scale_tiers (org_id);
CREATE INDEX IF NOT EXISTS idx_grower_contacts_org_id ON public.grower_contacts (org_id);
CREATE INDEX IF NOT EXISTS idx_handwritten_import_sessions_org_id ON public.handwritten_import_sessions (org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_alerts_sent_org_id ON public.harvest_alerts_sent (org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_predictions_org_id ON public.harvest_predictions (org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_progress_org_id ON public.harvest_progress (org_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_org_id ON public.import_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_import_mappings_org_id ON public.import_mappings (org_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_org_id ON public.integration_sync_logs (org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_org_id ON public.inventory_adjustments (org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_skus_org_id ON public.inventory_skus (org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications (org_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON public.orders (org_id);
CREATE INDEX IF NOT EXISTS idx_pick_windows_org_id ON public.pick_windows (org_id);
CREATE INDEX IF NOT EXISTS idx_public_ratings_config_org_id ON public.public_ratings_config (org_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_org_id ON public.saved_reports (org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks (org_id);
CREATE INDEX IF NOT EXISTS idx_ttb_additions_org_id ON public.ttb_additions (org_id);
CREATE INDEX IF NOT EXISTS idx_ttb_reports_org_id ON public.ttb_reports (org_id);
CREATE INDEX IF NOT EXISTS idx_ttb_wine_premise_operations_org_id ON public.ttb_wine_premise_operations (org_id);
CREATE INDEX IF NOT EXISTS idx_vineyard_weather_config_org_id ON public.vineyard_weather_config (org_id);
CREATE INDEX IF NOT EXISTS idx_vintages_org_id ON public.vintages (org_id);
CREATE INDEX IF NOT EXISTS idx_weather_readings_org_id ON public.weather_readings (org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_id ON public.webhook_subscriptions (org_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_org_id ON public.weekly_summaries (org_id);
CREATE INDEX IF NOT EXISTS idx_weigh_tag_metrics_org_id ON public.weigh_tag_metrics (org_id);
CREATE INDEX IF NOT EXISTS idx_wine_clubs_org_id ON public.wine_clubs (org_id);

-- profiles.org_id is heavily read on every page load (AuthContext fetch).
-- Indexed separately because profiles is on the hot path.
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles (org_id);

-- Refresh planner statistics so the new indexes get used immediately.
ANALYZE;

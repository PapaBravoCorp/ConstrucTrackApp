-- =============================================================
-- 20261122161807_security_hardening.sql — Hardening Wave 1
-- Version matches supabase_migrations.schema_migrations on the live project.
-- Fixes (see SECURITY_AUDIT.md): S-1, S-2/L-1, L-2, L-3, L-6
--
-- All application access to these objects goes through the edge
-- function's service-role client (routes/milestones.ts, routes/cron.ts,
-- routes/projects.ts, services/managerDashboardService.ts). The
-- frontend never calls .rpc(), never updates profiles or milestones
-- directly, and never reads the two dashboard views.
--
-- Idempotent: every statement can be re-run safely.
-- =============================================================

-- S-1: users can no longer edit profiles directly (role / is_active
-- self-escalation). Admin edits go through PUT /api/users/:id.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;

-- S-2 / L-1 / L-6: privileged SECURITY DEFINER functions are callable
-- only by the edge function (service_role), not via /rest/v1/rpc/*.
REVOKE EXECUTE ON FUNCTION public.submit_milestone_update(uuid, uuid, integer, text, text[], double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_milestone_update(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_milestone_update(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_changes_milestone_update(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_rework_milestone_update(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_manager_dashboard_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_action_center_queues() FROM PUBLIC, anon, authenticated;
-- Trigger function: trigger firing does not check EXECUTE; this only
-- removes the /rest/v1/rpc/handle_new_user endpoint.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.submit_milestone_update(uuid, uuid, integer, text, text[], double precision, double precision),
  public.approve_milestone_update(uuid, uuid, text, integer),
  public.reject_milestone_update(uuid, uuid, text),
  public.request_changes_milestone_update(uuid, uuid, text, text),
  public.request_rework_milestone_update(uuid, uuid, text, text),
  public.refresh_manager_dashboard_summary(),
  public.refresh_action_center_queues()
TO service_role;

-- L-2: no direct milestone updates by users (bypassed approval workflow).
-- This policy existed only in the live database, not in 001–007.
DROP POLICY IF EXISTS "Agents can update milestones" ON public.milestones;

-- L-3: dashboard views are not readable through the public Data API.
REVOKE ALL ON public.mv_manager_dashboard_summary FROM anon, authenticated;
REVOKE ALL ON public.vw_action_center_queues FROM anon, authenticated;

-- -------------------------------------------------------------
-- ROLLBACK (manual, only if required):
--   GRANT UPDATE ON public.profiles TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION <each function above> TO PUBLIC, anon, authenticated;
--   CREATE POLICY "Agents can update milestones" ON public.milestones
--     FOR UPDATE TO authenticated USING (true);
--   GRANT ALL ON public.mv_manager_dashboard_summary TO anon, authenticated;
--   GRANT ALL ON public.vw_action_center_queues TO anon, authenticated;
-- -------------------------------------------------------------

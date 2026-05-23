-- =============================================================
-- ConstrucTrack — Manager Dashboard & Enterprise Integrity Migration
-- =============================================================

-- 1. Dashboard Materialized View
-- =============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_manager_dashboard_summary;

CREATE MATERIALIZED VIEW mv_manager_dashboard_summary AS
SELECT 
    p.id AS project_id,
    p.organization_id,
    p.manager_id,
    p.name AS project_name,
    p.end_date,
    (
      SELECT (
        SUM(m.weight * COALESCE((
          SELECT MAX(mu.percent_done)
          FROM milestone_updates mu
          WHERE mu.milestone_id = m.id
            AND mu.review_status IN ('pending', 'approved')
        ), 0) / 100.0)
        / NULLIF(SUM(m.weight), 0)
      ) * 100
      FROM milestones m
      WHERE m.project_id = p.id
    )::INTEGER AS completion_percent,
    COALESCE((
      SELECT COUNT(*) 
      FROM milestones m 
      WHERE m.project_id = p.id 
        AND m.due_date < CURRENT_DATE 
        AND m.status NOT IN ('Completed', 'Archived', 'Cancelled')
    ), 0) AS overdue_milestones,
    COALESCE((
      SELECT COUNT(*)
      FROM (
        SELECT DISTINCT ON (mu.milestone_id)
          mu.review_status
        FROM milestone_updates mu
        JOIN milestones m ON mu.milestone_id = m.id
        WHERE m.project_id = p.id
        ORDER BY mu.milestone_id, mu.created_at DESC
      ) latest
      WHERE latest.review_status = 'pending'
    ), 0) AS pending_approvals,
    (
      SELECT MAX(created_at) 
      FROM milestone_activity ma 
      WHERE ma.project_id = p.id
    ) AS latest_activity_at
FROM projects p
WHERE p.status <> 'Completed';

CREATE UNIQUE INDEX idx_mv_manager_dashboard_project ON mv_manager_dashboard_summary(project_id);
CREATE INDEX idx_mv_manager_dashboard_manager ON mv_manager_dashboard_summary(manager_id);

CREATE OR REPLACE FUNCTION refresh_manager_dashboard_summary()
RETURNS void AS $$
BEGIN
    -- Use advisory lock to prevent concurrent refresh thrashing
    IF pg_try_advisory_lock(hashtext('mv_manager_dashboard_summary')) THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_manager_dashboard_summary;
        PERFORM pg_advisory_unlock(hashtext('mv_manager_dashboard_summary'));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Progress Normalization RPC
-- =============================================================
CREATE OR REPLACE FUNCTION rpc_project_progress_monthly_utc(p_project_id UUID)
RETURNS TABLE (
  month_end TIMESTAMPTZ,
  percent_done INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE months AS (
    SELECT date_trunc('month', p.start_date AT TIME ZONE 'UTC') AS month_start
    FROM projects p WHERE p.id = p_project_id AND p.start_date IS NOT NULL
    UNION ALL
    SELECT (month_start + interval '1 month')
    FROM months
    WHERE month_start < date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
  )
  SELECT 
    (m.month_start + interval '1 month' - interval '1 second') AT TIME ZONE 'UTC' AS month_end,
    COALESCE(
      (
        SELECT (
          SUM(mstone.weight * COALESCE((
            SELECT MAX(mu.percent_done)
            FROM milestone_updates mu
            WHERE mu.milestone_id = mstone.id
              AND mu.created_at <= (m.month_start + interval '1 month')
              AND mu.review_status IN ('pending', 'approved')
          ), 0) / 100.0)
          / NULLIF(SUM(mstone.weight), 0)
        ) * 100
        FROM milestones mstone
        WHERE mstone.project_id = p_project_id
      ), 0
    )::INTEGER AS percent_done
  FROM months m
  ORDER BY m.month_start;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 3. Concurrency-Safe Monotonicity
-- =============================================================
CREATE OR REPLACE FUNCTION enforce_milestone_update_monotonicity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_historical INTEGER;
BEGIN
  -- Lock the milestone row to prevent concurrent inserts passing independently
  PERFORM 1 FROM milestones WHERE id = NEW.milestone_id FOR UPDATE;
  
  -- Explicitly exclude rejected updates from monotonic history calculations
  SELECT COALESCE(MAX(percent_done), 0) INTO v_max_historical
  FROM milestone_updates
  WHERE milestone_id = NEW.milestone_id AND review_status IN ('pending', 'approved');
  
  IF NEW.percent_done < v_max_historical THEN
    RAISE EXCEPTION 'Progress cannot regress. Maximum historical progress is %', v_max_historical USING ERRCODE = 'P0005';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_monotonicity ON milestone_updates;
CREATE TRIGGER trg_enforce_monotonicity
BEFORE INSERT ON milestone_updates
FOR EACH ROW EXECUTE FUNCTION enforce_milestone_update_monotonicity();

-- 4. Formal Workflow State Machine
-- =============================================================
CREATE OR REPLACE FUNCTION enforce_review_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.review_status = NEW.review_status THEN
    RETURN NEW;
  END IF;

  -- Explicit Transition Matrix
  IF OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'changes_requested', 'rework_required', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.review_status = 'approved' AND NEW.review_status IN ('archived', 'reopened', 'pending') THEN
    RETURN NEW;
  ELSIF OLD.review_status IN ('changes_requested', 'rework_required') AND NEW.review_status IN ('pending', 'archived') THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid transition: Cannot transition from % to %', OLD.review_status, NEW.review_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_review_transitions ON milestone_updates;
CREATE TRIGGER trg_enforce_review_transitions
BEFORE UPDATE OF review_status ON milestone_updates
FOR EACH ROW EXECUTE FUNCTION enforce_review_status_transitions();

-- 5. Transactional Outbox + Sequence-Based Idempotency
-- =============================================================
ALTER TABLE milestone_activity ADD COLUMN IF NOT EXISTS workflow_transition_id UUID UNIQUE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workflow_transition_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_msg TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'dead_letter'));

-- Note: existing functions (approve_milestone_update, request_changes, etc.) 
-- can be modified later to supply workflow_transition_id when inserting to activity/notifications.

-- 6. Append-Only Audit Logs
-- =============================================================
CREATE OR REPLACE FUNCTION enforce_append_only_activity()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_activity ON milestone_activity;
CREATE TRIGGER trg_immutable_activity
BEFORE UPDATE OR DELETE ON milestone_activity
FOR EACH ROW EXECUTE FUNCTION enforce_append_only_activity();

REVOKE UPDATE, DELETE ON milestone_activity FROM public, authenticated;

-- 7. Explicit Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_mu_milestone_created ON milestone_updates(milestone_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mu_milestone_status ON milestone_updates(milestone_id, review_status);
CREATE INDEX IF NOT EXISTS idx_ma_project_created ON milestone_activity(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_status_retry ON notifications(delivery_status, retry_count);

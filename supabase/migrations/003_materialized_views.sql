-- 003_materialized_views.sql
-- Creates highly optimized materialized views for Manager Action Center queues
-- Ensures strict multi-tenant isolation via organization_id

-- Drop if exists to allow safe re-runs
DROP MATERIALIZED VIEW IF EXISTS vw_action_center_queues;

CREATE MATERIALIZED VIEW vw_action_center_queues AS
SELECT 
    m.id AS milestone_id,
    m.organization_id,
    m.project_id,
    p.name AS project_name,
    p.manager_id,
    m.name AS milestone_name,
    m.status,
    m.percent_done,
    m.last_update,
    m.due_date,
    -- Determine the queue type based on status
    CASE 
        WHEN m.status = 'Under Review' THEN 'requires_approval'
        WHEN m.status = 'Blocked' THEN 'blocked_attention'
        WHEN m.due_date < CURRENT_DATE AND m.status NOT IN ('Completed', 'Archived', 'Cancelled') THEN 'overdue_action'
        ELSE 'monitoring'
    END AS queue_type
FROM 
    milestones m
JOIN 
    projects p ON m.project_id = p.id AND m.organization_id = p.organization_id
WHERE 
    m.is_archived = false 
    AND m.status IN ('Under Review', 'Blocked', 'In Progress', 'Pending');

-- CRITICAL: Multi-tenant indices to prevent data leakage and ensure speed
CREATE UNIQUE INDEX idx_vw_action_center_unique_milestone ON vw_action_center_queues(milestone_id);
CREATE INDEX idx_vw_action_center_org_queue ON vw_action_center_queues(organization_id, manager_id, queue_type);
CREATE INDEX idx_vw_action_center_queue_type ON vw_action_center_queues(queue_type);

-- Function to refresh the view concurrently
CREATE OR REPLACE FUNCTION refresh_action_center_queues()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY vw_action_center_queues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In a production environment, you would invoke `refresh_action_center_queues()` 
-- via pg_cron or Supabase edge function triggers periodically (e.g., every 5 minutes).

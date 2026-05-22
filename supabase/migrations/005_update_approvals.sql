-- =============================================================
-- ConstrucTrack — Enterprise Governance Migration (Phase 2)
-- Milestone Update Approvals & Optimistic Locking
-- =============================================================

-- 1. Milestone Updates Schema Additions
ALTER TABLE milestone_updates
  ADD COLUMN review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'superseded')),
  ADD COLUMN submitted_for_review_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN approval_notes TEXT,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN superseded_by UUID REFERENCES milestone_updates(id);

-- Update historical records to 'approved' so they do not block the unique index
UPDATE milestone_updates
SET review_status = 'approved';

-- 2. Concurrency & Performance Indexes
-- Guarantees absolute uniqueness: only ONE pending update per milestone at a time
CREATE UNIQUE INDEX ux_one_pending_update_per_milestone
  ON milestone_updates(milestone_id)
  WHERE review_status = 'pending';

-- Fast lookup for reviews and action queues
CREATE INDEX idx_milestone_updates_milestone_review
  ON milestone_updates(milestone_id, review_status);

-- SLA and timing metrics
CREATE INDEX idx_milestone_updates_submitted_review
  ON milestone_updates(submitted_for_review_at)
  WHERE review_status = 'pending';

-- 3. Action Center Normal View
-- Replaces materialized view with read-dynamic LATERAL JOIN
DROP MATERIALIZED VIEW IF EXISTS vw_action_center_queues;

CREATE OR REPLACE VIEW vw_action_center_queues AS
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
    CASE 
        WHEN pending.has_pending THEN 'requires_approval'
        WHEN m.status = 'Blocked' THEN 'blocked_attention'
        WHEN m.due_date < CURRENT_DATE AND m.status NOT IN ('Completed', 'Archived', 'Cancelled') THEN 'overdue_action'
        ELSE 'monitoring'
    END AS queue_type
FROM 
    milestones m
JOIN 
    projects p ON m.project_id = p.id AND m.organization_id = p.organization_id
LEFT JOIN LATERAL (
    SELECT true AS has_pending
    FROM milestone_updates mu
    WHERE mu.milestone_id = m.id
      AND mu.review_status = 'pending'
    LIMIT 1
) pending ON true
WHERE 
    m.is_archived = false 
    AND (m.status IN ('Blocked', 'In Progress', 'Pending') OR pending.has_pending);

-- =============================================================
-- ATOMIC STORED PROCEDURES
-- =============================================================

-- 4. Submit Milestone Update
CREATE OR REPLACE FUNCTION submit_milestone_update(
  p_milestone_id UUID,
  p_agent_id UUID,
  p_percent_done INTEGER,
  p_note TEXT,
  p_photo_urls TEXT[],
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
) RETURNS UUID AS $$
DECLARE
  v_new_update_id UUID;
  v_project_id UUID;
  v_organization_id UUID;
  v_milestone_name TEXT;
  v_agent_name TEXT;
BEGIN
  -- Row lock to sequence concurrent submissions
  SELECT project_id, organization_id, name
  INTO v_project_id, v_organization_id, v_milestone_name
  FROM milestones
  WHERE id = p_milestone_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found' USING ERRCODE = 'P0002';
  END IF;

  -- DB-Level Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM project_agents WHERE project_id = v_project_id AND agent_id = p_agent_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Agent not assigned to project' USING ERRCODE = 'P0003';
  END IF;

  v_new_update_id := gen_random_uuid();
  
  -- Mark existing pending updates for this milestone as superseded
  UPDATE milestone_updates
  SET review_status = 'superseded',
      superseded_by = v_new_update_id
  WHERE milestone_id = p_milestone_id 
    AND review_status = 'pending';
    
  -- Insert the new pending update
  INSERT INTO milestone_updates (
    id, milestone_id, agent_id, percent_done, note, photo_urls, latitude, longitude, review_status, submitted_for_review_at
  ) VALUES (
    v_new_update_id, p_milestone_id, p_agent_id, p_percent_done, p_note, p_photo_urls, p_latitude, p_longitude, 'pending', now()
  );

  -- Update milestone last_update and thumbnail
  UPDATE milestones
  SET last_update = now(),
      thumbnail_url = CASE 
        WHEN p_photo_urls IS NOT NULL AND array_length(p_photo_urls, 1) > 0 THEN p_photo_urls[1] 
        ELSE thumbnail_url 
      END,
      updated_at = now()
  WHERE id = p_milestone_id;

  SELECT name INTO v_agent_name FROM profiles WHERE id = p_agent_id;

  -- Audit Log insertion (Event Outbox)
  INSERT INTO milestone_activity (
    organization_id, project_id, milestone_id, user_id, activity_type, message, metadata
  ) VALUES (
    v_organization_id,
    v_project_id,
    p_milestone_id,
    p_agent_id,
    'PROGRESS_UPDATED',
    v_agent_name || ' submitted progress update of ' || p_percent_done || '% for "' || v_milestone_name || '"',
    json_build_object('update_id', v_new_update_id, 'percent_done', p_percent_done, 'note', p_note)
  );

  RETURN v_new_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Approve Milestone Update
CREATE OR REPLACE FUNCTION approve_milestone_update(
  p_update_id UUID,
  p_reviewer_id UUID,
  p_approval_notes TEXT,
  p_expected_version INTEGER
) RETURNS VOID AS $$
DECLARE
  v_milestone_id UUID;
  v_proposed_percent INTEGER;
  v_photo_urls TEXT[];
  v_review_status TEXT;
  v_current_version INTEGER;
  v_current_status milestone_status_enum;
  v_project_id UUID;
  v_organization_id UUID;
  v_manager_id UUID;
  v_milestone_name TEXT;
  v_reviewer_name TEXT;
BEGIN
  -- Fetch and Lock update record
  SELECT milestone_id, percent_done, photo_urls, review_status
  INTO v_milestone_id, v_proposed_percent, v_photo_urls, v_review_status
  FROM milestone_updates
  WHERE id = p_update_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Update submission not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check
  IF v_review_status = 'approved' THEN
    RETURN;
  END IF;

  IF v_review_status <> 'pending' THEN
    IF v_review_status = 'superseded' THEN
      RAISE EXCEPTION 'This update has been superseded by a newer progress submission' USING ERRCODE = 'PR001';
    ELSE
      RAISE EXCEPTION 'This update has already been processed (Status: %)', v_review_status USING ERRCODE = 'PR002';
    END IF;
  END IF;

  -- Lock Milestone row to serialize concurrent writes
  SELECT version_number, status, project_id, organization_id, name
  INTO v_current_version, v_current_status, v_project_id, v_organization_id, v_milestone_name
  FROM milestones
  WHERE id = v_milestone_id
  FOR UPDATE;

  -- DB-Level Authorization check
  SELECT manager_id INTO v_manager_id FROM projects WHERE id = v_project_id;
  IF v_manager_id <> p_reviewer_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the project manager can approve updates' USING ERRCODE = 'P0003';
  END IF;

  -- Strict Optimistic Locking
  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: The milestone was updated by another user since you loaded it' USING ERRCODE = 'PR003';
  END IF;

  -- Update specific update status
  UPDATE milestone_updates
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      approval_notes = p_approval_notes
  WHERE id = p_update_id;

  -- Update the milestone progress and conditionally status
  UPDATE milestones
  SET percent_done = v_proposed_percent,
      status = CASE 
        WHEN v_proposed_percent = 100 THEN 'Completed'::milestone_status_enum 
        ELSE v_current_status 
      END,
      version_number = version_number + 1,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      approval_notes = p_approval_notes,
      last_update = now(),
      thumbnail_url = CASE 
        WHEN v_photo_urls IS NOT NULL AND array_length(v_photo_urls, 1) > 0 THEN v_photo_urls[1] 
        ELSE thumbnail_url 
      END,
      updated_at = now()
  WHERE id = v_milestone_id;

  -- Recalculate normalized project progress
  UPDATE projects
  SET percent_done = (
        SELECT COALESCE(round(SUM(percent_done * weight) / NULLIF(SUM(weight), 0)), 0)
        FROM milestones
        WHERE project_id = v_project_id AND is_archived = false AND status <> 'Cancelled'
      ),
      updated_at = now()
  WHERE id = v_project_id;

  SELECT name INTO v_reviewer_name FROM profiles WHERE id = p_reviewer_id;

  -- Audit Log insertion (Event Outbox)
  INSERT INTO milestone_activity (
    organization_id, project_id, milestone_id, user_id, activity_type, message, metadata
  ) VALUES (
    v_organization_id,
    v_project_id,
    v_milestone_id,
    p_reviewer_id,
    'APPROVED',
    v_reviewer_name || ' approved progress update of ' || v_proposed_percent || '% for "' || v_milestone_name || '"',
    json_build_object('update_id', p_update_id, 'percent_done', v_proposed_percent, 'approval_notes', p_approval_notes)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Reject Milestone Update
CREATE OR REPLACE FUNCTION reject_milestone_update(
  p_update_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_milestone_id UUID;
  v_proposed_percent INTEGER;
  v_review_status TEXT;
  v_project_id UUID;
  v_organization_id UUID;
  v_manager_id UUID;
  v_milestone_name TEXT;
  v_reviewer_name TEXT;
BEGIN
  -- Fetch and Lock update
  SELECT milestone_id, percent_done, review_status
  INTO v_milestone_id, v_proposed_percent, v_review_status
  FROM milestone_updates
  WHERE id = p_update_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Update submission not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check
  IF v_review_status = 'rejected' THEN
    RETURN;
  END IF;

  IF v_review_status <> 'pending' THEN
    IF v_review_status = 'superseded' THEN
      RAISE EXCEPTION 'This update has been superseded by a newer progress submission' USING ERRCODE = 'PR001';
    ELSE
      RAISE EXCEPTION 'This update has already been processed (Status: %)', v_review_status USING ERRCODE = 'PR002';
    END IF;
  END IF;

  -- Lock Milestone row
  SELECT project_id, organization_id, name
  INTO v_project_id, v_organization_id, v_milestone_name
  FROM milestones
  WHERE id = v_milestone_id
  FOR UPDATE;

  -- DB-Level Authorization check
  SELECT manager_id INTO v_manager_id FROM projects WHERE id = v_project_id;
  IF v_manager_id <> p_reviewer_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the project manager can reject updates' USING ERRCODE = 'P0003';
  END IF;

  -- Update status to rejected
  UPDATE milestone_updates
  SET review_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      rejection_reason = p_rejection_reason
  WHERE id = p_update_id;

  SELECT name INTO v_reviewer_name FROM profiles WHERE id = p_reviewer_id;

  -- Audit Log insertion (Event Outbox)
  INSERT INTO milestone_activity (
    organization_id, project_id, milestone_id, user_id, activity_type, message, metadata
  ) VALUES (
    v_organization_id,
    v_project_id,
    v_milestone_id,
    p_reviewer_id,
    'REJECTED',
    v_reviewer_name || ' rejected progress update of ' || v_proposed_percent || '% for "' || v_milestone_name || '"',
    json_build_object('update_id', p_update_id, 'percent_done', v_proposed_percent, 'rejection_reason', p_rejection_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

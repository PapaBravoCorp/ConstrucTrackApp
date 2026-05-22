-- =============================================================
-- ConstrucTrack — Rework & Changes Requested Workflow Migration
-- =============================================================
-- Adds structured rework/change-request semantics to milestone updates.
-- Migrates existing 'rejected' rows to 'changes_requested'.
-- Adds rejection_category for structured reason tracking.

-- 1. Drop old CHECK constraint and add expanded review_status values
ALTER TABLE milestone_updates DROP CONSTRAINT IF EXISTS milestone_updates_review_status_check;

ALTER TABLE milestone_updates
  ADD CONSTRAINT milestone_updates_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'superseded', 'changes_requested', 'rework_required'));

-- 2. Add rejection_category column (nullable, constrained)
ALTER TABLE milestone_updates
  ADD COLUMN IF NOT EXISTS rejection_category TEXT;

ALTER TABLE milestone_updates DROP CONSTRAINT IF EXISTS milestone_updates_rejection_category_check;

ALTER TABLE milestone_updates
  ADD CONSTRAINT milestone_updates_rejection_category_check
  CHECK (
    rejection_category IS NULL OR
    rejection_category IN (
      'work_incomplete',
      'incorrect_photo',
      'quantity_mismatch',
      'safety_concern',
      'clarification_needed',
      'scope_deviation'
    )
  );

-- 3. Migrate existing 'rejected' rows to 'changes_requested'
UPDATE milestone_updates
SET review_status = 'changes_requested'
WHERE review_status = 'rejected';

-- 4. Cron performance index for deadline scans
CREATE INDEX IF NOT EXISTS idx_milestones_due_date_status
ON milestones(due_date, status);

-- 5. Stored Procedure: Request Changes (lightweight feedback)
CREATE OR REPLACE FUNCTION request_changes_milestone_update(
  p_update_id UUID,
  p_reviewer_id UUID,
  p_reason TEXT,
  p_category TEXT DEFAULT NULL
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
  -- Validate reason is provided
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required when requesting changes' USING ERRCODE = 'P0004';
  END IF;

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
  IF v_review_status = 'changes_requested' THEN
    RETURN;
  END IF;

  IF v_review_status <> 'pending' THEN
    IF v_review_status = 'superseded' THEN
      RAISE EXCEPTION 'This update has been superseded by a newer submission' USING ERRCODE = 'PR001';
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

  -- Authorization check
  SELECT manager_id INTO v_manager_id FROM projects WHERE id = v_project_id;
  IF v_manager_id <> p_reviewer_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the project manager can request changes' USING ERRCODE = 'P0003';
  END IF;

  -- Update status
  UPDATE milestone_updates
  SET review_status = 'changes_requested',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      rejection_reason = p_reason,
      rejection_category = p_category
  WHERE id = p_update_id;

  SELECT name INTO v_reviewer_name FROM profiles WHERE id = p_reviewer_id;

  -- Audit Log
  INSERT INTO milestone_activity (
    organization_id, project_id, milestone_id, user_id, activity_type, message, metadata
  ) VALUES (
    v_organization_id,
    v_project_id,
    v_milestone_id,
    p_reviewer_id,
    'REJECTED',
    v_reviewer_name || ' requested changes on progress update of ' || v_proposed_percent || '% for "' || v_milestone_name || '"',
    json_build_object(
      'update_id', p_update_id,
      'percent_done', v_proposed_percent,
      'rejection_reason', p_reason,
      'rejection_category', p_category,
      'review_type', 'changes_requested'
    )
  );

  -- Notify agent
  INSERT INTO notifications (
    user_id, organization_id, title, body, type, reference_id
  )
  SELECT
    mu.agent_id,
    v_organization_id,
    'Changes requested for "' || v_milestone_name || '"',
    v_reviewer_name || ': ' || p_reason,
    'update_rejected',
    v_project_id
  FROM milestone_updates mu
  WHERE mu.id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Stored Procedure: Rework Required (major rework)
CREATE OR REPLACE FUNCTION request_rework_milestone_update(
  p_update_id UUID,
  p_reviewer_id UUID,
  p_reason TEXT,
  p_category TEXT DEFAULT NULL
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
  -- Validate reason is provided
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required when requesting rework' USING ERRCODE = 'P0004';
  END IF;

  -- Fetch and Lock update
  SELECT milestone_id, percent_done, review_status
  INTO v_milestone_id, v_proposed_percent, v_review_status
  FROM milestone_updates
  WHERE id = p_update_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Update submission not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_review_status = 'rework_required' THEN
    RETURN;
  END IF;

  IF v_review_status <> 'pending' THEN
    IF v_review_status = 'superseded' THEN
      RAISE EXCEPTION 'This update has been superseded by a newer submission' USING ERRCODE = 'PR001';
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

  -- Authorization check
  SELECT manager_id INTO v_manager_id FROM projects WHERE id = v_project_id;
  IF v_manager_id <> p_reviewer_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the project manager can require rework' USING ERRCODE = 'P0003';
  END IF;

  -- Update status
  UPDATE milestone_updates
  SET review_status = 'rework_required',
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      rejection_reason = p_reason,
      rejection_category = p_category
  WHERE id = p_update_id;

  SELECT name INTO v_reviewer_name FROM profiles WHERE id = p_reviewer_id;

  -- Audit Log
  INSERT INTO milestone_activity (
    organization_id, project_id, milestone_id, user_id, activity_type, message, metadata
  ) VALUES (
    v_organization_id,
    v_project_id,
    v_milestone_id,
    p_reviewer_id,
    'REJECTED',
    v_reviewer_name || ' required rework on progress update of ' || v_proposed_percent || '% for "' || v_milestone_name || '"',
    json_build_object(
      'update_id', p_update_id,
      'percent_done', v_proposed_percent,
      'rejection_reason', p_reason,
      'rejection_category', p_category,
      'review_type', 'rework_required'
    )
  );

  -- Notify agent
  INSERT INTO notifications (
    user_id, organization_id, title, body, type, reference_id
  )
  SELECT
    mu.agent_id,
    v_organization_id,
    'Rework required for "' || v_milestone_name || '"',
    v_reviewer_name || ': ' || p_reason,
    'update_rejected',
    v_project_id
  FROM milestone_updates mu
  WHERE mu.id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

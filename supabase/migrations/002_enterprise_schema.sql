-- =============================================================
-- ConstrucTrack — Enterprise Governance Migration (Phase 1)
-- =============================================================

-- 1. Create Milestone Status Enum (Excluding 'Delayed')
-- Note: Since the milestones table previously lacked a status column entirely, 
-- we are creating this ENUM clean, skipping the drop/swap pattern, but strictly
-- enforcing the allowed lifecycle values.
CREATE TYPE milestone_status_enum AS ENUM (
  'Pending',
  'In Progress',
  'Under Review',
  'Completed',
  'Reopened',
  'Rejected',
  'Blocked',
  'Cancelled',
  'Archived'
);

-- 2. Organizations (Multi-Tenant Base)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_plan TEXT DEFAULT 'Enterprise',
  dependency_enforcement_mode TEXT DEFAULT 'WARNING_ONLY' CHECK (dependency_enforcement_mode IN ('STRICT', 'WARNING_ONLY', 'DISABLED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add organization_id to existing tables
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE milestones ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Default organization for existing data (Data cleanup)
-- INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Default Org') ON CONFLICT DO NOTHING;
-- UPDATE projects SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 4. Alter Milestones Table (Enterprise Governance Fields)
ALTER TABLE milestones 
  ADD COLUMN status milestone_status_enum DEFAULT 'Pending',
  ADD COLUMN start_date DATE,
  ADD COLUMN due_date DATE,
  ADD COLUMN submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN approval_notes TEXT,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN reopened_at TIMESTAMPTZ,
  ADD COLUMN reopened_by UUID REFERENCES profiles(id),
  ADD COLUMN reopened_reason TEXT,
  ADD COLUMN is_archived BOOLEAN DEFAULT false,
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN archived_by UUID REFERENCES profiles(id),
  ADD COLUMN version_number INTEGER DEFAULT 1,
  ADD COLUMN planned_weight NUMERIC DEFAULT 0,
  ADD COLUMN current_weight NUMERIC DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 5. Project Assignments (Role Governance)
CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('PRIMARY_AGENT', 'SECONDARY_AGENT', 'PROJECT_MANAGER', 'OWNER')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id)
);

-- 6. Milestone Dependencies
CREATE TABLE IF NOT EXISTS milestone_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  depends_on_milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'FINISH_TO_START' CHECK (dependency_type IN ('FINISH_TO_START')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Media Assets (Tenant-Aware File Governance)
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  file_url TEXT NOT NULL,
  file_type TEXT,
  caption TEXT,
  gps_location JSONB,
  is_approval_evidence BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 8. Milestone Activity (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS milestone_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'COMMENT', 'QUESTION', 'STATUS_CHANGE', 'APPROVED', 'REJECTED', 'REOPENED', 
    'SYSTEM_EVENT', 'DATE_CHANGED', 'MILESTONE_CREATED', 'MILESTONE_EDITED', 
    'MILESTONE_ARCHIVED', 'PROGRESS_UPDATED', 'DEPENDENCY_VIOLATED', 'SLA_BREACHED'
  )),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Project Progress Snapshots
CREATE TABLE IF NOT EXISTS project_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  operational_progress_percent NUMERIC DEFAULT 0,
  approved_progress_percent NUMERIC DEFAULT 0,
  health_score NUMERIC DEFAULT 100,
  health_tier TEXT DEFAULT 'Healthy' CHECK (health_tier IN ('Healthy', 'Warning', 'At Risk', 'Critical')),
  delayed_milestone_count INTEGER DEFAULT 0,
  completed_milestone_count INTEGER DEFAULT 0,
  active_blockers_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Rate Limit Security Audit Log
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('RATE_LIMIT_429')),
  endpoint TEXT NOT NULL,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Indexes for Tenant-Safe Materialized Views and Reads
CREATE INDEX IF NOT EXISTS idx_milestones_org_project ON milestones(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_activity_org_milestone ON milestone_activity(organization_id, milestone_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_org_project ON project_progress_snapshots(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_org_milestone ON milestone_dependencies(organization_id, milestone_id);

-- Note: Materialized Views (vw_action_center_queues) will be created in a subsequent Phase 3 script.

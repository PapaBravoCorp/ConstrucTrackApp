-- =============================================================
-- ConstrucTrack — Database Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. PROFILES — extends auth.users with app-specific data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Agent')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. TEMPLATES — milestone template library
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN ('Residential', 'Commercial')),
  phases JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROJECTS — core project data
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Residential', 'Commercial')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  client TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'On Track' CHECK (status IN ('On Track', 'Delayed', 'Completed')),
  percent_done INTEGER DEFAULT 0,
  manager_id UUID REFERENCES profiles(id),
  template_id UUID REFERENCES templates(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PROJECT_AGENTS — many-to-many for agent assignments
CREATE TABLE IF NOT EXISTS project_agents (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, agent_id)
);

-- 5. MILESTONES — project phases
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  percent_done INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  last_update TIMESTAMPTZ,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. MILESTONE_UPDATES — progress history
CREATE TABLE IF NOT EXISTS milestone_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id),
  percent_done INTEGER NOT NULL,
  note TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL CHECK (type IN ('update', 'assignment', 'delay', 'system')),
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. ACTIVITY_LOG — audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'milestone', 'user', 'template')),
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_insert_service" ON profiles
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "profiles_all_service" ON profiles
  FOR ALL TO service_role USING (true);

-- PROJECTS
CREATE POLICY "projects_select_authenticated" ON projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "projects_all_service" ON projects
  FOR ALL TO service_role USING (true);

-- PROJECT_AGENTS
CREATE POLICY "project_agents_select_authenticated" ON project_agents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "project_agents_all_service" ON project_agents
  FOR ALL TO service_role USING (true);

-- MILESTONES
CREATE POLICY "milestones_select_authenticated" ON milestones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "milestones_all_service" ON milestones
  FOR ALL TO service_role USING (true);

-- MILESTONE_UPDATES
CREATE POLICY "milestone_updates_select_authenticated" ON milestone_updates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "milestone_updates_insert_authenticated" ON milestone_updates
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

CREATE POLICY "milestone_updates_all_service" ON milestone_updates
  FOR ALL TO service_role USING (true);

-- TEMPLATES
CREATE POLICY "templates_select_authenticated" ON templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "templates_all_service" ON templates
  FOR ALL TO service_role USING (true);

-- NOTIFICATIONS
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_all_service" ON notifications
  FOR ALL TO service_role USING (true);

-- ACTIVITY_LOG
CREATE POLICY "activity_log_select_authenticated" ON activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "activity_log_all_service" ON activity_log
  FOR ALL TO service_role USING (true);

-- =============================================================
-- STORAGE BUCKET FOR SITE PHOTOS
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "site_photos_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-photos');

CREATE POLICY "site_photos_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'site-photos');

-- =============================================================
-- SEED DEFAULT TEMPLATES
-- =============================================================

INSERT INTO templates (name, project_type, phases) VALUES
(
  'Standard Residential',
  'Residential',
  '[
    {"name": "Mobilisation & Site Prep", "weight": 5},
    {"name": "Foundation & Substructure", "weight": 15},
    {"name": "Superstructure (Framing)", "weight": 30},
    {"name": "Roofing & Windows", "weight": 15},
    {"name": "MEP (Mechanical, Electrical, Plumbing)", "weight": 20},
    {"name": "Finishing & Handover", "weight": 15}
  ]'
),
(
  'Commercial High-rise',
  'Commercial',
  '[
    {"name": "Site Preparation & Excavation", "weight": 5},
    {"name": "Foundation & Piling", "weight": 10},
    {"name": "Basement Construction", "weight": 10},
    {"name": "Superstructure - Core", "weight": 15},
    {"name": "Superstructure - Floors", "weight": 15},
    {"name": "Facade & Cladding", "weight": 10},
    {"name": "MEP Rough-in", "weight": 10},
    {"name": "Interior Fit-out", "weight": 10},
    {"name": "MEP Final Fix", "weight": 5},
    {"name": "Landscaping & External Works", "weight": 5},
    {"name": "Testing & Commissioning", "weight": 3},
    {"name": "Handover & Defects", "weight": 2}
  ]'
),
(
  'Villa Extension',
  'Residential',
  '[
    {"name": "Demolition & Prep", "weight": 10},
    {"name": "Foundation", "weight": 25},
    {"name": "Structure & Roofing", "weight": 35},
    {"name": "Finishing & Handover", "weight": 30}
  ]'
);

-- =============================================================
-- USEFUL INDEXES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_agents_agent ON project_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestone_updates_milestone ON milestone_updates(milestone_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

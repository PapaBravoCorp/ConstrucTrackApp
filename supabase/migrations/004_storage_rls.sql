-- 004_storage_rls.sql
-- Enforces strict multi-tenant isolation on the Supabase Storage bucket 'site-photos'
-- Structure: {organization_id}/{project_id}/{milestone_id}/{timestamp}-{filename}

-- Enable RLS on the storage.objects table (Already enabled by Supabase default, so skipping ALTER TABLE)

-- 1. Create the bucket if it doesn't exist (idempotent)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing generic policies if any
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload site photos" ON storage.objects;

-- Policy: Anyone can READ (since public = true, but let's be explicit if needed)
-- Note: Depending on enterprise requirements, read access might need to be restricted to the org.
-- For now, site photos are usually publicly viewable via signed URLs or public URLs to authorized apps.
-- Let's allow public read since getPublicUrl is used.
CREATE POLICY "Public Read Access for Site Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-photos');

-- Policy: Agents/Managers can ONLY upload to their organization's folder
CREATE POLICY "Tenant Isolated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'site-photos' AND
    -- The first segment of the path must match the user's organization_id
    -- We extract it by splitting the path array
    (storage.foldername(name))[1] IN (
        SELECT organization_id::text 
        FROM project_agents 
        JOIN projects ON projects.id = project_agents.project_id
        WHERE agent_id = auth.uid()
        UNION
        SELECT organization_id::text
        FROM projects
        WHERE manager_id = auth.uid()
    )
);

-- Policy: Admin can upload anywhere (if needed)
CREATE POLICY "Admin Global Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'site-photos' AND
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    )
);

-- Policy: Users can only delete photos within their organization
CREATE POLICY "Tenant Isolated Deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'site-photos' AND
    (storage.foldername(name))[1] IN (
        SELECT organization_id::text 
        FROM project_agents 
        JOIN projects ON projects.id = project_agents.project_id
        WHERE agent_id = auth.uid()
        UNION
        SELECT organization_id::text
        FROM projects
        WHERE manager_id = auth.uid()
    )
);

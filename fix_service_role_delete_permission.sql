-- Add policy to allow service role to delete from pack_sources
-- This fixes the "permission denied" error when deleting sources

-- Ensure RLS is enabled (should already be)
ALTER TABLE pack_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing service role policy if it exists
DROP POLICY IF EXISTS "Service role can delete" ON pack_sources;

-- Create policy that allows service role to delete any row
CREATE POLICY "Service role can delete"
ON pack_sources
FOR DELETE
TO service_role
USING (true);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'pack_sources' AND policyname = 'Service role can delete';

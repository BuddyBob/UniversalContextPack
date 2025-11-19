-- Fix RLS policy to allow DELETE operations on pack_sources table
-- This allows users to delete their own sources

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete their own pack sources" ON pack_sources;

-- Create new delete policy
CREATE POLICY "Users can delete their own pack sources"
ON pack_sources
FOR DELETE
USING (auth.uid() = user_id);

-- Verify all policies are in place
-- SELECT * FROM pg_policies WHERE tablename = 'pack_sources';

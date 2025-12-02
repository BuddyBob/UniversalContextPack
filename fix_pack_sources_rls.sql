-- Fix RLS policies for pack_sources table
-- This resolves the "permission denied for table pack_sources" error

-- Enable RLS on pack_sources if not already enabled
ALTER TABLE public.pack_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can insert their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can update their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can delete their own pack sources" ON public.pack_sources;

-- Create comprehensive RLS policies for pack_sources

-- Policy 1: Users can SELECT their own pack sources
CREATE POLICY "Users can view their own pack sources"
ON public.pack_sources
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can INSERT their own pack sources
CREATE POLICY "Users can insert their own pack sources"
ON public.pack_sources
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can UPDATE their own pack sources
CREATE POLICY "Users can update their own pack sources"
ON public.pack_sources
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can DELETE their own pack sources
CREATE POLICY "Users can delete their own pack sources"
ON public.pack_sources
FOR DELETE
USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_sources TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'pack_sources') THEN
    RAISE EXCEPTION 'RLS is not enabled on pack_sources table';
  END IF;
  RAISE NOTICE 'RLS policies successfully configured for pack_sources table';
END $$;

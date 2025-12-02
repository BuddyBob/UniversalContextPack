-- Fix RLS policies for packs_v2 table
-- Ensures users can only access their own packs

-- Enable RLS on packs_v2 if not already enabled
ALTER TABLE public.packs_v2 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can insert their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can update their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can delete their own packs" ON public.packs_v2;

-- Create comprehensive RLS policies for packs_v2

-- Policy 1: Users can SELECT their own packs
CREATE POLICY "Users can view their own packs"
ON public.packs_v2
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can INSERT their own packs
CREATE POLICY "Users can insert their own packs"
ON public.packs_v2
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can UPDATE their own packs
CREATE POLICY "Users can update their own packs"
ON public.packs_v2
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can DELETE their own packs
CREATE POLICY "Users can delete their own packs"
ON public.packs_v2
FOR DELETE
USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packs_v2 TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'packs_v2') THEN
    RAISE EXCEPTION 'RLS is not enabled on packs_v2 table';
  END IF;
  RAISE NOTICE 'RLS policies successfully configured for packs_v2 table';
END $$;

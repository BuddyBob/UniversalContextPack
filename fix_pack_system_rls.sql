-- Comprehensive RLS Fix for Pack V2 System
-- Run this in Supabase SQL Editor to fix all permission issues
-- This script is idempotent and safe to run multiple times

-- ============================================================================
-- ENABLE RLS ON ALL PACK TABLES
-- ============================================================================

ALTER TABLE public.packs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_sources ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP ALL EXISTING POLICIES (Clean Slate)
-- ============================================================================

-- Drop packs_v2 policies
DROP POLICY IF EXISTS "Users can view their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can insert their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can update their own packs" ON public.packs_v2;
DROP POLICY IF EXISTS "Users can delete their own packs" ON public.packs_v2;

-- Drop pack_sources policies
DROP POLICY IF EXISTS "Users can view their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can insert their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can update their own pack sources" ON public.pack_sources;
DROP POLICY IF EXISTS "Users can delete their own pack sources" ON public.pack_sources;

-- ============================================================================
-- CREATE PACKS_V2 POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own packs"
ON public.packs_v2
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packs"
ON public.packs_v2
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packs"
ON public.packs_v2
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packs"
ON public.packs_v2
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- CREATE PACK_SOURCES POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own pack sources"
ON public.pack_sources
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pack sources"
ON public.pack_sources
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pack sources"
ON public.pack_sources
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pack sources"
ON public.pack_sources
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packs_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_sources TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================

DO $$
DECLARE
  packs_v2_rls BOOLEAN;
  pack_sources_rls BOOLEAN;
  packs_v2_policies INTEGER;
  pack_sources_policies INTEGER;
BEGIN
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO packs_v2_rls FROM pg_class WHERE relname = 'packs_v2';
  SELECT relrowsecurity INTO pack_sources_rls FROM pg_class WHERE relname = 'pack_sources';
  
  -- Count policies
  SELECT COUNT(*) INTO packs_v2_policies FROM pg_policies WHERE tablename = 'packs_v2';
  SELECT COUNT(*) INTO pack_sources_policies FROM pg_policies WHERE tablename = 'pack_sources';
  
  -- Report status
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Configuration Status:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'packs_v2 RLS enabled: %', packs_v2_rls;
  RAISE NOTICE 'packs_v2 policies: %', packs_v2_policies;
  RAISE NOTICE 'pack_sources RLS enabled: %', pack_sources_rls;
  RAISE NOTICE 'pack_sources policies: %', pack_sources_policies;
  RAISE NOTICE '========================================';
  
  -- Validate
  IF NOT packs_v2_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on packs_v2 table';
  END IF;
  
  IF NOT pack_sources_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on pack_sources table';
  END IF;
  
  IF packs_v2_policies < 4 THEN
    RAISE WARNING 'Expected 4 policies on packs_v2, found %', packs_v2_policies;
  END IF;
  
  IF pack_sources_policies < 4 THEN
    RAISE WARNING 'Expected 4 policies on pack_sources, found %', pack_sources_policies;
  END IF;
  
  RAISE NOTICE 'RLS setup completed successfully!';
END $$;

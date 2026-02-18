-- ============================================================================
-- CCPA DATA DELETION SCRIPT
-- ============================================================================
-- User Email: nickekum@gmail.com
-- User UUID: 56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c
-- Request Date: 2026-02-16
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor
-- WARNING: This will permanently delete all user data. This action cannot be undone.
-- ============================================================================

-- Set the user ID variable for safety
DO $$
DECLARE
  p_target_user_id UUID := '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
  deletion_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Starting CCPA Data Deletion for User: %', p_target_user_id;
  RAISE NOTICE '============================================================================';
  
  -- ============================================================================
  -- 1. DELETE FROM MEMORY TREE SYSTEM (if tables exist)
  -- ============================================================================
  
  -- Delete memory evidence
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'memory_evidence'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.memory_evidence WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from memory_evidence', deletion_count;
  ELSE
    RAISE NOTICE 'Table memory_evidence does not exist - skipping';
  END IF;
  
  -- Delete memory edges
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'memory_edges'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.memory_edges WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from memory_edges', deletion_count;
  ELSE
    RAISE NOTICE 'Table memory_edges does not exist - skipping';
  END IF;
  
  -- Delete memory nodes
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'memory_nodes'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.memory_nodes WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from memory_nodes', deletion_count;
  ELSE
    RAISE NOTICE 'Table memory_nodes does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 2. DELETE FROM PACK REVIEWS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'pack_reviews'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.pack_reviews WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from pack_reviews', deletion_count;
  ELSE
    RAISE NOTICE 'Table pack_reviews does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 3. DELETE FROM EMAIL EVENTS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'email_events'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.email_events WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from email_events', deletion_count;
  ELSE
    RAISE NOTICE 'Table email_events does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 4. DELETE FROM PACK SOURCES (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'pack_sources'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.pack_sources WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from pack_sources', deletion_count;
  ELSE
    RAISE NOTICE 'Table pack_sources does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 5. DELETE FROM PACKS V2 (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'packs_v2'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.packs_v2 WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from packs_v2', deletion_count;
  ELSE
    RAISE NOTICE 'Table packs_v2 does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 6. DELETE FROM JOB PROGRESS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'job_progress'
  ) INTO table_exists;
  
  IF table_exists THEN
    -- Delete job progress entries (linked via job_id)
    DELETE FROM public.job_progress 
    WHERE job_id IN (
      SELECT job_id FROM public.jobs WHERE user_id = p_target_user_id
    );
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from job_progress', deletion_count;
  ELSE
    RAISE NOTICE 'Table job_progress does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 7. DELETE FROM PACKS_LEGACY (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'packs_legacy'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.packs_legacy WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from packs_legacy', deletion_count;
  ELSE
    RAISE NOTICE 'Table packs_legacy does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 8. DELETE FROM JOBS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.jobs WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from jobs', deletion_count;
  ELSE
    RAISE NOTICE 'Table jobs does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 9. DELETE FROM WEBHOOK LOGS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'webhook_logs'
  ) INTO table_exists;
  
  IF table_exists THEN
    -- Webhook logs don't have user_id, skip unless you have a way to identify them
    RAISE NOTICE 'Table webhook_logs exists but has no user_id - skipping';
  ELSE
    RAISE NOTICE 'Table webhook_logs does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 10. DELETE FROM PAYMENT ATTEMPTS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payment_attempts'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.payment_attempts WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from payment_attempts', deletion_count;
  ELSE
    RAISE NOTICE 'Table payment_attempts does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 11. DELETE FROM ADMIN ACTIONS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_actions'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.admin_actions WHERE target_user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from admin_actions (as target)', deletion_count;
  ELSE
    RAISE NOTICE 'Table admin_actions does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 12. DELETE FROM CREDIT TRANSACTIONS (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'credit_transactions'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.credit_transactions WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from credit_transactions', deletion_count;
  ELSE
    RAISE NOTICE 'Table credit_transactions does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 13. DELETE FROM USER PROFILES (if exists)
  -- ============================================================================
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) INTO table_exists;
  
  IF table_exists THEN
    DELETE FROM public.user_profiles WHERE id = p_target_user_id;
    GET DIAGNOSTICS deletion_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from user_profiles', deletion_count;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist - skipping';
  END IF;
  
  -- ============================================================================
  -- 14. DELETE FROM AUTH.USERS (Supabase Auth Table)
  -- ============================================================================
  -- Note: This will CASCADE delete to all related tables with ON DELETE CASCADE
  -- Run this last to ensure all data is properly cleaned up
  
  DELETE FROM auth.users WHERE id = p_target_user_id;
  GET DIAGNOSTICS deletion_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % records from auth.users', deletion_count;
  
  -- ============================================================================
  -- COMPLETION
  -- ============================================================================
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'CCPA Data Deletion Completed Successfully';
  RAISE NOTICE 'All personal data for user % has been permanently deleted', p_target_user_id;
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Delete R2 storage files for this user (user_56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c)';
  RAISE NOTICE '2. Send confirmation email to: nickekum@gmail.com';
  RAISE NOTICE '3. Document this deletion in compliance logs';
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run after deletion to confirm)
-- ============================================================================

-- Verify no records remain in any table for this user
-- Uncomment and run these queries to verify deletion was successful:

-- SELECT COUNT(*) as remaining_user_profiles FROM public.user_profiles WHERE id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_jobs FROM public.jobs WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_packs FROM public.packs WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_credit_transactions FROM public.credit_transactions WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_email_events FROM public.email_events WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_pack_reviews FROM public.pack_reviews WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_memory_nodes FROM public.memory_nodes WHERE user_id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';
-- SELECT COUNT(*) as remaining_auth_users FROM auth.users WHERE id = '56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c';

-- ============================================================================
-- R2 STORAGE DELETION GUIDANCE
-- ============================================================================
-- After running this SQL script, you must also delete the user's R2 storage:
-- 
-- Directory to delete: user_56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c/
-- 
-- This can be done via:
-- 1. Cloudflare R2 Dashboard
-- 2. AWS CLI (if configured for R2)
-- 3. Your backend API with proper R2 credentials
-- ============================================================================

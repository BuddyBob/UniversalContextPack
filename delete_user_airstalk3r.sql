-- ============================================================================
-- DELETE USER: airstalk3r@gmail.com
-- ============================================================================
-- This script will delete all references to the user airstalk3r@gmail.com
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- First, let's find the user ID for airstalk3r@gmail.com
-- (This is just to verify the user exists - you can comment this out after confirming)
SELECT 
    up.id as user_id,
    up.email,
    up.created_at,
    up.credits_balance,
    up.payment_plan
FROM public.user_profiles up 
WHERE up.email = 'airstalk3r@gmail.com';

-- Get a count of all related records before deletion
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as record_count
FROM public.user_profiles 
WHERE email = 'airstalk3r@gmail.com'

UNION ALL

SELECT 
    'jobs' as table_name,
    COUNT(*) as record_count
FROM public.jobs j
JOIN public.user_profiles up ON j.user_id = up.id
WHERE up.email = 'airstalk3r@gmail.com'

UNION ALL

SELECT 
    'packs' as table_name,
    COUNT(*) as record_count
FROM public.packs p
JOIN public.user_profiles up ON p.user_id = up.id
WHERE up.email = 'airstalk3r@gmail.com'

UNION ALL

SELECT 
    'job_progress' as table_name,
    COUNT(*) as record_count
FROM public.job_progress jp
JOIN public.jobs j ON jp.job_id = j.job_id
JOIN public.user_profiles up ON j.user_id = up.id
WHERE up.email = 'airstalk3r@gmail.com'

UNION ALL

SELECT 
    'credit_transactions' as table_name,
    COUNT(*) as record_count
FROM public.credit_transactions ct
JOIN public.user_profiles up ON ct.user_id = up.id
WHERE up.email = 'airstalk3r@gmail.com';

-- ============================================================================
-- DELETION COMMANDS (Execute these one by one)
-- ============================================================================

-- Step 1: Delete from credit_transactions table
DELETE FROM public.credit_transactions 
WHERE user_id IN (
    SELECT id FROM public.user_profiles 
    WHERE email = 'airstalk3r@gmail.com'
);

-- Step 2: Delete from job_progress table
DELETE FROM public.job_progress 
WHERE job_id IN (
    SELECT j.job_id 
    FROM public.jobs j
    JOIN public.user_profiles up ON j.user_id = up.id
    WHERE up.email = 'airstalk3r@gmail.com'
);

-- Step 3: Delete from packs table
DELETE FROM public.packs 
WHERE user_id IN (
    SELECT id FROM public.user_profiles 
    WHERE email = 'airstalk3r@gmail.com'
);

-- Step 4: Delete from jobs table
DELETE FROM public.jobs 
WHERE user_id IN (
    SELECT id FROM public.user_profiles 
    WHERE email = 'airstalk3r@gmail.com'
);

-- Step 5: Delete from user_profiles table
DELETE FROM public.user_profiles 
WHERE email = 'airstalk3r@gmail.com';

-- Step 6: Delete from auth.users table (this will cascade to any remaining references)
-- WARNING: This is the final step and cannot be undone
DELETE FROM auth.users 
WHERE email = 'airstalk3r@gmail.com';

-- ============================================================================
-- VERIFICATION QUERY (Run this to confirm deletion)
-- ============================================================================
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as remaining_records
FROM public.user_profiles 
WHERE email = 'airstalk3r@gmail.com'

UNION ALL

SELECT 
    'auth.users' as table_name,
    COUNT(*) as remaining_records
FROM auth.users 
WHERE email = 'airstalk3r@gmail.com';

-- If both queries return 0, the user has been completely deleted
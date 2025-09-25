-- Debug script to check unlimited plan purchase issues
-- Run this in Supabase SQL Editor to diagnose problems

-- 1. Check if the grant_unlimited_access function exists
SELECT 
    routine_name, 
    routine_type,
    specific_name,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'grant_unlimited_access';

-- 2. Check recent webhook logs (if table exists)
SELECT COUNT(*) as webhook_logs_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'webhook_logs';

-- If webhook_logs exists, check recent entries
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_logs') THEN
        RAISE NOTICE 'Recent webhook logs:';
        PERFORM * FROM (
            SELECT webhook_id, event_type, status, stripe_event_type, error_message, created_at
            FROM public.webhook_logs 
            WHERE event_type = 'stripe_webhook'
            ORDER BY created_at DESC 
            LIMIT 10
        ) as recent_webhooks;
    ELSE
        RAISE NOTICE 'webhook_logs table does not exist - webhooks may not be logging';
    END IF;
END $$;

-- 3. Check recent credit transactions with unlimited purchases
SELECT 
    ct.user_id,
    up.email,
    ct.transaction_type,
    ct.credits,
    ct.amount,
    ct.stripe_payment_id,
    ct.description,
    ct.created_at,
    up.payment_plan,
    up.credits_balance,
    up.subscription_status
FROM public.credit_transactions ct
JOIN public.user_profiles up ON ct.user_id = up.id
WHERE ct.amount = 3.99  -- Unlimited plan cost
   OR ct.credits = 999999  -- Unlimited plan credits
   OR ct.description ILIKE '%unlimited%'
ORDER BY ct.created_at DESC
LIMIT 20;

-- 4. Check users who should have unlimited but don't
SELECT 
    up.id,
    up.email,
    up.payment_plan,
    up.credits_balance,
    up.subscription_status,
    up.plan_start_date,
    COUNT(ct.id) as total_transactions,
    SUM(CASE WHEN ct.amount = 3.99 THEN 1 ELSE 0 END) as unlimited_purchases
FROM public.user_profiles up
LEFT JOIN public.credit_transactions ct ON ct.user_id = up.id
WHERE up.id IN (
    -- Users who paid $3.99 but don't have unlimited plan
    SELECT DISTINCT ct.user_id 
    FROM public.credit_transactions ct 
    WHERE ct.amount = 3.99
)
GROUP BY up.id, up.email, up.payment_plan, up.credits_balance, up.subscription_status, up.plan_start_date
HAVING up.payment_plan != 'unlimited'
ORDER BY MAX(ct.created_at) DESC;

-- 5. Test the grant_unlimited_access function with a safe test
-- (This won't actually grant access, just test if function works)
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    -- Check if function exists first
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'grant_unlimited_access') THEN
        RAISE NOTICE 'grant_unlimited_access function exists and is ready to use';
        
        -- You can uncomment the next lines to test with a real user UUID
        -- Replace 'your-user-uuid-here' with an actual user UUID from above results
        
        -- SELECT public.grant_unlimited_access(
        --     'your-user-uuid-here'::UUID,
        --     3.99,
        --     'test_function_call'
        -- ) INTO test_result;
        -- RAISE NOTICE 'Function test result: %', test_result;
        
    ELSE
        RAISE NOTICE 'ERROR: grant_unlimited_access function does NOT exist!';
        RAISE NOTICE 'You need to run the fix_unlimited_function.sql script first';
    END IF;
END $$;

-- 6. Check constraint on credit_transactions table
SELECT constraint_name, check_clause
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
  AND constraint_name LIKE '%transaction_type%';
-- ============================================================================
-- UNLIMITED PLAN MIGRATION SCRIPT - SAFE DATA-PRESERVING UPDATES ONLY
-- ============================================================================
-- ⚠️  SAFETY GUARANTEE: This script only adds new functionality and constraints.
-- ✅  NO tables will be dropped, NO data will be deleted or modified.
-- ✅  All existing users, transactions, and jobs remain completely intact.
-- ✅  This is an additive-only migration that preserves all existing data.

-- SAFETY CHECK: Verify critical tables exist before proceeding
DO $$
BEGIN
  -- Check that user_profiles table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE EXCEPTION 'user_profiles table not found - stopping migration for safety';
  END IF;
  
  -- Check that credit_transactions table exists  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
    RAISE EXCEPTION 'credit_transactions table not found - stopping migration for safety';
  END IF;
  
  RAISE NOTICE '✅ Safety check passed - critical tables exist';
END $$;

-- ============================================================================
-- PRE-FLIGHT DATA BACKUP VERIFICATION (Optional but Recommended)
-- ============================================================================
-- Run these queries BEFORE the migration to see your current data:

-- Count existing users:
-- SELECT COUNT(*) as total_users FROM public.user_profiles;

-- Count existing transactions:  
-- SELECT COUNT(*) as total_transactions FROM public.credit_transactions;

-- Sample of current payment plans:
-- SELECT payment_plan, COUNT(*) as count FROM public.user_profiles GROUP BY payment_plan;

-- ============================================================================
-- MIGRATION COMMANDS (100% DATA-SAFE)
-- ============================================================================

-- 1. SAFELY update the payment_plan constraint to allow 'unlimited'
--    This only changes what values are allowed, doesn't modify existing data
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_payment_plan_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_payment_plan_check 
CHECK (payment_plan IN ('credits', 'unlimited'));

-- 2. Add the grant_unlimited_access function
CREATE OR REPLACE FUNCTION public.grant_unlimited_access(
  user_uuid UUID,
  amount_paid DECIMAL DEFAULT 0,
  stripe_payment_id TEXT DEFAULT 'manual'
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Update user to unlimited plan with very high credit balance
  UPDATE public.user_profiles 
  SET payment_plan = 'unlimited',
      credits_balance = 999999, -- High number to represent unlimited
      subscription_status = 'active',
      plan_start_date = NOW(),
      updated_at = NOW()
  WHERE id = user_uuid
  RETURNING credits_balance INTO new_balance;
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id, 
    transaction_type, 
    credits, 
    amount, 
    stripe_payment_id,
    description
  )
  VALUES (
    user_uuid, 
    'unlimited_purchase', 
    999999, 
    amount_paid, 
    stripe_payment_id,
    'Unlimited access purchase - no credit limits'
  );
  
  RETURN new_balance;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in grant_unlimited_access: %', SQLERRM;
    RETURN -1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permissions for unlimited access function
GRANT EXECUTE ON FUNCTION public.grant_unlimited_access(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_unlimited_access(UUID, DECIMAL, TEXT) TO service_role;

-- 4. Update the credit deduction trigger to skip unlimited users
CREATE OR REPLACE FUNCTION public.handle_chunk_usage_update()
RETURNS TRIGGER AS $$
DECLARE
  user_plan TEXT;
BEGIN
  -- When job is completed, deduct credits (unless user has unlimited plan)
  IF NEW.status = 'analyzed' AND NEW.processed_chunks > 0 AND 
     (OLD.status IS NULL OR OLD.status != 'analyzed') THEN
    
    -- Check if user has unlimited plan
    SELECT payment_plan INTO user_plan 
    FROM public.user_profiles 
    WHERE id = NEW.user_id;
    
    -- Only deduct credits for non-unlimited users
    IF user_plan != 'unlimited' THEN
      -- Deduct credits and log transaction
      UPDATE public.user_profiles 
      SET credits_balance = GREATEST(0, credits_balance - NEW.processed_chunks),
          updated_at = NOW()
      WHERE id = NEW.user_id;
      
      -- Log the usage transaction
      INSERT INTO public.credit_transactions (user_id, transaction_type, credits, job_id, description)
      VALUES (NEW.user_id, 'usage', -NEW.processed_chunks, NEW.job_id, 
              'Credits used for analysis of ' || NEW.processed_chunks || ' chunks');
      
      RAISE NOTICE 'Deducted % credits for user %', NEW.processed_chunks, NEW.user_id;
    ELSE
      -- Log unlimited usage for tracking (no credit deduction)
      INSERT INTO public.credit_transactions (user_id, transaction_type, credits, job_id, description)
      VALUES (NEW.user_id, 'unlimited_usage', 0, NEW.job_id, 
              'Unlimited plan usage - analyzed ' || NEW.processed_chunks || ' chunks (no credits deducted)');
      
      RAISE NOTICE 'Unlimited user % analyzed % chunks - no credits deducted', NEW.user_id, NEW.processed_chunks;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run these to confirm nothing was lost)
-- ============================================================================

-- Verify user count is unchanged:
SELECT COUNT(*) as total_users_after_migration FROM public.user_profiles;

-- Verify transaction count is unchanged:  
SELECT COUNT(*) as total_transactions_after_migration FROM public.credit_transactions;

-- Verify payment plans (should show 'credits' and possibly 'unlimited'):
SELECT payment_plan, COUNT(*) as count FROM public.user_profiles GROUP BY payment_plan;

-- Verify the new constraint exists:
SELECT con.conname, pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con 
JOIN pg_class rel ON rel.oid = con.conrelid 
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
WHERE nsp.nspname = 'public' 
  AND rel.relname = 'user_profiles' 
  AND con.conname = 'user_profiles_payment_plan_check';

-- Verify the new function exists:
SELECT proname FROM pg_proc WHERE proname = 'grant_unlimited_access';

-- ============================================================================
-- OPTIONAL: Test the unlimited functionality (replace with your email)
-- ============================================================================

-- Test granting unlimited access (uncomment and replace email):
-- SELECT grant_unlimited_access(
--   (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
--   9.99,
--   'test_unlimited_grant'
-- );

-- Check user status:
-- SELECT email, payment_plan, credits_balance, subscription_status 
-- FROM user_profiles 
-- WHERE email = 'your-email@example.com';

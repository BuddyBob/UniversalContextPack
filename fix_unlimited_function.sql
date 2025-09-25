-- Migration script to fix unlimited access functionality
-- Run this in your Supabase SQL editor
-- This will not affect existing user data

-- First, update the transaction type constraint to include unlimited_usage
ALTER TABLE public.credit_transactions 
DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;

ALTER TABLE public.credit_transactions 
ADD CONSTRAINT credit_transactions_transaction_type_check 
CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus', 'unlimited_usage'));

-- Drop and recreate the grant_unlimited_access function with proper error handling
DROP FUNCTION IF EXISTS public.grant_unlimited_access(UUID, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION public.grant_unlimited_access(
  user_uuid UUID,
  amount_paid DECIMAL DEFAULT 0,
  stripe_payment_id TEXT DEFAULT 'manual'
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
  affected_rows INTEGER;
BEGIN
  -- Update user to unlimited plan with very high credit balance
  UPDATE public.user_profiles 
  SET payment_plan = 'unlimited',
      credits_balance = 999999, -- High number to represent unlimited
      subscription_status = 'active',
      plan_start_date = NOW(),
      updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Check if update affected any rows
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  IF affected_rows = 0 THEN
    RAISE LOG 'User not found: %', user_uuid;
    RETURN -1;
  END IF;
  
  -- Get the updated balance
  SELECT credits_balance INTO new_balance 
  FROM public.user_profiles 
  WHERE id = user_uuid;
  
  -- Log the transaction (use 'purchase' instead of 'unlimited_purchase' to match constraint)
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
    'purchase', 
    999999, 
    amount_paid, 
    stripe_payment_id,
    'Unlimited access purchase - no credit limits'
  );
  
  RAISE LOG 'Successfully granted unlimited access to user: %, new balance: %', user_uuid, new_balance;
  
  RETURN new_balance;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in grant_unlimited_access for user %: %', user_uuid, SQLERRM;
    RETURN -1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for unlimited access function
GRANT EXECUTE ON FUNCTION public.grant_unlimited_access(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_unlimited_access(UUID, DECIMAL, TEXT) TO service_role;

-- Test the function (optional - you can comment this out)
-- SELECT public.grant_unlimited_access('08192f18-0b1c-4d00-9b90-208c64dd972e'::UUID, 3.99, 'test_function_fix');

-- Update get_user_payment_status function to properly detect unlimited plans
CREATE OR REPLACE FUNCTION public.get_user_payment_status(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  total_purchased INTEGER DEFAULT 0;
  total_used INTEGER DEFAULT 0;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile 
  FROM public.user_profiles 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    -- Create default profile for new users
    INSERT INTO public.user_profiles (id, email, r2_user_directory, payment_plan, chunks_analyzed, credits_balance)
    VALUES (user_uuid, 'unknown@example.com', 'user_' || user_uuid, 'credits', 0, 4)
    RETURNING * INTO user_profile;
  END IF;
  
  -- Check if user has unlimited plan
  IF user_profile.payment_plan = 'unlimited' THEN
    -- Return unlimited plan status
    RETURN jsonb_build_object(
      'plan', 'unlimited',
      'chunks_used', 0, -- Not relevant for unlimited
      'chunks_allowed', 999999, -- Unlimited 
      'credits_balance', 999999, -- Always show unlimited credits
      'can_process', true, -- Always can process
      'subscription_status', COALESCE(user_profile.subscription_status, 'active'),
      'plan_start_date', user_profile.plan_start_date,
      'plan_end_date', user_profile.plan_end_date
    );
  END IF;
  
  -- For credits plan, calculate usage as before
  -- Calculate total credits purchased (sum of all 'purchase' transactions)
  SELECT COALESCE(SUM(credits), 0) INTO total_purchased
  FROM public.credit_transactions
  WHERE user_id = user_uuid AND transaction_type = 'purchase';
  
  -- Calculate total credits used (sum of absolute values of 'usage' transactions)
  SELECT COALESCE(SUM(ABS(credits)), 0) INTO total_used
  FROM public.credit_transactions
  WHERE user_id = user_uuid AND transaction_type = 'usage';
  
  -- Add the initial 4 free credits to total purchased if user hasn't made any purchases
  IF total_purchased = 0 THEN
    total_purchased := 4;
  ELSE
    total_purchased := total_purchased + 4; -- Add free credits to purchased total
  END IF;
  
  -- Return credit-based status with proper usage tracking
  RETURN jsonb_build_object(
    'plan', 'credits',
    'chunks_used', total_used, -- Show actual credits used
    'chunks_allowed', total_purchased, -- Show total credits available (purchased + free)
    'credits_balance', COALESCE(user_profile.credits_balance, 4),
    'can_process', CASE WHEN COALESCE(user_profile.credits_balance, 4) > 0 THEN true ELSE false END,
    'subscription_status', user_profile.subscription_status,
    'plan_start_date', user_profile.plan_start_date,
    'plan_end_date', user_profile.plan_end_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_payment_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_payment_status(UUID) TO service_role;

-- Verify the functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('grant_unlimited_access', 'get_user_payment_status');
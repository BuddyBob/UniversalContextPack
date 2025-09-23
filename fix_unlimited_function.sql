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

-- Verify the function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'grant_unlimited_access';
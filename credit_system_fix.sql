-- ============================================================================
-- CREDIT SYSTEM PERMISSION FIXES ONLY
-- ============================================================================
-- This script only contains the enhanced SECURITY DEFINER fixes for the
-- add_credits_to_user function to resolve "permission denied for table credit_transactions"
-- Run ONLY this script in Supabase SQL Editor after the main schema is deployed
-- ============================================================================

-- Drop and recreate functions with enhanced SECURITY DEFINER settings
DROP FUNCTION IF EXISTS public.add_credits_to_user(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.add_credits_to_user(TEXT, INTEGER, TEXT);

-- Version 1: By UUID (ENHANCED with explicit search_path)
CREATE OR REPLACE FUNCTION public.add_credits_to_user(
  user_uuid UUID,
  credits_to_add INTEGER,
  transaction_description TEXT DEFAULT 'Credit addition'
)
RETURNS INTEGER
SECURITY DEFINER  -- This bypasses RLS and runs with elevated privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Update existing user's credit balance
  UPDATE public.user_profiles 
  SET credits_balance = COALESCE(credits_balance, 0) + credits_to_add,
      updated_at = NOW()
  WHERE id = user_uuid
  RETURNING credits_balance INTO new_balance;
  
  -- If user doesn't exist, create minimal profile
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      id, 
      email, 
      r2_user_directory, 
      payment_plan, 
      chunks_analyzed, 
      credits_balance,
      created_at,
      updated_at
    )
    VALUES (
      user_uuid, 
      'user@example.com',  -- Placeholder, real email comes from auth.users
      'user_' || user_uuid, 
      'credits', 
      0, 
      credits_to_add,
      NOW(),
      NOW()
    )
    RETURNING credits_balance INTO new_balance;
  END IF;
  
  -- Log the transaction (NOW WORKS because of SECURITY DEFINER)
  INSERT INTO public.credit_transactions (user_id, transaction_type, credits, description)
  VALUES (user_uuid, 'purchase', credits_to_add, transaction_description);
  
  RETURN new_balance;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in add_credits_to_user function: %', SQLERRM;
    RETURN -1;
END;
$$;

-- Version 2: By email (ENHANCED with explicit search_path)
CREATE OR REPLACE FUNCTION public.add_credits_to_user(
  user_email TEXT,
  credits_to_add INTEGER,
  transaction_description TEXT DEFAULT 'Credit addition'
)
RETURNS INTEGER
SECURITY DEFINER  -- This bypasses RLS and runs with elevated privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_uuid UUID;
  new_balance INTEGER;
BEGIN
  -- Get user UUID from auth.users by email
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = user_email;
  
  -- If user not found, return error
  IF user_uuid IS NULL THEN
    RAISE LOG 'User with email address not found: %', user_email;
    RETURN -1;
  END IF;
  
  -- Update existing user's credit balance
  UPDATE public.user_profiles 
  SET credits_balance = COALESCE(credits_balance, 0) + credits_to_add,
      updated_at = NOW()
  WHERE id = user_uuid
  RETURNING credits_balance INTO new_balance;
  
  -- If user profile doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      id, 
      email, 
      r2_user_directory, 
      payment_plan, 
      chunks_analyzed, 
      credits_balance,
      created_at,
      updated_at
    )
    VALUES (
      user_uuid, 
      user_email,
      'user_' || user_uuid, 
      'credits', 
      0, 
      credits_to_add,
      NOW(),
      NOW()
    )
    RETURNING credits_balance INTO new_balance;
  END IF;
  
  -- Log the transaction (NOW WORKS because of SECURITY DEFINER)
  INSERT INTO public.credit_transactions (user_id, transaction_type, credits, description)
  VALUES (user_uuid, 'purchase', credits_to_add, transaction_description);
  
  RETURN new_balance;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in add_credits_to_user email function: %', SQLERRM;
    RETURN -1;
END;
$$;

-- Grant permissions for the enhanced credit functions
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(TEXT, INTEGER, TEXT) TO service_role;

-- Test the fixed credit system (uncomment to test after deployment)
-- SELECT add_credits_to_user('airstalk3r@gmail.com', 1, 'Test credit addition after enhanced fix');

-- Success message without problematic formatting
SELECT 'CREDIT SYSTEM PERMISSION FIXES APPLIED SUCCESSFULLY!' as status;

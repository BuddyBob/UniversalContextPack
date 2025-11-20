-- Update default free credits from 4 to 10
-- Run this in Supabase SQL Editor

-- 1. Create or replace the helper function
CREATE OR REPLACE FUNCTION public.get_default_new_user_credits()
RETURNS INTEGER AS $$
BEGIN
  RETURN 10;  -- Changed from 4 to 10
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update the default value in the user_profiles table
ALTER TABLE public.user_profiles 
  ALTER COLUMN credits_balance SET DEFAULT 10;

-- 3. Optional: Update existing free users who still have the old default (only if they have exactly 4 credits)
-- Uncomment the line below if you want to give existing users the new free credits
-- UPDATE public.user_profiles SET credits_balance = 10 WHERE payment_plan = 'credits' AND credits_balance = 4;

-- Verify the changes
SELECT 
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'credits_balance';

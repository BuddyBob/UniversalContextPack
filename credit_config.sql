-- ============================================================================
-- CREDIT CONFIGURATION SCRIPT
-- ============================================================================
-- This script manages the default credit allocation for new users
-- Change the DEFAULT_NEW_USER_CREDITS value here to easily update credits
-- ============================================================================

-- Configuration: Default credits for new users
-- Change this value to update credits for all new registrations
-- Current setting: 4 credits per new user
CREATE OR REPLACE FUNCTION get_default_new_user_credits()
RETURNS INTEGER AS $$
BEGIN
    RETURN 4; -- Change this number to modify default credits
END;
$$ LANGUAGE plpgsql;

-- Update the existing user_profiles table default
-- This only affects NEW users, existing users keep their current balance
ALTER TABLE public.user_profiles 
ALTER COLUMN credits_balance SET DEFAULT 2;

-- Create a function to safely update new user credits in the future
CREATE OR REPLACE FUNCTION update_new_user_credit_default(new_credits INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Update the table default
    EXECUTE format('ALTER TABLE public.user_profiles ALTER COLUMN credits_balance SET DEFAULT %s', new_credits);
    
    -- Log the change
    RAISE NOTICE 'New user credit default updated to % credits', new_credits;
END;
$$ LANGUAGE plpgsql;

-- Example usage (commented out):
-- SELECT update_new_user_credit_default(5); -- Would change default to 5 credits

-- Verification query to check current default
SELECT column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'credits_balance';
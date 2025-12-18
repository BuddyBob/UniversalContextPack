-- Add subscription columns to user_profiles table
-- Run this migration in Supabase SQL Editor

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- Create index on subscription_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_id 
ON user_profiles(subscription_id);

-- Add comments to document the columns
COMMENT ON COLUMN user_profiles.subscription_id IS 'Stripe subscription ID (sub_xxx)';
COMMENT ON COLUMN user_profiles.subscription_status IS 'Subscription status: active, canceled, past_due, etc.';
COMMENT ON COLUMN user_profiles.subscription_tier IS 'Subscription tier: pro, unlimited (legacy)';
COMMENT ON COLUMN user_profiles.current_period_end IS 'When the current subscription period ends (for renewals)';

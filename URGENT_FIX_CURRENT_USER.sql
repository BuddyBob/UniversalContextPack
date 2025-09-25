-- URGENT: Manual fix for user who purchased unlimited but didn't get access
-- User ID from webhook logs: 9d122971-3ae6-411b-950f-57dba32931b4

-- First, deploy the database functions if not already done
-- (This should be run first: fix_unlimited_function.sql)

-- Then grant unlimited access to this specific user
SELECT public.grant_unlimited_access(
  '9d122971-3ae6-411b-950f-57dba32931b4'::UUID, 
  3.99, 
  'manual_fix_after_comprehensive_audit_credits_minus_one_issue'
);

-- Verify the user now has unlimited access
SELECT 
  id,
  email,
  payment_plan,
  credits_balance,
  subscription_status,
  plan_start_date,
  updated_at
FROM user_profiles 
WHERE id = '9d122971-3ae6-411b-950f-57dba32931b4'::UUID;

-- Also check recent transactions for this user
SELECT 
  transaction_type,
  credits,
  amount,
  stripe_payment_id,
  description,
  created_at
FROM credit_transactions 
WHERE user_id = '9d122971-3ae6-411b-950f-57dba32931b4'::UUID
ORDER BY created_at DESC
LIMIT 5;
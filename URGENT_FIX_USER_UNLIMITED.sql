-- URGENT: Grant unlimited access to user who purchased but didn't receive access
-- User ID: 9d122971-3ae6-411b-950f-57dba32931b4
-- Payment Intent: pi_3SBIP1EA934vxolt0082nFkP (latest attempt)
-- Amount: $3.99

-- First, ensure the database functions are deployed
-- (Run fix_unlimited_function.sql first if not already done)

-- Grant unlimited access immediately
SELECT public.grant_unlimited_access(
  '9d122971-3ae6-411b-950f-57dba32931b4'::UUID, 
  3.99, 
  'manual_fix_webhook_failure'
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

-- Also check their transaction history
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
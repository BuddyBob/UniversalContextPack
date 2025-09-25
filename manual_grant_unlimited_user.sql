-- Manual unlimited access grant for user from webhook logs
-- User ID: 9d122971-3ae6-411b-950f-57dba32931b4

SELECT public.grant_unlimited_access(
  '9d122971-3ae6-411b-950f-57dba32931b4'::UUID, 
  3.99, 
  'manual_grant_after_webhook_failure'
);

-- Verify the user now has unlimited access
SELECT 
  id,
  payment_plan,
  credits_balance,
  subscription_status,
  plan_start_date
FROM user_profiles 
WHERE id = '9d122971-3ae6-411b-950f-57dba32931b4'::UUID;
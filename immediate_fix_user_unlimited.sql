-- Immediate fix: Grant unlimited access to user from recent purchase
-- User ID from logs: 9d122971-3ae6-411b-950f-57dba32931b4
-- Payment Intent: pi_3SBIH9EA934vxolt06fGa9XT
-- Amount: $3.99

SELECT public.grant_unlimited_access(
  '9d122971-3ae6-411b-950f-57dba32931b4'::UUID, 
  3.99, 
  'pi_3SBIH9EA934vxolt06fGa9XT'
);

-- Verify the result
SELECT 
  id,
  payment_plan,
  credits_balance,
  subscription_status,
  plan_start_date,
  updated_at
FROM user_profiles 
WHERE id = '9d122971-3ae6-411b-950f-57dba32931b4'::UUID;
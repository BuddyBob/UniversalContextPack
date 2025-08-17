-- ============================================================================
-- FIX CREDIT TRANSACTIONS PERMISSIONS
-- ============================================================================
-- This script fixes the permission denied error for credit_transactions table
-- Run this in Supabase SQL Editor to fix the service role permissions

-- Add service role policy for credit transactions
DROP POLICY IF EXISTS "Service role can manage credit transactions" ON public.credit_transactions;
CREATE POLICY "Service role can manage credit transactions" ON public.credit_transactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant service role permissions on all tables
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.user_profiles TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.packs TO service_role;
GRANT ALL ON public.job_progress TO service_role;
GRANT ALL ON public.credit_transactions TO service_role;
GRANT ALL ON public.webhook_logs TO service_role;
GRANT ALL ON public.payment_attempts TO service_role;
GRANT ALL ON public.admin_actions TO service_role;

-- Grant execute permissions on functions to service role
GRANT EXECUTE ON FUNCTION public.get_user_payment_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_payment_plan(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_r2_directory(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_job(TEXT, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_job_status(TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_profile_for_backend(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile_for_backend(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(TEXT, INTEGER, TEXT) TO service_role;

-- Verify permissions by testing credit addition
SELECT add_credits_to_user('airstalk3r@gmail.com', 0, 'Permission test - no credits added');

COMMENT ON SCHEMA public IS 'Credit transaction permissions fixed - service role can now bypass RLS for manual credit operations';

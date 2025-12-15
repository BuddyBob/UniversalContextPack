-- Email Events Tracking Schema
-- Run this in Supabase SQL Editor to add email event tracking

-- ============================================================================
-- EMAIL EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('account_created', 'first_action', 'incomplete_activation')),
  email_address TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  resend_email_id TEXT, -- Store Resend's email ID for tracking
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON public.email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_sent_at ON public.email_events(sent_at);

-- ============================================================================
-- UPDATE USER_PROFILES TABLE
-- ============================================================================

-- Add email tracking columns to user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS first_pack_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS account_creation_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_action_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incomplete_activation_email_sent BOOLEAN DEFAULT false;

-- Create index for finding users who need activation nudge
CREATE INDEX IF NOT EXISTS idx_user_profiles_activation_nudge 
  ON public.user_profiles(created_at, first_pack_created_at, incomplete_activation_email_sent)
  WHERE first_pack_created_at IS NULL AND incomplete_activation_email_sent = false;

-- ============================================================================
-- RLS POLICIES FOR EMAIL_EVENTS
-- ============================================================================

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own email events
CREATE POLICY "Users can view their own email events"
  ON public.email_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all email events
CREATE POLICY "Service role can manage all email events"
  ON public.email_events
  FOR ALL
  USING ((select auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a specific email event was already sent
CREATE OR REPLACE FUNCTION public.has_email_been_sent(
  target_user_id UUID,
  target_event_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.email_events 
    WHERE user_id = target_user_id 
      AND event_type = target_event_type 
      AND status = 'sent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_email_been_sent(UUID, TEXT) TO authenticated;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'EMAIL EVENTS SCHEMA DEPLOYED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables Updated:';
  RAISE NOTICE '  ✓ email_events (new table for event tracking)';
  RAISE NOTICE '  ✓ user_profiles (added email tracking columns)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '  ✓ Track all sent emails with status';
  RAISE NOTICE '  ✓ Prevent duplicate email sends';
  RAISE NOTICE '  ✓ Track first pack creation timestamp';
  RAISE NOTICE '  ✓ RLS policies for email event access';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  • has_email_been_sent(user_id, event_type) - Check if email already sent';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for email engagement system! 📧';
  RAISE NOTICE '============================================================================';
END $$;

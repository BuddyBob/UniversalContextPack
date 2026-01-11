-- ============================================================================
-- PACK REVIEWS SCHEMA - User Feedback System
-- ============================================================================
-- This migration adds the review system for collecting user feedback after
-- pack completion. Reviews are displayed on the homepage.
-- Run this in Supabase SQL Editor after the main schema is deployed.
-- ============================================================================

-- Enable UUID extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: pack_reviews
-- ============================================================================
-- Stores star ratings and optional feedback for completed packs

CREATE TABLE IF NOT EXISTS public.pack_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id text NOT NULL,  -- References packs_v2.pack_id
  user_email text NOT NULL,  -- Captured for display on homepage
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,  -- Optional short comment
  created_at timestamptz DEFAULT now(),
  
  -- Ensure one review per user per pack
  UNIQUE(user_id, pack_id)
);

-- Comments for documentation
COMMENT ON TABLE public.pack_reviews IS 'User reviews for completed packs with star ratings and feedback';
COMMENT ON COLUMN public.pack_reviews.rating IS 'Star rating from 1-5';
COMMENT ON COLUMN public.pack_reviews.feedback_text IS 'Optional short feedback text from user';
COMMENT ON COLUMN public.pack_reviews.user_email IS 'Email captured for display on homepage testimonials';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for fetching user's reviews
CREATE INDEX IF NOT EXISTS idx_pack_reviews_user 
  ON public.pack_reviews(user_id);

-- Index for fetching reviews by pack
CREATE INDEX IF NOT EXISTS idx_pack_reviews_pack 
  ON public.pack_reviews(pack_id);

-- Index for fetching recent reviews (for homepage)
CREATE INDEX IF NOT EXISTS idx_pack_reviews_created 
  ON public.pack_reviews(created_at DESC);

-- Index for fetching high-rated reviews
CREATE INDEX IF NOT EXISTS idx_pack_reviews_rating 
  ON public.pack_reviews(rating DESC, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.pack_reviews ENABLE ROW LEVEL SECURITY;

-- Users can read all reviews (for homepage display)
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.pack_reviews;
CREATE POLICY "Anyone can read reviews" ON public.pack_reviews
  FOR SELECT USING (true);

-- Users can only insert their own reviews
DROP POLICY IF EXISTS "Users can create own reviews" ON public.pack_reviews;
CREATE POLICY "Users can create own reviews" ON public.pack_reviews
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON public.pack_reviews;
CREATE POLICY "Users can update own reviews" ON public.pack_reviews
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.pack_reviews;
CREATE POLICY "Users can delete own reviews" ON public.pack_reviews
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Service role can manage all reviews
DROP POLICY IF EXISTS "Service role can manage reviews" ON public.pack_reviews;
CREATE POLICY "Service role can manage reviews" ON public.pack_reviews
  FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get recent reviews (for homepage)
CREATE OR REPLACE FUNCTION public.get_recent_reviews(
  limit_count integer DEFAULT 10,
  min_rating integer DEFAULT 4
)
RETURNS TABLE(
  id uuid,
  user_email text,
  rating integer,
  feedback_text text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.user_email,
    r.rating,
    r.feedback_text,
    r.created_at
  FROM public.pack_reviews r
  WHERE r.rating >= min_rating
    AND r.feedback_text IS NOT NULL
    AND r.feedback_text != ''
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to check if user has reviewed a pack
CREATE OR REPLACE FUNCTION public.has_reviewed_pack(
  user_uuid uuid,
  target_pack_id text
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  review_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.pack_reviews
    WHERE user_id = user_uuid AND pack_id = target_pack_id
  ) INTO review_exists;
  
  RETURN review_exists;
END;
$$;

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT ALL ON public.pack_reviews TO authenticated;

-- Grant access to service role (for backend operations)
GRANT ALL ON public.pack_reviews TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_recent_reviews(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_reviews(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.has_reviewed_pack(uuid, text) TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PACK REVIEWS SCHEMA MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Table Created:';
  RAISE NOTICE '  ✓ pack_reviews (star ratings and feedback)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '  ✓ Row Level Security (RLS) with public read access';
  RAISE NOTICE '  ✓ Indexes for efficient querying';
  RAISE NOTICE '  ✓ Unique constraint (one review per user per pack)';
  RAISE NOTICE '  ✓ Helper functions for review retrieval';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Created:';
  RAISE NOTICE '  ✓ get_recent_reviews() - Fetch reviews for homepage';
  RAISE NOTICE '  ✓ has_reviewed_pack() - Check if user reviewed pack';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Add POST /api/v2/packs/{pack_id}/review endpoint';
  RAISE NOTICE '  2. Create ReviewModal component in frontend';
  RAISE NOTICE '  3. Integrate modal with process-v3 page';
  RAISE NOTICE '';
  RAISE NOTICE 'Review system is ready for use! ⭐';
  RAISE NOTICE '============================================================================';
END $$;

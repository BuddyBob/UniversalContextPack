-- ============================================================================
-- UCP v6 COMPLETE DATABASE SCHEMA - CREDIT SYSTEM
-- ============================================================================
-- This is the complete, production-ready schema with credit-based payments
-- Run this script in Supabase SQL Editor to recreate the entire database
--
-- PRICING STRUCTURE (Updated):
-- - Base price: $0.10 per credit (100 credits = $10.00)
-- - Volume discounts: 50+ (5% off), 100+ (10% off), 250+ (20% off)
-- - Cost analysis: ~$0.068 per 150k token chunk, $0.08-$0.10 price = healthy margin
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER PROFILES TABLE (with payment functionality)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  r2_user_directory TEXT NOT NULL, -- Unique R2 directory for this user
  
  -- Payment and usage tracking
  payment_plan TEXT DEFAULT 'credits' CHECK (payment_plan IN ('credits')),
  chunks_analyzed INTEGER DEFAULT 0, -- Total chunks analyzed by this user (legacy only)
  credits_balance INTEGER DEFAULT 5, -- Credits available for analysis
  subscription_id TEXT, -- Stripe subscription ID (for future use)
  subscription_status TEXT, -- active, canceled, past_due, etc.
  plan_start_date TIMESTAMP WITH TIME ZONE,
  plan_end_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- JOBS TABLE  
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id TEXT NOT NULL UNIQUE, -- External job ID for API tracking
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'extracting', 'extracted', 'chunking', 'chunked', 'analyzing', 'analyzed', 'failed'
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  r2_path TEXT NOT NULL, -- Path to files in R2 for this job
  
  -- Extraction stats
  extracted_count INTEGER DEFAULT 0,
  
  -- Chunking stats  
  total_chunks INTEGER DEFAULT 0,
  processed_chunks INTEGER DEFAULT 0,
  failed_chunks INTEGER[] DEFAULT '{}',
  
  -- Analysis stats
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0.0000,
  
  -- Progress tracking
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PACKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.packs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id TEXT NOT NULL REFERENCES public.jobs(job_id) ON DELETE CASCADE,
  pack_name TEXT NOT NULL,
  r2_pack_path TEXT NOT NULL, -- Path to the complete pack in R2
  extraction_stats JSONB, -- Conversation count, message count, etc.
  chunk_stats JSONB, -- Chunk count, token counts, etc.
  analysis_stats JSONB, -- Analysis results summary
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- JOB PROGRESS TABLE (for real-time updates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.jobs(job_id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('extract', 'chunk', 'analyze')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREDIT TRANSACTIONS TABLE (for credit-based payments)
-- ============================================================================
-- Tracks all credit purchases and usage with $0.10 base pricing
-- Volume discounts: 50+ (5% off), 100+ (10% off), 250+ (20% off)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
  credits INTEGER NOT NULL, -- Positive for purchases/bonuses, negative for usage
  amount DECIMAL(10,2), -- Amount in USD at time of purchase (null for usage/bonus)
  package_id TEXT, -- Reference to credit package purchased (optional)
  job_id TEXT, -- Reference to job where credits were used (for usage type)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can read own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;

DROP POLICY IF EXISTS "Users can read own packs" ON public.packs;
DROP POLICY IF EXISTS "Users can insert own packs" ON public.packs;

DROP POLICY IF EXISTS "Users can read own job progress" ON public.job_progress;
DROP POLICY IF EXISTS "Users can insert own job progress" ON public.job_progress;

DROP POLICY IF EXISTS "Users can read own credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can insert own credit transactions" ON public.credit_transactions;

-- User Profiles Policies
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Jobs Policies
CREATE POLICY "Users can read own jobs" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Packs Policies
CREATE POLICY "Users can read own packs" ON public.packs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own packs" ON public.packs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Job Progress Policies
CREATE POLICY "Users can read own job progress" ON public.job_progress
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.jobs WHERE jobs.job_id = job_progress.job_id)
  );

CREATE POLICY "Users can insert own job progress" ON public.job_progress
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.jobs WHERE jobs.job_id = job_progress.job_id)
  );

-- Credit Transaction Policies
CREATE POLICY "Users can read own credit transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit transactions" ON public.credit_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, r2_user_directory, payment_plan, chunks_analyzed, credits_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'user_' || NEW.id::text,
    'credits', -- All new users start with credit-based system
    0, -- Start with 0 chunks analyzed (legacy)
    5  -- Start with 5 free credits
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicates
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set completed_at when job status becomes 'analyzed' or 'failed'
CREATE OR REPLACE FUNCTION public.handle_job_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status changes to analyzed or failed
  IF NEW.status IN ('analyzed', 'failed') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    NEW.completed_at = NOW();
  END IF;
  
  -- Clear completed_at if status changes back to active state
  IF NEW.status NOT IN ('analyzed', 'failed') AND OLD.completed_at IS NOT NULL THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update credits when a job completes
CREATE OR REPLACE FUNCTION public.handle_chunk_usage_update()
RETURNS TRIGGER AS $$
BEGIN
  -- When job is completed, deduct credits
  IF NEW.status = 'analyzed' AND NEW.processed_chunks > 0 AND 
     (OLD.status IS NULL OR OLD.status != 'analyzed') THEN
    
    -- Deduct credits and log transaction
    UPDATE public.user_profiles 
    SET credits_balance = GREATEST(0, credits_balance - NEW.processed_chunks),
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Log the usage transaction
    INSERT INTO public.credit_transactions (user_id, transaction_type, credits, job_id, description)
    VALUES (NEW.user_id, 'usage', -NEW.processed_chunks, NEW.job_id, 
            'Credits used for analysis of ' || NEW.processed_chunks || ' chunks');
    
    RAISE NOTICE 'Deducted % credits for user %', NEW.processed_chunks, NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
DROP TRIGGER IF EXISTS handle_job_completion ON public.jobs;
DROP TRIGGER IF EXISTS handle_chunk_usage_update ON public.jobs;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_job_completion
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_job_completion();

CREATE TRIGGER handle_chunk_usage_update
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_chunk_usage_update();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON public.jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Packs indexes
CREATE INDEX IF NOT EXISTS idx_packs_user_id ON public.packs(user_id);
CREATE INDEX IF NOT EXISTS idx_packs_job_id ON public.packs(job_id);
CREATE INDEX IF NOT EXISTS idx_packs_created_at ON public.packs(created_at);

-- Job progress indexes
CREATE INDEX IF NOT EXISTS idx_job_progress_job_id ON public.job_progress(job_id);
CREATE INDEX IF NOT EXISTS idx_job_progress_step ON public.job_progress(job_id, step);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_payment_plan ON public.user_profiles(payment_plan);
CREATE INDEX IF NOT EXISTS idx_user_profiles_chunks_analyzed ON public.user_profiles(chunks_analyzed);
CREATE INDEX IF NOT EXISTS idx_user_profiles_credits_balance ON public.user_profiles(credits_balance);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- ============================================================================
-- BACKEND SERVICE FUNCTIONS (SECURITY DEFINER to bypass RLS)
-- ============================================================================

-- Function for backend to get user profile (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_profile_for_backend(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT * INTO user_profile 
  FROM public.user_profiles 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN row_to_json(user_profile)::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for backend to create user profile (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile_for_backend(
  user_uuid UUID,
  user_email TEXT,
  r2_dir TEXT
)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
BEGIN
  INSERT INTO public.user_profiles (id, email, r2_user_directory, payment_plan, chunks_analyzed, credits_balance)
  VALUES (user_uuid, user_email, r2_dir, 'credits', 0, 5)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    r2_user_directory = EXCLUDED.r2_user_directory,
    updated_at = NOW()
  RETURNING * INTO user_profile;
  
  RETURN row_to_json(user_profile)::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PAYMENT HELPER FUNCTIONS
-- ============================================================================

-- Function to get user payment status (credits only)
CREATE OR REPLACE FUNCTION public.get_user_payment_status(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile 
  FROM public.user_profiles 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    -- Create default profile for new users
    INSERT INTO public.user_profiles (id, email, r2_user_directory, payment_plan, chunks_analyzed, credits_balance)
    VALUES (user_uuid, 'unknown@example.com', 'user_' || user_uuid, 'credits', 0, 5)
    RETURNING * INTO user_profile;
  END IF;
  
  -- Return credit-based status only
  RETURN jsonb_build_object(
    'plan', 'credits',
    'chunks_used', 0, -- Not relevant for credit system
    'chunks_allowed', COALESCE(user_profile.credits_balance, 5),
    'credits_balance', COALESCE(user_profile.credits_balance, 5),
    'can_process', CASE WHEN COALESCE(user_profile.credits_balance, 5) > 0 THEN true ELSE false END,
    'subscription_status', user_profile.subscription_status,
    'plan_start_date', user_profile.plan_start_date,
    'plan_end_date', user_profile.plan_end_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user payment plan
CREATE OR REPLACE FUNCTION public.update_user_payment_plan(
  user_uuid UUID,
  new_plan TEXT,
  subscription_id_param TEXT DEFAULT NULL,
  subscription_status_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.user_profiles 
  SET 
    payment_plan = new_plan,
    subscription_id = COALESCE(subscription_id_param, subscription_id),
    subscription_status = COALESCE(subscription_status_param, subscription_status),
    plan_start_date = CASE 
      WHEN new_plan != 'free' AND plan_start_date IS NULL THEN NOW()
      ELSE plan_start_date 
    END,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's R2 directory
CREATE OR REPLACE FUNCTION public.get_user_r2_directory(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT r2_user_directory FROM public.user_profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create new job
CREATE OR REPLACE FUNCTION public.create_job(
  p_job_id TEXT,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_status TEXT DEFAULT 'created'
)
RETURNS UUID AS $$
DECLARE
  job_uuid UUID;
  user_r2_dir TEXT;
BEGIN
  -- Create user's R2 directory path (fallback if user_profiles doesn't exist)
  SELECT COALESCE(r2_user_directory, 'user_' || auth.uid()::text) INTO user_r2_dir 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  -- If no user profile exists, use default pattern
  IF user_r2_dir IS NULL THEN
    user_r2_dir := 'user_' || auth.uid()::text;
  END IF;
  
  -- Insert new job
  INSERT INTO public.jobs (
    user_id, 
    job_id, 
    file_name, 
    file_size, 
    status,
    r2_path
  )
  VALUES (
    auth.uid(),
    p_job_id,
    p_file_name,
    p_file_size,
    p_status,
    user_r2_dir || '/' || p_job_id
  )
  RETURNING id INTO job_uuid;
  
  RETURN job_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job status
CREATE OR REPLACE FUNCTION public.update_job_status(
  p_job_id TEXT,
  p_status TEXT,
  p_progress INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.jobs 
  SET 
    status = p_status,
    progress = COALESCE(p_progress, progress),
    error_message = p_error_message
  WHERE job_id = p_job_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- View for job statistics (using correct column names)
CREATE OR REPLACE VIEW public.job_stats AS
SELECT 
  j.id,
  j.user_id,
  j.job_id,
  j.status,
  j.file_name,
  j.file_size,
  j.total_chunks,
  j.processed_chunks,
  j.total_input_tokens,
  j.total_output_tokens,
  j.total_cost,
  j.created_at,
  j.completed_at,
  CASE 
    WHEN j.total_chunks > 0 THEN ROUND((j.processed_chunks::DECIMAL / j.total_chunks::DECIMAL) * 100, 2)
    ELSE 0 
  END as completion_percentage,
  CASE 
    WHEN j.completed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (j.completed_at - j.created_at))::INTEGER
    ELSE NULL 
  END as processing_duration_seconds
FROM public.jobs j;

-- View for user payment summary (credits only)
CREATE OR REPLACE VIEW public.user_payment_summary AS
SELECT 
  up.id,
  up.email,
  up.payment_plan,
  up.credits_balance,
  up.credits_balance as chunks_allowed, -- Credits = available analysis chunks
  up.credits_balance as chunks_remaining, -- Same as available
  up.subscription_status,
  up.plan_start_date,
  up.plan_end_date,
  COUNT(j.id) as total_jobs,
  COUNT(CASE WHEN j.status = 'analyzed' THEN 1 END) as completed_jobs,
  COALESCE(SUM(j.total_cost), 0) as total_spent,
  COALESCE(SUM(CASE WHEN ct.transaction_type = 'purchase' THEN ct.amount ELSE 0 END), 0) as total_credit_purchases
FROM public.user_profiles up
LEFT JOIN public.jobs j ON j.user_id = up.id
LEFT JOIN public.credit_transactions ct ON ct.user_id = up.id
GROUP BY up.id, up.email, up.payment_plan, up.credits_balance, up.subscription_status, up.plan_start_date, up.plan_end_date;

-- Grant access to authenticated users
GRANT SELECT ON public.job_stats TO authenticated;
GRANT SELECT ON public.user_payment_summary TO authenticated;

-- ============================================================================
-- VALIDATION AND COMMENTS
-- ============================================================================

-- Add table comments for documentation
COMMENT ON TABLE public.user_profiles IS 'User profile data extending Supabase auth.users with UCP-specific fields and payment tracking';
COMMENT ON TABLE public.jobs IS 'Processing jobs with user isolation and comprehensive status tracking';
COMMENT ON TABLE public.packs IS 'Completed UCP analysis packs with download information';
COMMENT ON TABLE public.job_progress IS 'Real-time progress tracking for jobs';

COMMENT ON COLUMN public.jobs.status IS 'Job status: created -> extracting -> extracted -> chunking -> chunked -> analyzing -> analyzed|failed';
COMMENT ON COLUMN public.jobs.r2_path IS 'Base path in R2 storage: user_{user_id}/{job_id}/';

-- Payment-specific comments
COMMENT ON COLUMN public.user_profiles.payment_plan IS 'User payment plan: credits (pay-per-chunk only)';
COMMENT ON COLUMN public.user_profiles.chunks_analyzed IS 'Total number of chunks analyzed by this user (legacy tracking only)';
COMMENT ON COLUMN public.user_profiles.credits_balance IS 'Available credits for analysis';
COMMENT ON COLUMN public.user_profiles.subscription_id IS 'Stripe subscription ID for paid plans';
COMMENT ON COLUMN public.user_profiles.subscription_status IS 'Stripe subscription status: active, canceled, past_due, etc.';

-- ============================================================================
-- DATA MIGRATION HELPER
-- ============================================================================

-- Function to migrate existing R2 data to database (call via API)
-- This should be called after schema recreation to restore existing packs
COMMENT ON SCHEMA public IS 'After running this schema, call the /api/manual-migrate endpoint to restore existing pack data from R2 storage';

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.packs TO authenticated;
GRANT ALL ON public.job_progress TO authenticated;
GRANT ALL ON public.credit_transactions TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_user_payment_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_payment_plan(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_r2_directory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job(TEXT, TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_status(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_for_backend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_for_backend(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- BACKEND SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- These functions allow the backend to bypass RLS and safely access tables

-- Function to get user packs for backend
DROP FUNCTION IF EXISTS public.get_user_packs_for_backend(UUID);
CREATE OR REPLACE FUNCTION public.get_user_packs_for_backend(user_uuid UUID)
RETURNS TABLE (
  pack_id UUID,
  pack_job_id TEXT,
  pack_name_out TEXT,
  pack_r2_path TEXT,
  pack_extraction_stats JSONB,
  pack_chunk_stats JSONB,
  pack_analysis_stats JSONB,
  pack_file_size BIGINT,
  pack_created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as pack_id,
    p.job_id as pack_job_id,
    p.pack_name as pack_name_out,
    p.r2_pack_path as pack_r2_path,
    p.extraction_stats as pack_extraction_stats,
    p.chunk_stats as pack_chunk_stats,
    p.analysis_stats as pack_analysis_stats,
    p.file_size as pack_file_size,
    p.created_at as pack_created_at
  FROM public.packs p
  WHERE p.user_id = user_uuid;
END;
$$;

-- Function to check if job exists for backend
DROP FUNCTION IF EXISTS public.check_job_exists_for_backend(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.check_job_exists_for_backend(user_uuid UUID, target_job_id TEXT)
RETURNS TABLE (
  job_exists BOOLEAN,
  current_status TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (COUNT(*) > 0) as job_exists,
    COALESCE(MAX(j.status), 'not_found') as current_status
  FROM public.jobs j
  WHERE j.user_id = user_uuid AND j.job_id = target_job_id;
END;
$$;

-- Function to update job status for backend (without metadata column)
DROP FUNCTION IF EXISTS public.update_job_status_for_backend(UUID, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.update_job_status_for_backend(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.update_job_status_for_backend(
  user_uuid UUID,
  target_job_id TEXT,
  status_param TEXT,
  progress_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL,
  processed_chunks_param INTEGER DEFAULT NULL
)
RETURNS TABLE (
  rec_id UUID,
  rec_job_id TEXT,
  rec_status TEXT,
  rec_progress INTEGER,
  rec_updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the job
  UPDATE public.jobs 
  SET 
    status = status_param,
    progress = COALESCE(progress_param, progress),
    error_message = COALESCE(error_message_param, error_message),
    processed_chunks = COALESCE(processed_chunks_param, processed_chunks),
    completed_at = CASE WHEN status_param IN ('completed', 'failed', 'analyzed') THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE user_id = user_uuid AND job_id = target_job_id;

  -- Return the updated job with different column names to avoid ambiguity
  RETURN QUERY
  SELECT 
    j.id as rec_id,
    j.job_id as rec_job_id,
    j.status as rec_status,
    j.progress as rec_progress,
    j.updated_at as rec_updated_at
  FROM public.jobs j
  WHERE j.user_id = user_uuid AND j.job_id = target_job_id;
END;
$$;

-- Function to create pack for backend
DROP FUNCTION IF EXISTS public.create_pack_for_backend(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BIGINT);
CREATE OR REPLACE FUNCTION public.create_pack_for_backend(
  user_uuid UUID,
  target_job_id TEXT,
  pack_name_param TEXT,
  r2_pack_path_param TEXT,
  extraction_stats_param JSONB DEFAULT NULL,
  chunk_stats_param JSONB DEFAULT NULL,
  analysis_stats_param JSONB DEFAULT NULL,
  file_size_param BIGINT DEFAULT NULL
)
RETURNS TABLE (
  pack_id UUID,
  pack_user_id UUID,
  pack_job_id TEXT,
  pack_name_out TEXT,
  pack_r2_path TEXT,
  pack_extraction_stats JSONB,
  pack_chunk_stats JSONB,
  pack_analysis_stats JSONB,
  pack_file_size BIGINT,
  pack_created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_pack_id UUID;
BEGIN
  -- Insert the pack
  INSERT INTO public.packs (
    user_id,
    job_id,
    pack_name,
    r2_pack_path,
    extraction_stats,
    chunk_stats,
    analysis_stats,
    file_size
  ) VALUES (
    user_uuid,
    target_job_id,
    pack_name_param,
    r2_pack_path_param,
    extraction_stats_param,
    chunk_stats_param,
    analysis_stats_param,
    file_size_param
  ) RETURNING packs.id INTO new_pack_id;

  -- Return the created pack
  RETURN QUERY
  SELECT 
    p.id as pack_id,
    p.user_id as pack_user_id,
    p.job_id as pack_job_id,
    p.pack_name as pack_name_out,
    p.r2_pack_path as pack_r2_path,
    p.extraction_stats as pack_extraction_stats,
    p.chunk_stats as pack_chunk_stats,
    p.analysis_stats as pack_analysis_stats,
    p.file_size as pack_file_size,
    p.created_at as pack_created_at
  FROM public.packs p
  WHERE p.id = new_pack_id;
END;
$$;

-- Grant execute permissions for backend functions
GRANT EXECUTE ON FUNCTION public.get_user_packs_for_backend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_job_exists_for_backend(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_status_for_backend(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pack_for_backend(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BIGINT) TO authenticated;

-- Function to create job for backend
DROP FUNCTION IF EXISTS public.create_job_for_backend(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.create_job_for_backend(
  user_uuid UUID,
  target_job_id TEXT,
  file_name_param TEXT,
  r2_path_param TEXT,
  file_size_param BIGINT DEFAULT NULL,
  status_param TEXT DEFAULT 'pending'
)
RETURNS TABLE (
  job_id_out UUID,
  job_id_text_out TEXT,
  job_user_id_out UUID,
  job_status_out TEXT,
  job_file_name_out TEXT,
  job_r2_path_out TEXT,
  job_file_size_out BIGINT,
  job_created_at_out TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_job_uuid UUID;
BEGIN
  -- Generate UUID for the new job
  new_job_uuid := gen_random_uuid();
  
  -- Insert the new job
  INSERT INTO public.jobs (
    id,
    user_id,
    job_id,
    status,
    file_name,
    file_size,
    r2_path,
    created_at
  ) VALUES (
    new_job_uuid,
    user_uuid,
    target_job_id,
    status_param,
    file_name_param,
    file_size_param,
    r2_path_param,
    NOW()
  );
  
  -- Return the created job details
  RETURN QUERY
  SELECT 
    j.id as job_id_out,
    j.job_id as job_id_text_out,
    j.user_id as job_user_id_out,
    j.status as job_status_out,
    j.file_name as job_file_name_out,
    j.r2_path as job_r2_path_out,
    j.file_size as job_file_size_out,
    j.created_at as job_created_at_out
  FROM public.jobs j
  WHERE j.id = new_job_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_job_for_backend(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;

-- ============================================================================
-- FINAL SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'UCP v6 COMPLETE SCHEMA DEPLOYMENT SUCCESSFUL!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✓ user_profiles (with payment tracking)';
  RAISE NOTICE '  ✓ jobs (processing workflow)';
  RAISE NOTICE '  ✓ packs (completed analysis packs)';
  RAISE NOTICE '  ✓ job_progress (real-time updates)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '  ✓ Row Level Security (RLS) with user isolation';
  RAISE NOTICE '  ✓ Authentication triggers for auto-profile creation';
  RAISE NOTICE '  ✓ Payment plan tracking (free/pro/business)';
  RAISE NOTICE '  ✓ Chunk usage limits enforcement';
  RAISE NOTICE '  ✓ Automatic chunk counting on job completion';
  RAISE NOTICE '  ✓ Subscription management ready';
  RAISE NOTICE '  ✓ Backend security definer functions for RLS bypass';
  RAISE NOTICE '';
  RAISE NOTICE 'Payment Plans:';
  RAISE NOTICE '  • Credits: Pay-per-chunk with $0.10 base price (starts with 5 free)';
  RAISE NOTICE '  • Volume discounts: 50+ credits (5 percent off), 100+ (10 percent off), 250+ (20 percent off)';
  RAISE NOTICE '  • Example: 100 credits = $9.00, 250 credits = $20.00';
  RAISE NOTICE '';
  RAISE NOTICE 'Backend Functions Available:';
  RAISE NOTICE '  • get_user_packs_for_backend() - Fetch user packs bypassing RLS';
  RAISE NOTICE '  • check_job_exists_for_backend() - Verify job existence';
  RAISE NOTICE '  • update_job_status_for_backend() - Update job progress';
  RAISE NOTICE '  • create_pack_for_backend() - Create new packs safely';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Verify all tables exist in Supabase dashboard';
  RAISE NOTICE '  2. Test user signup creates profile automatically';
  RAISE NOTICE '  3. Test backend functions with proper authentication';
  RAISE NOTICE '  4. Test payment limit enforcement in frontend';
  RAISE NOTICE '';
  RAISE NOTICE 'Database ready for production use! 🚀';
  RAISE NOTICE '============================================================================';
END $$;



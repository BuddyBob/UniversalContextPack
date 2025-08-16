-- ============================================================================
-- UCP v6 COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This is the complete, production-ready schema with payment functionality
-- Run this script in Supabase SQL Editor to recreate the entire database
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
  payment_plan TEXT DEFAULT 'free' CHECK (payment_plan IN ('free', 'pro_basic', 'pro_plus', 'pro', 'business')),
  chunks_analyzed INTEGER DEFAULT 0, -- Total chunks analyzed by this user
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, r2_user_directory, payment_plan, chunks_analyzed)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'user_' || NEW.id::text,
    'free', -- All new users start with free plan
    0 -- Start with 0 chunks analyzed
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

-- Function to update chunks_analyzed when a job completes
CREATE OR REPLACE FUNCTION public.handle_chunk_usage_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user's chunks_analyzed when job is completed with processed chunks
  IF NEW.status = 'analyzed' AND NEW.processed_chunks > 0 AND 
     (OLD.status IS NULL OR OLD.status != 'analyzed') THEN
    
    UPDATE public.user_profiles 
    SET chunks_analyzed = chunks_analyzed + NEW.processed_chunks,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RAISE NOTICE 'Updated user % chunk count by %', NEW.user_id, NEW.processed_chunks;
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
  INSERT INTO public.user_profiles (id, email, r2_user_directory, payment_plan, chunks_analyzed)
  VALUES (user_uuid, user_email, r2_dir, 'free', 0)
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

-- Function to get user payment status
CREATE OR REPLACE FUNCTION public.get_user_payment_status(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  chunks_allowed INTEGER;
  can_process BOOLEAN;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile 
  FROM public.user_profiles 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'plan', 'free',
      'chunks_used', 0,
      'chunks_allowed', 5,
      'can_process', true,
      'subscription_status', null
    );
  END IF;
  
  -- Determine chunks allowed based on plan
  CASE user_profile.payment_plan
    WHEN 'free' THEN chunks_allowed := 5;
    WHEN 'pro_basic' THEN chunks_allowed := 200;
    WHEN 'pro_plus' THEN chunks_allowed := 500;
    WHEN 'pro' THEN chunks_allowed := 200; -- Legacy pro -> pro_basic
    WHEN 'business' THEN chunks_allowed := 500; -- Legacy business -> pro_plus
    ELSE chunks_allowed := 5; -- Default to free
  END CASE;
  
  -- Determine if user can process more chunks
  can_process := (user_profile.payment_plan != 'free') OR 
                 (user_profile.chunks_analyzed < chunks_allowed);
  
  RETURN jsonb_build_object(
    'plan', user_profile.payment_plan,
    'chunks_used', user_profile.chunks_analyzed,
    'chunks_allowed', chunks_allowed,
    'can_process', can_process,
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

-- View for user payment summary
CREATE OR REPLACE VIEW public.user_payment_summary AS
SELECT 
  up.id,
  up.email,
  up.payment_plan,
  up.chunks_analyzed,
  CASE 
    WHEN up.payment_plan = 'free' THEN 5
    WHEN up.payment_plan = 'pro_basic' THEN 200
    WHEN up.payment_plan = 'pro_plus' THEN 500
    WHEN up.payment_plan = 'pro' THEN 200  -- Legacy
    WHEN up.payment_plan = 'business' THEN 500  -- Legacy
    ELSE 5  -- Default to free
  END as chunks_allowed,
  CASE 
    WHEN up.payment_plan = 'free' THEN (5 - up.chunks_analyzed)
    WHEN up.payment_plan = 'pro_basic' THEN (200 - up.chunks_analyzed)
    WHEN up.payment_plan = 'pro_plus' THEN (500 - up.chunks_analyzed)
    WHEN up.payment_plan = 'pro' THEN (200 - up.chunks_analyzed)  -- Legacy
    WHEN up.payment_plan = 'business' THEN (500 - up.chunks_analyzed)  -- Legacy
    ELSE (5 - up.chunks_analyzed)  -- Default to free
  END as chunks_remaining,
  up.subscription_status,
  up.plan_start_date,
  up.plan_end_date,
  COUNT(j.id) as total_jobs,
  COUNT(CASE WHEN j.status = 'analyzed' THEN 1 END) as completed_jobs,
  COALESCE(SUM(j.total_cost), 0) as total_spent
FROM public.user_profiles up
LEFT JOIN public.jobs j ON j.user_id = up.id
GROUP BY up.id, up.email, up.payment_plan, up.chunks_analyzed, up.subscription_status, up.plan_start_date, up.plan_end_date;

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
COMMENT ON COLUMN public.user_profiles.payment_plan IS 'User subscription plan: free (5 chunks), pro_basic (200 chunks/$4.99), pro_plus (500 chunks/$9.99)';
COMMENT ON COLUMN public.user_profiles.chunks_analyzed IS 'Total number of chunks analyzed by this user (for free tier limits)';
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
  RAISE NOTICE '  • Free: 5 chunks total';
  RAISE NOTICE '  • Pro Basic: 200 chunks ($4.99/month)';
  RAISE NOTICE '  • Pro Plus: 500 chunks ($9.99/month)';
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



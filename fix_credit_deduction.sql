-- Fix for credit deduction issue - NON-DESTRUCTIVE
-- Create the missing update_job_status_with_costs_for_backend function
-- This function is called by the backend but was missing from the schema

-- Drop any existing versions of this function (handles signature conflicts)
DROP FUNCTION IF EXISTS public.update_job_status_with_costs_for_backend CASCADE;

CREATE OR REPLACE FUNCTION public.update_job_status_with_costs_for_backend(
  user_uuid UUID,
  target_job_id TEXT,
  status_param TEXT,
  progress_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL,
  processed_chunks_param INTEGER DEFAULT NULL,
  total_chunks_param INTEGER DEFAULT NULL,
  total_input_tokens_param INTEGER DEFAULT NULL,
  total_output_tokens_param INTEGER DEFAULT NULL,
  total_cost_param NUMERIC DEFAULT NULL
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
  -- Update job with cost tracking - only updates fields that are provided (non-NULL)
  UPDATE public.jobs 
  SET 
    status = status_param,
    progress = COALESCE(progress_param, progress),
    error_message = COALESCE(error_message_param, error_message),
    processed_chunks = COALESCE(processed_chunks_param, processed_chunks),
    total_chunks = COALESCE(total_chunks_param, total_chunks),
    total_input_tokens = COALESCE(total_input_tokens_param, total_input_tokens),
    total_output_tokens = COALESCE(total_output_tokens_param, total_output_tokens),
    total_cost = COALESCE(total_cost_param, total_cost),
    completed_at = CASE WHEN status_param IN ('completed', 'failed', 'analyzed') THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE user_id = user_uuid AND job_id = target_job_id;

  -- Return the updated job
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

GRANT EXECUTE ON FUNCTION public.update_job_status_with_costs_for_backend TO authenticated;

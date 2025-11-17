-- Fix pack_sources status constraint to support 3-step workflow
-- Steps: pending -> processing (extract+chunk) -> completed (ready for analysis) -> processing (analyzing) -> completed (fully done)
-- Simplified: pending -> processing -> ready_for_analysis -> analyzing -> completed -> failed

-- Drop the old constraint
ALTER TABLE public.pack_sources 
DROP CONSTRAINT IF EXISTS pack_sources_status_check;

-- Add new constraint with all required statuses
ALTER TABLE public.pack_sources
ADD CONSTRAINT pack_sources_status_check 
CHECK (status IN ('pending', 'processing', 'ready_for_analysis', 'analyzing', 'completed', 'failed'));

-- Update comment
COMMENT ON COLUMN public.pack_sources.status IS 'Source processing status: pending -> processing (extract/chunk) -> ready_for_analysis (awaiting credit confirmation) -> analyzing (AI analysis) -> completed | failed';

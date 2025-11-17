-- Fix credit deduction for pack sources
-- Add processed_chunks column and trigger to deduct credits

-- First, add the processed_chunks column to pack_sources if it doesn't exist
ALTER TABLE public.pack_sources 
ADD COLUMN IF NOT EXISTS processed_chunks INTEGER DEFAULT 0;

-- Add metadata column to credit_transactions if it doesn't exist
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Update the update_source_status function to accept processed_chunks
DROP FUNCTION IF EXISTS update_source_status CASCADE;

CREATE OR REPLACE FUNCTION update_source_status(
  user_uuid UUID,
  target_source_id TEXT,
  status_param TEXT,
  progress_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL,
  total_chunks_param INTEGER DEFAULT NULL,
  processed_chunks_param INTEGER DEFAULT NULL,  -- NEW: tracks chunks actually analyzed
  total_input_tokens_param BIGINT DEFAULT NULL,
  total_output_tokens_param BIGINT DEFAULT NULL,
  total_cost_param DECIMAL DEFAULT NULL
) RETURNS SETOF public.pack_sources AS $$
DECLARE
  target_pack_id TEXT;
  token_delta BIGINT := 0;
BEGIN
  -- Get the pack_id and calculate token delta
  SELECT ps.pack_id, COALESCE(total_output_tokens_param, 0) - COALESCE(ps.total_output_tokens, 0)
  INTO target_pack_id, token_delta
  FROM public.pack_sources ps
  WHERE ps.source_id = target_source_id;
  
  -- Update the source
  RETURN QUERY
  UPDATE public.pack_sources
  SET status = status_param,
      progress = COALESCE(progress_param, progress),
      error_message = error_message_param,
      total_chunks = COALESCE(total_chunks_param, total_chunks),
      processed_chunks = COALESCE(processed_chunks_param, processed_chunks),  -- NEW
      total_input_tokens = COALESCE(total_input_tokens_param, total_input_tokens),
      total_output_tokens = COALESCE(total_output_tokens_param, total_output_tokens),
      total_cost = COALESCE(total_cost_param, total_cost),
      completed_at = CASE WHEN status_param = 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE source_id = target_source_id AND user_id = user_uuid
  RETURNING *;
  
  -- Update pack's total token count
  IF token_delta != 0 THEN
    UPDATE public.packs_v2
    SET total_tokens = total_tokens + token_delta,
        last_updated = NOW(),
        updated_at = NOW()
    WHERE pack_id = target_pack_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to deduct credits when source completes
CREATE OR REPLACE FUNCTION handle_source_credit_deduction()
RETURNS TRIGGER AS $$
DECLARE
  user_plan TEXT;
BEGIN
  -- When source is completed, deduct credits based on processed_chunks
  IF NEW.status = 'completed' AND NEW.processed_chunks > 0 AND 
     (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Check if user has unlimited plan
    SELECT payment_plan INTO user_plan 
    FROM public.user_profiles 
    WHERE id = NEW.user_id;
    
    -- Only deduct credits for non-unlimited users
    IF user_plan != 'unlimited' THEN
      -- Deduct credits
      UPDATE public.user_profiles 
      SET credits_balance = GREATEST(0, credits_balance - NEW.processed_chunks),
          updated_at = NOW()
      WHERE id = NEW.user_id;
      
      -- Log the transaction
      INSERT INTO public.credit_transactions (user_id, transaction_type, credits, description, metadata)
      VALUES (NEW.user_id, 'usage', -NEW.processed_chunks, 
              'Credits used for analyzing source in pack', 
              jsonb_build_object('source_id', NEW.source_id, 'pack_id', NEW.pack_id, 'processed_chunks', NEW.processed_chunks));
      
      RAISE NOTICE 'Deducted % credits for source % (user %)', NEW.processed_chunks, NEW.source_id, NEW.user_id;
    ELSE
      -- Log unlimited usage for tracking
      INSERT INTO public.credit_transactions (user_id, transaction_type, credits, description, metadata)
      VALUES (NEW.user_id, 'unlimited_usage', 0, 
              'Unlimited plan usage - analyzed source in pack', 
              jsonb_build_object('source_id', NEW.source_id, 'pack_id', NEW.pack_id, 'processed_chunks', NEW.processed_chunks));
      
      RAISE NOTICE 'Unlimited user % analyzed source % with % chunks - no credits deducted', NEW.user_id, NEW.source_id, NEW.processed_chunks;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on pack_sources
DROP TRIGGER IF EXISTS handle_source_credit_deduction ON public.pack_sources;

CREATE TRIGGER handle_source_credit_deduction
  AFTER UPDATE ON public.pack_sources
  FOR EACH ROW
  EXECUTE FUNCTION handle_source_credit_deduction();

GRANT EXECUTE ON FUNCTION update_source_status TO authenticated;

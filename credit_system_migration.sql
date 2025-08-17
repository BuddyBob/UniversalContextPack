-- ============================================================================
-- CREDIT SYSTEM MIGRATION - UPDATED PRICING
-- ============================================================================
-- This script adds credit-based payment support with reasonable pricing
-- New pricing: $0.10 per credit (100 credits = $10.00)
-- Cost analysis: 150k tokens per chunk, GPT-5 nano = ~$0.068 cost, $0.10 price = good margin
-- ============================================================================

-- Add credits_balance column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 5; -- Everyone starts with 5 free credits

-- Update payment_plan check constraint to include 'credits'
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_payment_plan_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_payment_plan_check 
CHECK (payment_plan IN ('free', 'pro_basic', 'pro_plus', 'pro', 'business', 'credits'));

-- ============================================================================
-- CREDIT TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
  credits INTEGER NOT NULL, -- Positive for purchases/bonuses, negative for usage
  amount DECIMAL(10,2), -- Amount in USD (null for usage/bonus)
  package_id TEXT, -- Reference to credit package purchased
  job_id TEXT, -- Reference to job where credits were used (for usage type)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);

-- ============================================================================
-- UPDATED PAYMENT STATUS FUNCTION FOR CREDITS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_payment_status(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    user_profile RECORD;
    result JSON;
BEGIN
    -- Get user profile with credit balance
    SELECT * INTO user_profile 
    FROM public.user_profiles 
    WHERE id = user_uuid;
    
    -- If no profile exists, create one
    IF NOT FOUND THEN
        INSERT INTO public.user_profiles (id, email, r2_user_directory, payment_plan, credits_balance)
        VALUES (user_uuid, 'unknown@example.com', 'user_' || user_uuid, 'credits', 5)
        RETURNING * INTO user_profile;
    END IF;
    
    -- Handle credit-based system
    IF user_profile.payment_plan = 'credits' OR user_profile.credits_balance IS NOT NULL THEN
        result := json_build_object(
            'plan', 'credits',
            'chunks_used', 0, -- Not relevant for credit system
            'chunks_allowed', COALESCE(user_profile.credits_balance, 5),
            'credits_balance', COALESCE(user_profile.credits_balance, 5),
            'can_process', CASE WHEN COALESCE(user_profile.credits_balance, 5) > 0 THEN true ELSE false END,
            'subscription_status', user_profile.subscription_status,
            'plan_start_date', user_profile.plan_start_date,
            'plan_end_date', user_profile.plan_end_date
        );
    -- Handle legacy monthly plans
    ELSE
        -- Calculate chunks used vs allowed based on plan
        result := json_build_object(
            'plan', user_profile.payment_plan,
            'chunks_used', user_profile.chunks_analyzed,
            'chunks_allowed', CASE 
                WHEN user_profile.payment_plan = 'free' THEN 5
                WHEN user_profile.payment_plan IN ('pro_basic', 'pro_plus', 'pro', 'business') THEN 999999
                ELSE 5
            END,
            'credits_balance', COALESCE(user_profile.credits_balance, 5),
            'can_process', CASE 
                WHEN user_profile.payment_plan = 'free' AND user_profile.chunks_analyzed >= 5 THEN false
                ELSE true
            END,
            'subscription_status', user_profile.subscription_status,
            'plan_start_date', user_profile.plan_start_date,
            'plan_end_date', user_profile.plan_end_date
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION TO DEDUCT CREDITS WHEN ANALYSIS IS COMPLETED
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credits_for_analysis(user_uuid UUID, chunks_processed INTEGER, job_uuid TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
    user_plan TEXT;
BEGIN
    -- Get current credits and plan
    SELECT credits_balance, payment_plan INTO current_credits, user_plan
    FROM public.user_profiles 
    WHERE id = user_uuid;
    
    -- Only deduct credits for credit-based plans
    IF user_plan = 'credits' THEN
        -- Check if user has enough credits
        IF current_credits >= chunks_processed THEN
            -- Deduct credits
            UPDATE public.user_profiles 
            SET credits_balance = credits_balance - chunks_processed,
                updated_at = NOW()
            WHERE id = user_uuid;
            
            -- Log the usage transaction
            INSERT INTO public.credit_transactions (user_id, transaction_type, credits, job_id, description)
            VALUES (user_uuid, 'usage', -chunks_processed, job_uuid, 'Credits used for analysis of ' || chunks_processed || ' chunks');
            
            RETURN true;
        ELSE
            -- Not enough credits
            RETURN false;
        END IF;
    ELSE
        -- For monthly plans, don't deduct credits but update chunks_analyzed
        UPDATE public.user_profiles 
        SET chunks_analyzed = chunks_analyzed + chunks_processed,
            updated_at = NOW()
        WHERE id = user_uuid;
        
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED TRIGGER TO HANDLE CREDIT DEDUCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_job_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When a job is marked as 'analyzed', deduct credits
    IF NEW.status = 'analyzed' AND OLD.status != 'analyzed' THEN
        -- Deduct credits for the user
        PERFORM public.deduct_credits_for_analysis(NEW.user_id, NEW.processed_chunks, NEW.job_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trigger_job_completion ON public.jobs;

CREATE TRIGGER trigger_job_completion
    AFTER UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_job_completion();

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================
GRANT ALL ON public.credit_transactions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_payment_status(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits_for_analysis(UUID, INTEGER, TEXT) TO anon, authenticated;

-- ============================================================================
-- UPDATE EXISTING USERS TO CREDIT SYSTEM
-- ============================================================================
-- Give all existing free users 5 credits and switch them to credit system
UPDATE public.user_profiles 
SET credits_balance = 5, 
    payment_plan = 'credits'
WHERE payment_plan = 'free' AND credits_balance IS NULL;

-- Pro users keep their monthly plans but also get some credits as bonus
UPDATE public.user_profiles 
SET credits_balance = COALESCE(credits_balance, 50)
WHERE payment_plan IN ('pro_basic', 'pro_plus', 'pro', 'business');

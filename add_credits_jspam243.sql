-- Add 5 credits to jspam243@gmail.com
-- Run this in Supabase SQL Editor

UPDATE public.user_profiles
SET credits_balance = credits_balance + 5
WHERE email = 'jspam243@gmail.com';

-- Verify the update
SELECT email, credits_balance, payment_plan 
FROM public.user_profiles 
WHERE email = 'jspam243@gmail.com';

# MISSING COMPONENTS TO ADD TO YOUR PAYMENT SYSTEM

# 1. ADD CREDIT ROLLBACK FUNCTION
async def rollback_credits_for_failed_job(user_id: str, job_id: str, credits_to_refund: int):
    """Rollback credits if job fails after credits were deducted"""
    try:
        if not supabase:
            return
            
        # Add credits back and log as refund
        result = supabase.rpc("add_credits_to_user", {
            "user_uuid": user_id,
            "credits_to_add": credits_to_refund,
            "transaction_description": f"Credit refund for failed job {job_id} - {credits_to_refund} credits"
        }).execute()
        
        # Also log as separate refund transaction
        supabase.table("credit_transactions").insert({
            "user_id": user_id,
            "transaction_type": "refund",
            "credits": credits_to_refund,
            "job_id": job_id,
            "description": f"Job failure refund - {credits_to_refund} credits"
        }).execute()
        
        print(f"✅ Refunded {credits_to_refund} credits for failed job {job_id}")
        
    except Exception as e:
        print(f"❌ Error refunding credits: {e}")

# 2. ADD TO YOUR ANALYSIS FUNCTION - AFTER THE RESULTS CHECK:
if not results:
    # Rollback credits for failed job
    await rollback_credits_for_failed_job(user.user_id, job_id, chunks_to_process)
    raise HTTPException(status_code=500, detail=f"Failed to process any chunks. Credits refunded.")

# 3. MISSING PAYMENT VALIDATION
@app.post("/api/payment/validate-amount")
async def validate_payment_amount(request: dict):
    """Validate payment amount matches expected price"""
    credits = request.get("credits", 0)
    client_amount = request.get("amount", 0)
    
    expected_amount = calculate_credit_price(credits)
    
    if abs(client_amount - expected_amount) > 0.01:  # Allow 1 cent difference for rounding
        raise HTTPException(status_code=400, detail="Payment amount mismatch")
    
    return {"valid": True, "expected_amount": expected_amount}

# 4. MISSING RATE LIMITING
from datetime import datetime, timedelta
import asyncio

payment_attempts = {}  # In production, use Redis

@app.post("/api/payment/create-intent")
async def create_payment_intent_with_rate_limit(request: StripePaymentIntentRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Create Stripe payment intent with rate limiting"""
    
    # Rate limiting: max 5 payment attempts per hour per user
    now = datetime.utcnow()
    user_attempts = payment_attempts.get(user.user_id, [])
    
    # Clean old attempts
    user_attempts = [attempt for attempt in user_attempts if now - attempt < timedelta(hours=1)]
    
    if len(user_attempts) >= 5:
        raise HTTPException(status_code=429, detail="Too many payment attempts. Try again later.")
    
    # Add current attempt
    user_attempts.append(now)
    payment_attempts[user.user_id] = user_attempts
    
    # Continue with normal payment intent creation...

# 5. MISSING SUBSCRIPTION CANCELLATION HANDLING
@app.post("/api/subscription/cancel")
async def cancel_subscription(user: AuthenticatedUser = Depends(get_current_user)):
    """Cancel user subscription"""
    try:
        # Get user's subscription
        profile = supabase.table("user_profiles").select("subscription_id").eq("id", user.user_id).execute()
        
        if not profile.data or not profile.data[0].get("subscription_id"):
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        subscription_id = profile.data[0]["subscription_id"]
        
        # Cancel in Stripe
        stripe.Subscription.cancel(subscription_id)
        
        # Update database
        supabase.table("user_profiles").update({
            "subscription_status": "canceled",
            "plan_end_date": datetime.utcnow().isoformat()
        }).eq("id", user.user_id).execute()
        
        return {"status": "canceled"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {str(e)}")

# 6. MISSING PAYMENT HISTORY ENDPOINT
@app.get("/api/payment/history")
async def get_payment_history(user: AuthenticatedUser = Depends(get_current_user)):
    """Get user's payment and credit transaction history"""
    try:
        transactions = supabase.table("credit_transactions").select("*").eq("user_id", user.user_id).order("created_at", desc=True).limit(50).execute()
        
        return {
            "transactions": transactions.data,
            "total_purchased": sum(t["credits"] for t in transactions.data if t["transaction_type"] == "purchase"),
            "total_used": abs(sum(t["credits"] for t in transactions.data if t["transaction_type"] == "usage")),
            "total_refunded": sum(t["credits"] for t in transactions.data if t["transaction_type"] == "refund")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment history: {str(e)}")

# 7. MISSING CREDIT EXPIRATION (Optional but recommended)
# Add to your database schema:
"""
ALTER TABLE public.credit_transactions ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Function to expire old credits (run daily)
CREATE OR REPLACE FUNCTION expire_old_credits()
RETURNS void AS $$
BEGIN
  -- Expire credits older than 1 year
  UPDATE public.user_profiles 
  SET credits_balance = GREATEST(0, credits_balance - (
    SELECT COALESCE(SUM(credits), 0) 
    FROM public.credit_transactions 
    WHERE user_id = public.user_profiles.id 
    AND transaction_type = 'purchase' 
    AND expires_at < NOW()
    AND created_at < NOW() - INTERVAL '1 year'
  ))
  WHERE EXISTS (
    SELECT 1 FROM public.credit_transactions 
    WHERE user_id = public.user_profiles.id 
    AND expires_at < NOW()
  );
  
  -- Log expiration transactions
  INSERT INTO public.credit_transactions (user_id, transaction_type, credits, description)
  SELECT DISTINCT user_id, 'expiration', -credits, 'Credits expired after 1 year'
  FROM public.credit_transactions 
  WHERE expires_at < NOW() AND transaction_type = 'purchase';
  
END;
$$ LANGUAGE plpgsql;
"""

# 8. MISSING ADMIN PANEL FUNCTIONS
@app.get("/api/admin/payment-stats")
async def get_payment_stats(api_key: str = Header(None)):
    """Admin endpoint for payment statistics"""
    if api_key != os.getenv("ADMIN_API_KEY"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get payment statistics
        total_revenue = supabase.table("credit_transactions").select("amount").eq("transaction_type", "purchase").execute()
        total_users = supabase.table("user_profiles").select("id", count="exact").execute()
        
        return {
            "total_revenue": sum(t["amount"] or 0 for t in total_revenue.data),
            "total_users": total_users.count,
            "avg_revenue_per_user": sum(t["amount"] or 0 for t in total_revenue.data) / max(total_users.count, 1)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

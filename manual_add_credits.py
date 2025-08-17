#!/usr/bin/env python3
"""
Manual script to add credits to user account when webhook fails
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

def main():
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Supabase credentials not found")
        print("Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set")
        return
    
    # Create Supabase client
    supabase: Client = create_client(url, key)
    
    # Get user input
    if len(sys.argv) < 3:
        print("Usage: python manual_add_credits.py <user_email> <credits>")
        print("Example: python manual_add_credits.py user@example.com 25")
        return
    
    user_email = sys.argv[1]
    credits_to_add = int(sys.argv[2])
    
    try:
        # Find user by email
        user_result = supabase.auth.admin.list_users()
        user_id = None
        
        for user in user_result:
            if user.email == user_email:
                user_id = user.id
                break
        
        if not user_id:
            print(f"❌ User not found: {user_email}")
            return
        
        print(f"Found user: {user_email} (ID: {user_id})")
        
        # Check current balance
        profile_result = supabase.table("user_profiles").select("credits_balance").eq("id", user_id).execute()
        current_balance = 0
        if profile_result.data:
            current_balance = profile_result.data[0].get("credits_balance", 0)
        
        print(f"Current balance: {current_balance} credits")
        
        # Add credits using the database function
        result = supabase.rpc("add_credits_to_user", {
            "user_uuid": user_id,
            "credits_to_add": credits_to_add
        }).execute()
        
        if result.data:
            print(f"✅ Successfully added {credits_to_add} credits")
            
            # Verify new balance
            new_profile_result = supabase.table("user_profiles").select("credits_balance").eq("id", user_id).execute()
            if new_profile_result.data:
                new_balance = new_profile_result.data[0].get("credits_balance", 0)
                print(f"New balance: {new_balance} credits")
            
            # Create transaction record
            transaction_data = {
                "user_id": user_id,
                "transaction_type": "manual_add",
                "credits": credits_to_add,
                "amount": credits_to_add * 0.10,  # Assuming $0.10 per credit
                "stripe_payment_id": "manual_adjustment",
                "description": f"Manual credit adjustment: +{credits_to_add} credits"
            }
            
            supabase.table("credit_transactions").insert(transaction_data).execute()
            print("✅ Transaction record created")
            
        else:
            print("❌ Failed to add credits")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Quick diagnostic script to check if the unlimited plan purchase flow is working
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = "http://localhost:8000"
EMAIL = "ayohn@wagepoint.com"

def check_user_status():
    """Check the current status of the user"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/debug/check-user/{EMAIL}")
        if response.status_code == 200:
            data = response.json()
            print("✅ User found:")
            print(f"   Email: {data['user']['email']}")
            print(f"   Payment Plan: {data['user']['payment_plan']}")
            print(f"   Credits Balance: {data['user']['credits_balance']}")
            print(f"   Subscription Status: {data['user']['subscription_status']}")
            print(f"   Plan Start Date: {data['user']['plan_start_date']}")
            
            if data.get('recent_transactions'):
                print("\n📄 Recent Transactions:")
                for tx in data['recent_transactions'][:3]:
                    print(f"   - {tx['transaction_type']}: {tx['credits']} credits, ${tx.get('amount', 'N/A')}")
                    print(f"     Description: {tx['description']}")
                    print(f"     Date: {tx['created_at']}")
        else:
            print(f"❌ Failed to check user: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error checking user: {e}")

def check_database_function():
    """Check if the database function exists"""
    try:
        # This would require direct database access, but we can infer from the grant attempt
        response = requests.post(f"{BACKEND_URL}/api/debug/grant-unlimited", 
                                json={"email": EMAIL})
        if response.status_code == 200:
            data = response.json()
            print("✅ Database function works:")
            print(f"   Success: {data.get('success', False)}")
            print(f"   Message: {data.get('message', 'No message')}")
        else:
            print(f"❌ Database function test failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error testing database function: {e}")

def main():
    print("🔍 UNLIMITED PLAN PURCHASE DIAGNOSTIC")
    print("=" * 50)
    
    print("\n1. Checking user current status...")
    check_user_status()
    
    print("\n2. Testing database function...")
    check_database_function()
    
    print("\n3. Common issues and solutions:")
    print("   - If payment_plan is not 'unlimited' after purchase:")
    print("     • Check if fix_unlimited_function.sql was run in Supabase")
    print("     • Check Stripe webhook logs for errors")
    print("     • Verify webhook endpoint is receiving events")
    print("   - If credits_balance is not 999999:")
    print("     • Database function may have failed")
    print("     • Check Supabase logs for errors")
    print("   - If no recent $3.99 transaction:")
    print("     • Webhook may not be processing unlimited purchases")
    print("     • Check metadata in Stripe dashboard")

if __name__ == "__main__":
    main()
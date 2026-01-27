"""
Manual Incomplete Activation Email Sender
==========================================
Sends incomplete activation emails to the most recent 20 users with 10 credits.

Usage:
  python send_incomplete_activation_manual.py
"""

import os
import sys
import time
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

# Import email service
try:
    from email_service import (
        send_incomplete_activation_email,
        log_email_event,
        update_user_email_flag
    )
except ImportError:
    print("❌ Error: email_service module not found in the same directory")
    sys.exit(1)

# Load environment variables
load_dotenv(override=True)

# Initialize Supabase client
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: Supabase credentials not found in environment")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
print("✅ Supabase client initialized")


def send_emails_to_10_credit_users():
    """
    Find the most recent 20 users with exactly 10 credits and send them 
    the incomplete activation email.
    
    Returns:
        Dictionary with stats about emails sent
    """
    try:
        print("\n" + "="*70)
        print("MANUAL INCOMPLETE ACTIVATION EMAIL SENDER - Starting")
        print("="*70)
        
        # Query for users with exactly 10 credits who haven't received the email
        # Order by created_at descending to get most recent users first
        query = supabase.table("user_profiles").select(
            "id, email, full_name, created_at, credits_balance, incomplete_activation_email_sent"
        ).eq(
            "credits_balance", 10
        ).eq(
            "incomplete_activation_email_sent", False
        ).order(
            "created_at", desc=True
        ).limit(20)
        
        result = query.execute()
        
        users_to_email = result.data if result.data else []
        
        print(f"\n📊 Found {len(users_to_email)} users with 10 credits who need the email\n")
        
        if not users_to_email:
            print("✅ No users match the criteria at this time")
            return {
                "total_found": 0,
                "emails_sent": 0,
                "emails_failed": 0
            }
        
        # Display user list for confirmation
        print("Users to email:")
        print("-" * 70)
        for i, user in enumerate(users_to_email, 1):
            print(f"{i}. {user['email']} - Created: {user['created_at']}")
        print("-" * 70)
        
        # Ask for confirmation
        confirmation = input("\nDo you want to send emails to these users? (yes/no): ")
        if confirmation.lower() not in ['yes', 'y']:
            print("❌ Email sending cancelled by user")
            return {
                "total_found": len(users_to_email),
                "emails_sent": 0,
                "emails_failed": 0,
                "cancelled": True
            }
        
        # Send emails
        stats = {
            "total_found": len(users_to_email),
            "emails_sent": 0,
            "emails_failed": 0,
            "users_emailed": []
        }
        
        print("\n" + "="*70)
        print("SENDING EMAILS")
        print("="*70 + "\n")
        
        for i, user in enumerate(users_to_email, 1):
            user_id = user["id"]
            email = user["email"]
            full_name = user.get("full_name")
            created_at = user["created_at"]
            
            # Extract first name from full name or email
            first_name = None
            if full_name:
                first_name = full_name.split()[0] if full_name else None
            elif email:
                # Extract first part of email before @ and handle dots
                email_prefix = email.split('@')[0]
                first_name = email_prefix.replace('.', ' ').title()
            
            print(f"[{i}/{len(users_to_email)}] 📧 Sending to: {email}")
            print(f"   User ID: {user_id[:8]}...")
            print(f"   Account created: {created_at}")
            print(f"   First name: {first_name or 'there'}")
            
            # Send email
            resend_email_id = send_incomplete_activation_email(
                user_email=email,
                first_name=first_name
            )
            
            if resend_email_id:
                # Mark as sent in database
                update_user_email_flag(
                    supabase_client=supabase,
                    user_id=user_id,
                    flag_name="incomplete_activation_email_sent",
                    value=True
                )
                
                # Log email event
                log_email_event(
                    supabase_client=supabase,
                    user_id=user_id,
                    event_type="incomplete_activation",
                    email_address=email,
                    status="sent",
                    resend_email_id=resend_email_id
                )
                
                stats["emails_sent"] += 1
                stats["users_emailed"].append(email)
                print(f"   ✅ Email sent successfully (ID: {resend_email_id})")
            else:
                stats["emails_failed"] += 1
                print(f"   ❌ Email failed to send")
                
                # Log failed email event
                log_email_event(
                    supabase_client=supabase,
                    user_id=user_id,
                    event_type="incomplete_activation",
                    email_address=email,
                    status="failed",
                    error_message="Resend API returned None"
                )
            
            # Rate limiting: Wait between emails to avoid hitting API limits
            # Wait 10 seconds between emails (same as email_scheduler.py)
            if i < len(users_to_email):  # Don't wait after the last email
                print(f"   ⏳ Waiting 10 seconds before next email...")
                time.sleep(10)
            
            print()  # Blank line between users
        
        # Print summary
        print("="*70)
        print("SUMMARY")
        print("="*70)
        print(f"Total users found:     {stats['total_found']}")
        print(f"Emails sent:           {stats['emails_sent']}")
        print(f"Emails failed:         {stats['emails_failed']}")
        if stats['users_emailed']:
            print(f"\nEmails sent to:")
            for email in stats['users_emailed']:
                print(f"  - {email}")
        print("="*70 + "\n")
        
        return stats
        
    except Exception as e:
        print(f"\n❌ Error in send_emails_to_10_credit_users: {e}")
        import traceback
        traceback.print_exc()
        return {
            "total_found": 0,
            "emails_sent": 0,
            "emails_failed": 0,
            "error": str(e)
        }


if __name__ == "__main__":
    print(f"\n🚀 Manual Email Sender started at {datetime.now(timezone.utc).isoformat()}\n")
    
    stats = send_emails_to_10_credit_users()
    
    print(f"🏁 Manual Email Sender finished at {datetime.now(timezone.utc).isoformat()}")
    
    # Exit with non-zero code if there were errors
    if stats.get("error"):
        sys.exit(1)
    else:
        sys.exit(0)

"""
Email Scheduler - Incomplete Activation Nudge
==============================================
Sends reminder emails to users who created an account but haven't created any packs.

Runs as a scheduled task (cron job or similar).
Checks for users who:
1. Created account 24-48 hours ago
2. Have not created any packs
3. Haven't already received the nudge email

Usage:
  python email_scheduler.py
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone
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


def send_incomplete_activation_nudges():
    """
    Find users who need activation nudge and send them emails.
    
    Returns:
        Dictionary with stats about emails sent
    """
    try:
        print("\n" + "="*70)
        print("INCOMPLETE ACTIVATION NUDGE - Starting")
        print("="*70)
        
        # Calculate time window: 24-48 hours ago
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(hours=48)  # 48 hours ago
        window_end = now - timedelta(hours=24)    # 24 hours ago
        
        print(f"⏰ Looking for users created between:")
        print(f"   Start: {window_start.isoformat()}")
        print(f"   End:   {window_end.isoformat()}")
        
        # Query users who need the nudge
        # Conditions:
        # 1. created_at between 24-48 hours ago
        # 2. first_pack_created_at is NULL (no packs created)
        # 3. incomplete_activation_email_sent is false
        query = supabase.table("user_profiles").select(
            "id, email, full_name, created_at"
        ).gte(
            "created_at", window_start.isoformat()
        ).lte(
            "created_at", window_end.isoformat()
        ).is_(
            "first_pack_created_at", "null"
        ).eq(
            "incomplete_activation_email_sent", False
        )
        
        result = query.execute()
        
        users_to_nudge = result.data if result.data else []
        
        print(f"\n📊 Found {len(users_to_nudge)} users who need activation nudge\n")
        
        if not users_to_nudge:
            print("✅ No users need nudge at this time")
            return {
                "total_found": 0,
                "emails_sent": 0,
                "emails_failed": 0
            }
        
        # Send emails
        stats = {
            "total_found": len(users_to_nudge),
            "emails_sent": 0,
            "emails_failed": 0,
            "users_emailed": []
        }
        
        for user in users_to_nudge:
            user_id = user["id"]
            email = user["email"]
            full_name = user.get("full_name")
            created_at = user["created_at"]
            
            # Extract first name from full name
            first_name =None
            if full_name:
                first_name = full_name.split()[0] if full_name else None
            
            print(f"📧 Sending nudge to: {email} (User ID: {user_id[:8]}...)")
            print(f"   Account created: {created_at}")
            
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
            
            # Rate limiting: Wait 0.6s between emails (Resend limit: 2 req/sec)
            # Each email = 2 requests (fetch template + send), so 0.6s = safe
            time.sleep(10)
            print()  # Blank line between users
        
        # Print summary
        print("="*70)
        print("SUMMARY")
        print("="*70)
        print(f"Total users found:     {stats['total_found']}")
        print(f"Emails sent:           {stats['emails_sent']}")
        print(f"Emails failed:         {stats['emails_failed']}")
        print("="*70 + "\n")
        
        return stats
        
    except Exception as e:
        print(f"\n❌ Error in send_incomplete_activation_nudges: {e}")
        import traceback
        traceback.print_exc()
        return {
            "total_found": 0,
            "emails_sent": 0,
            "emails_failed": 0,
            "error": str(e)
        }


if __name__ == "__main__":
    print(f"\n🚀 Email Scheduler started at {datetime.now(timezone.utc).isoformat()}\n")
    
    stats = send_incomplete_activation_nudges()
    
    print(f"🏁 Email Scheduler finished at {datetime.now(timezone.utc).isoformat()}")
    
    # Exit with non-zero code if there were errors
    if stats.get("error"):
        sys.exit(1)
    else:
        sys.exit(0)

"""
Email Service Module
====================
Handles all email sending via Resend API using templates.
Tracks email events in database to prevent duplicate sends.
"""

import os
from typing import Optional, Dict
import resend
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Initialize Resend API
resend.api_key = os.getenv("RESEND_API_KEY")

# Resend Template IDs (from Resend dashboard)
TEMPLATE_ACCOUNT_CREATION = "3828e17b-1a7a-4ebc-a299-c73f5fba56c8"
TEMPLATE_INCOMPLETE_ACTIVATION = "77197fba-bc10-4b0a-9ae2-01b32ac4df53"
# TEMPLATE_FIRST_ACTION = "TBD"  # Not implemented yet

# Email sender
EMAIL_FROM = "Context Pack <noreply@context-pack.com>"


def send_template_email(
    to_email: str,
    template_id: str,
    variables: Dict[str, str],
    from_email: str = EMAIL_FROM
) -> Optional[str]:
    """
    Send email using Resend template (created in Resend dashboard).
    
    Args:
        to_email: Recipient email address
        template_id: Resend template ID
        variables: Dictionary of template variables
        from_email: Sender email address (must be verified domain)
        
    Returns:
        Resend email ID if successful, None if failed
    """
    try:
        print(f"📧 Sending template email to {to_email} (template: {template_id})")
        
        # Fetch the template to get its content
        template = resend.Templates.get(template_id)
        
        # Get template HTML and subject
        template_html = template.get('html', '')
        template_subject = template.get('subject', 'Email from Context Pack')
        
        # Substitute variables in the HTML (Resend uses {{variable_name}} syntax)
        email_html = template_html
        for key, value in variables.items():
            # Support both {{key}} and {{{key}}} (handlebars syntax)
            email_html = email_html.replace(f"{{{{{key}}}}}", value)
            email_html = email_html.replace(f"{{{{{{{key}}}}}}}", value)
        
        # Send the email with substituted HTML
        response = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": template_subject,
            "html": email_html
        })
        
        # Response is a dict with 'id' field
        email_id = response.get('id')
        print(f"✅ Email sent successfully: {email_id}")
        return email_id
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return None


def send_account_creation_email(
    user_email: str,
    first_name: Optional[str] = None
) -> Optional[str]:
    """
    Send account creation welcome email.
    
    Args:
        user_email: New user's email address
        first_name: User's first name (optional, defaults to "there")
        
    Returns:
        Resend email ID if successful, None if failed
    """
    variables = {
        "first_name": first_name or "there"
    }
    
    return send_template_email(
        to_email=user_email,
        template_id=TEMPLATE_ACCOUNT_CREATION,
        variables=variables
    )


def send_incomplete_activation_email(
    user_email: str,
    first_name: Optional[str] = None
) -> Optional[str]:
    """
    Send incomplete activation nudge email (24-48h after signup, no packs created).
    
    Args:
        user_email: User's email address
        first_name: User's first name (optional, defaults to "there")
        
    Returns:
        Resend email ID if successful, None if failed
    """
    variables = {
        "first_name": first_name or "there"
    }
    
    return send_template_email(
        to_email=user_email,
        template_id=TEMPLATE_INCOMPLETE_ACTIVATION,
        variables=variables
    )


def log_email_event(
    supabase_client,
    user_id: str,
    event_type: str,
    email_address: str,
    status: str = "sent",
    resend_email_id: Optional[str] = None,
    error_message: Optional[str] = None
) -> bool:
    """
    Log email event to database.
    
    Args:
        supabase_client: Supabase client instance
        user_id: User UUID
        event_type: Type of email ('account_created', 'incomplete_activation', etc.)
        email_address: Email address where email was sent
        status: Email status ('sent', 'failed', 'bounced')
        resend_email_id: Resend's email ID for tracking
        error_message: Error message if failed
        
    Returns:
        True if logged successfully, False otherwise
    """
    try:
        supabase_client.table("email_events").insert({
            "user_id": user_id,
            "event_type": event_type,
            "email_address": email_address,
            "status": status,
            "resend_email_id": resend_email_id,
            "error_message": error_message
        }).execute()
        
        print(f"✅ Logged email event: {event_type} for user {user_id}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to log email event: {e}")
        return False


def update_user_email_flag(
    supabase_client,
    user_id: str,
    flag_name: str,
    value: bool = True
) -> bool:
    """
    Update email sent flag in user_profiles.
    
    Args:
        supabase_client: Supabase client instance
        user_id: User UUID
        flag_name: Column name ('account_creation_email_sent', etc.)
        value: Boolean value to set
        
    Returns:
        True if updated successfully, False otherwise
    """
    try:
        supabase_client.table("user_profiles").update({
            flag_name: value
        }).eq("id", user_id).execute()
        
        print(f"✅ Updated {flag_name} = {value} for user {user_id}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to update user email flag: {e}")
        return False


def has_email_been_sent(
    supabase_client,
    user_id: str,
    event_type: str
) -> bool:
    """
    Check if a specific email has already been sent to user.
    
    Args:
        supabase_client: Supabase client instance
        user_id: User UUID
        event_type: Type of email to check
        
    Returns:
        True if email was already sent, False otherwise
    """
    try:
        result = supabase_client.rpc(
            "has_email_been_sent",
            {
                "target_user_id": user_id,
                "target_event_type": event_type
            }
        ).execute()
        
        return result.data if result.data is not None else False
        
    except Exception as e:
        print(f"❌ Failed to check email status: {e}")
        # On error, assume email was sent to avoid spam
        return True


# Example usage:
if __name__ == "__main__":
    # Test account creation email
    email_id = send_account_creation_email(
        user_email="test@example.com",
        first_name="John"
    )
    print(f"Email ID: {email_id}")
    
    # Test incomplete activation email
    email_id = send_incomplete_activation_email(
        user_email="test@example.com",
        first_name="Jane"
    )
    print(f"Email ID: {email_id}")

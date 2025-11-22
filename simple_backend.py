from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Request, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import json
import uuid
import os
import io
import ssl
import urllib3
import asyncio
import traceback
import time
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
import tiktoken
import zipfile

# Import credit configuration
from credit_config import get_new_user_credits
from openai import OpenAI
import boto3
from botocore.config import Config
import html
from html.parser import HTMLParser
import re
import jwt
import hashlib
import hmac
import unicodedata
import re
import requests
import certifi
import traceback
from PyPDF2 import PdfReader
from supabase import create_client, Client
from dotenv import load_dotenv
import stripe
from collections import defaultdict
from datetime import timedelta
import stripe
from urllib.parse import urlparse

# Load environment variables with override to refresh from file
load_dotenv(override=True)

def reload_env_vars():
    """Reload environment variables from .env file"""
    load_dotenv(override=True)
    global OPENAI_API_KEY
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    return OPENAI_API_KEY

# Configuration from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Get this from Supabase Project Settings -> API

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_SECRET_KEY

# R2 configuration
R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY") 
R2_BUCKET = os.getenv("R2_BUCKET_NAME")

# Create a properly configured requests session with SSL verification
r2_session = requests.Session()
r2_session.verify = certifi.where()  # Use Mozilla's certificate bundle
print(f"🔒 SSL verification enabled using certificates from: {certifi.where()}")


# Initialize Supabase client
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"✅ Supabase client initialized with service role key (length: {len(SUPABASE_SERVICE_KEY)})")
    print(f"   Service key starts with: {SUPABASE_SERVICE_KEY[:20]}...")
else:
    print("Warning: Supabase credentials not found. Running in legacy mode.")
    supabase = None

app = FastAPI(title="Simple UCP Backend", version="1.0.0")

# CORS middleware - Configure allowed origins from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "https://www.context-pack.com").split(",")
# Add additional domains that might be accessing the API
additional_origins = [
    "https://www.context-pack.com",
    "https://context-pack.com",                   
    "https://universal-context-pack.vercel.app",
    "https://universalcontextpack.vercel.app", 
    "http://localhost:3000",
    "http://localhost:3001",
    "*"  # Allow all origins temporarily to debug CORS issue
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins temporarily
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request timeout and connection handling middleware
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    """Add request timeout handling to prevent server stalling"""
    import asyncio
    import time
    
    start_time = time.time()
    
    # Set different timeouts based on endpoint
    request_path = str(request.url.path) if hasattr(request.url, 'path') else str(request.url)
    
    if "/api/analyze/" in request_path or "/api/extract" in request_path:
        timeout_seconds = 3600  # 60 minutes for analysis/extraction (increased from 30)
    elif "/api/progress-stream/" in request_path:
        timeout_seconds = 1800   # 30 minutes for streaming endpoints (increased from 15)
    elif "/api/health" in request_path or request_path == "/":
        timeout_seconds = 10    # 10 seconds for health checks
    else:
        timeout_seconds = 300   # 5 minutes for other endpoints (increased from 2)
    
    try:
        # Execute request with timeout
        response = await asyncio.wait_for(
            call_next(request),
            timeout=timeout_seconds
        )
        
        # Add processing time header
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(round(process_time, 4))
        
        return response
        
    except asyncio.TimeoutError:
        print(f"Request timeout after {timeout_seconds}s for {request.url}")
        # More user-friendly timeout messages based on endpoint
        if "/api/analyze/" in request_path:
            detail_msg = f"Analysis timeout after {timeout_seconds//60} minutes. This may happen with very large files or during high server load. Please try again or contact support."
        elif "/api/extract" in request_path:
            detail_msg = f"Text extraction timeout after {timeout_seconds//60} minutes. Please try with a smaller file or contact support."
        else:
            detail_msg = f"Request timeout after {timeout_seconds} seconds. Please try again."
            
        return JSONResponse(
            status_code=408,
            content={
                "detail": detail_msg,
                "timeout_seconds": timeout_seconds,
                "endpoint": str(request.url),
                "suggestion": "Try refreshing the page and starting the process again. For large files, consider splitting them into smaller chunks."
            }
        )
    except Exception as e:
        print(f"Request middleware error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Server error: {str(e)}"}
        )

# Authentication
security = HTTPBearer()

# Rate limiting storage (in production, use Redis)
payment_attempts = defaultdict(list)
analysis_attempts = defaultdict(list)

def check_rate_limit(user_id: str, limit_type: str = "payment", max_attempts: int = 5, window_hours: int = 1):
    """Check if user has exceeded rate limit"""
    now = datetime.utcnow()
    window_start = now - timedelta(hours=window_hours)
    
    # Choose the right storage
    attempts_storage = payment_attempts if limit_type == "payment" else analysis_attempts
    
    # Clean old attempts
    user_attempts = [attempt for attempt in attempts_storage[user_id] if attempt > window_start]
    attempts_storage[user_id] = user_attempts
    
    # Check if limit exceeded
    if len(user_attempts) >= max_attempts:
        return False, len(user_attempts)
    
    # Add current attempt
    attempts_storage[user_id].append(now)
    return True, len(user_attempts) + 1

# Email notification service
async def send_email_notification(user_email: str, job_id: str, chunks_processed: int, total_chunks: int, success: bool = True):
    """Send email notification when a large job completes"""
    try:
        # Get email configuration from environment
        EMAIL_HOST = os.getenv("EMAIL_HOST")  # e.g., smtp.gmail.com
        EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
        EMAIL_USER = os.getenv("EMAIL_USER")  # Your email address
        EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")  # App password or email password
        EMAIL_FROM = os.getenv("EMAIL_FROM", EMAIL_USER)  # From email address
        
        if success:
            subject = "🎉 Your Universal Context Pack is Ready!"
            message = f"""
Hello!

Your Universal Context Pack has been completed successfully and is now available for download.

Job Details:
- Job ID: {job_id}
- Chunks Processed: {chunks_processed}/{total_chunks}
- Status: Successfully Completed

Your Context Pack is ready for download. You can access it by visiting:
{os.getenv('FRONTEND_URL', 'https://www.context-pack.com')}/packs

Thank you for using Universal Context Pack!

Best regards,
The UCP Team
"""
        else:
            subject = "❌ Your Universal Context Pack Analysis Failed"
            message = f"""
Hello!

Unfortunately, your Universal Context Pack analysis encountered an error and could not be completed.

Job Details:
- Job ID: {job_id}
- Chunks Processed: {chunks_processed}/{total_chunks}
- Status: Failed

Please try again or contact our support team if the issue persists.

Best regards,
The UCP Team
"""
        
        # For now, just log the email (replace with actual email service)
        print(f"📧 EMAIL NOTIFICATION for {user_email}:")
        print(f"Subject: {subject}")
        print(f"Message: {message}")
        
        # Try webhook-based email service as primary option (more reliable on Railway)
        WEBHOOK_EMAIL_URL = os.getenv("WEBHOOK_EMAIL_URL")  # Optional webhook email service
        RESEND_API_KEY = os.getenv("RESEND_API_KEY")  # Resend.com API key
        
        if RESEND_API_KEY:
            try:
                import requests
                
                print(f"📧 Attempting to send email via Resend API...")
                
                # Use verified domain for from address
                from_email = "noreply@context-pack.com"  # Use your verified domain
                
                response = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": f"Universal Context Pack <{from_email}>",
                        "to": [user_email],
                        "subject": subject,
                        "text": message
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    print(f"✅ Email sent successfully via Resend to {user_email}")
                    return True
                else:
                    print(f"❌ Resend API failed: {response.status_code} - {response.text}")
                    
            except Exception as resend_error:
                print(f"❌ Resend email service failed: {resend_error}")
        
        elif WEBHOOK_EMAIL_URL:
            try:
                import requests
                
                print(f"📧 Attempting to send email via webhook: {WEBHOOK_EMAIL_URL}")
                
                response = requests.post(
                    WEBHOOK_EMAIL_URL,
                    json={
                        "to": user_email,
                        "subject": subject,
                        "message": message,
                        "from": EMAIL_FROM
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    print(f"✅ Email sent successfully via webhook to {user_email}")
                    return True
                else:
                    print(f"❌ Webhook email failed: {response.status_code} - {response.text}")
                    
            except Exception as webhook_error:
                print(f"❌ Webhook email service failed: {webhook_error}")
        
        # Try to send actual email if SMTP is configured
        if EMAIL_HOST and EMAIL_USER and EMAIL_PASSWORD:
            try:
                import smtplib
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart
                import socket
                
                print(f"🌐 Attempting SMTP connection to {EMAIL_HOST}:{EMAIL_PORT}")
                
                # Test network connectivity first
                try:
                    socket.create_connection((EMAIL_HOST, EMAIL_PORT), timeout=10)
                    print(f"✅ Network connection to {EMAIL_HOST}:{EMAIL_PORT} successful")
                except socket.error as e:
                    print(f"❌ Network connection failed: {e}")
                    print("🔧 Trying alternative SMTP approaches...")
                    
                    # Try port 465 (SSL) as fallback
                    try:
                        socket.create_connection((EMAIL_HOST, 465), timeout=10)
                        print(f"✅ Alternative SSL connection to {EMAIL_HOST}:465 successful")
                        EMAIL_PORT = 465
                        use_ssl = True
                    except socket.error:
                        print(f"❌ All SMTP connection attempts failed")
                        raise e
                else:
                    use_ssl = False
                
                # Create message
                msg = MIMEMultipart()
                msg['From'] = EMAIL_FROM
                msg['To'] = user_email
                msg['Subject'] = subject
                
                # Add body to email
                msg.attach(MIMEText(message, 'plain'))
                
                # Create SMTP session with appropriate method
                if use_ssl:
                    print(f"🔐 Using SSL connection on port 465")
                    server = smtplib.SMTP_SSL(EMAIL_HOST, 465, timeout=30)
                else:
                    print(f"🔐 Using STARTTLS connection on port {EMAIL_PORT}")
                    server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=30)
                    server.starttls()  # Enable security
                
                # Enable debug output
                server.set_debuglevel(1)
                
                print(f"🔑 Logging in with user: {EMAIL_USER}")
                server.login(EMAIL_USER, EMAIL_PASSWORD)
                
                # Send email
                print(f"📤 Sending email to {user_email}")
                text = msg.as_string()
                server.sendmail(EMAIL_FROM, user_email, text)
                server.quit()
                
                print(f"✅ Email sent successfully to {user_email}")
                return True
                
            except Exception as email_error:
                print(f"❌ Failed to send email via SMTP: {email_error}")
                print(f"📊 Error type: {type(email_error).__name__}")
                
                # Try one more fallback approach - direct port 25
                try:
                    print(f"🔄 Attempting fallback SMTP on port 25...")
                    import smtplib
                    
                    server = smtplib.SMTP(EMAIL_HOST, 25, timeout=30)
                    server.starttls()
                    server.login(EMAIL_USER, EMAIL_PASSWORD)
                    
                    msg = MIMEMultipart()
                    msg['From'] = EMAIL_FROM
                    msg['To'] = user_email
                    msg['Subject'] = subject
                    msg.attach(MIMEText(message, 'plain'))
                    
                    server.sendmail(EMAIL_FROM, user_email, msg.as_string())
                    server.quit()
                    
                    print(f"✅ Email sent successfully via port 25 to {user_email}")
                    return True
                    
                except Exception as fallback_error:
                    print(f"❌ Fallback SMTP also failed: {fallback_error}")
                
                # Fall back to console logging
                print("📧 Email content (SMTP failed):")
                print(f"To: {user_email}")
                print(f"Subject: {subject}")
                print(f"Body: {message}")
                return False
        else:
            print("📧 SMTP not configured, email logged to console only")
            print("To enable email sending, set EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD environment variables")
            return True  # Consider logging as success for now
        
    except Exception as e:
        print(f"❌ Failed to send email notification to {user_email}: {e}")
        return False

# Request models
class AnalyzeRequest(BaseModel):
    selected_chunks: List[int] = []  # List of chunk indices to analyze
    max_chunks: Optional[int] = None  # Maximum number of chunks to analyze (limits the selection)
    upload_method: Optional[str] = None  # 'files' for Upload Export tab, 'url' for URL tab

class ChunkRequest(BaseModel):
    chunk_size: Optional[int] = 600000  # Default to 600k characters (~150k tokens) - safe margin below GPT's limit
    overlap: Optional[int] = 6000       # Proportional overlap

class CreditPurchaseRequest(BaseModel):
    credits: int
    amount: float
    package_id: str = None

class StripePaymentIntentRequest(BaseModel):
    credits: int
    amount: float
    unlimited: Optional[bool] = False
    package_id: str = None

class CreatePackRequest(BaseModel):
    pack_name: str
    description: Optional[str] = None
    custom_system_prompt: Optional[str] = None

class AddSourceRequest(BaseModel):
    source_name: str
    source_type: str = "chat_export"  # chat_export, document, url, text

# User model for authentication
class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, r2_directory: str):
        self.user_id = user_id
        self.email = email
        self.r2_directory = r2_directory

# Job logging helper
# In-memory progress tracking for real-time updates
job_progress = {}
job_progress_history = {}  # Track all progress messages
active_streams = {}  # Track active progress streams

# Real-time streaming generator
async def progress_stream_generator(job_id: str):
    """Generate progress updates in real-time for a specific job"""

    
    # Initialize if not exists
    if job_id not in job_progress_history:
        job_progress_history[job_id] = []
    
    last_sent_count = 0
    
    while True:
        try:
            # Check if we have new progress updates
            current_history = job_progress_history.get(job_id, [])
            
            # Send any new progress updates immediately
            if len(current_history) > last_sent_count:
                for i in range(last_sent_count, len(current_history)):
                    progress_data = current_history[i]
                    yield f"data: {json.dumps(progress_data)}\n\n"

                
                last_sent_count = len(current_history)
            
            # Check if job is complete
            job_status = job_progress.get(job_id, {})
            if job_status.get('status') == 'completed' or job_status.get('status') == 'error':

                yield f"data: {json.dumps({'type': 'complete', 'status': job_status.get('status')})}\n\n"
                break
            
            # Very short delay for responsiveness
            await asyncio.sleep(0.05)
            
        except Exception as e:

            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            break

def update_job_progress(job_id: str, step: str, progress: int, message: str, current_chunk: int = None, total_chunks: int = None):
    """Update job progress with real-time information"""
    timestamp = datetime.utcnow().isoformat()
    
    progress_entry = {
        "step": step,
        "progress": progress,
        "message": message,
        "current_chunk": current_chunk,
        "total_chunks": total_chunks,
        "timestamp": timestamp,
        "last_updated": datetime.utcnow().timestamp()
    }
    
    job_progress[job_id] = progress_entry
    
    # Also add to history for real-time streaming
    if job_id not in job_progress_history:
        job_progress_history[job_id] = []
    
    job_progress_history[job_id].append(progress_entry)
    
    # Keep only last 50 progress entries to prevent memory bloat
    if len(job_progress_history[job_id]) > 50:
        job_progress_history[job_id] = job_progress_history[job_id][-50:]
    


def get_job_progress(job_id: str):
    """Get current job progress"""
    return job_progress.get(job_id, {
        "step": "unknown",
        "progress": 0,
        "message": "No progress available",
        "current_chunk": None,
        "total_chunks": None,
        "timestamp": datetime.utcnow().isoformat(),
        "last_updated": datetime.utcnow().timestamp()
    })

def get_job_progress_history(job_id: str, since_timestamp: float = 0):
    """Get job progress history since a specific timestamp"""
    if job_id not in job_progress_history:
        return []
    
    return [
        entry for entry in job_progress_history[job_id]
        if entry["last_updated"] > since_timestamp
    ]

async def get_user_payment_status(user_id: str) -> dict:
    """Get user's payment status and chunk limits"""
    if not supabase:
        # Legacy mode - allow unlimited for now
        return {"plan": "legacy", "chunks_used": 0, "chunks_allowed": 999, "can_process": True}
    
    try:
        # Get user payment status using database function
        result = supabase.rpc("get_user_payment_status", {"user_uuid": user_id}).execute()
        if result.data:
            return result.data
        else:
            # Fallback to manual calculation
            profile_result = supabase.rpc("get_user_profile_for_backend", {"user_uuid": user_id}).execute()
            if not profile_result.data:
                # Create profile if it doesn't exist
                create_result = supabase.rpc("create_user_profile_for_backend", {
                    "user_uuid": user_id,
                    "user_email": "unknown@example.com",  # We don't have email here
                    "r2_dir": f"user_{user_id}"
                }).execute()
                
            return {"plan": "free", "chunks_used": 0, "chunks_allowed": get_new_user_credits(), "can_process": True}
        
    except Exception as e:
        print(f"Error getting payment status: {e}")
        # Default to free plan
        return {"plan": "free", "chunks_used": 0, "chunks_allowed": get_new_user_credits(), "can_process": True}

async def update_user_chunks_used(user_id: str, chunks_processed: int):
    """Update chunks - now handled automatically by database trigger when job status = 'analyzed'"""
    # This function is now obsolete - the database trigger handles chunk updates
    # when a job is marked as 'analyzed' with processed_chunks set

    pass

async def handle_cancellation_with_credit_deduction(user_id: str, job_id: str, chunks_processed: int):
    """Handle job cancellation and deduct credits if 10+ chunks were processed"""
    try:
        if chunks_processed >= 10:
            print(f"💳 Checking credit deduction for cancellation: {chunks_processed} chunks processed for user {user_id}")
            
            if not supabase:
                print("Warning: Supabase not available - cannot deduct credits")
                return
            
            # Check user's payment plan first
            user_result = supabase.table("user_profiles").select("payment_plan").eq("id", user_id).execute()
            
            if user_result.data and user_result.data[0].get("payment_plan") == "unlimited":
                print(f"🌟 Unlimited plan user - no credits deducted for {chunks_processed} chunks")
                return None
            
            print(f"💳 Deducting credits for credit-plan user: {chunks_processed} chunks processed")
            
            # Use the database function to deduct credits for processed chunks
            result = supabase.rpc("add_credits_to_user", {
                "user_uuid": user_id,
                "credits_to_add": -chunks_processed,  # Negative to deduct
                "transaction_description": f"Credits deducted for cancelled job {job_id} - {chunks_processed} chunks processed"
            }).execute()
            
            if result.data and result.data != -1:
                print(f"✅ Deducted {chunks_processed} credits from user {user_id}. New balance: {result.data}")
                return result.data
            else:
                print(f"❌ Failed to deduct credits from user {user_id}. Error: {result}")
                return None
        else:
            print(f"📋 No credit deduction needed: only {chunks_processed} chunks processed (threshold: 10)")
            return None
            
    except Exception as e:
        print(f"❌ Error handling cancellation credit deduction for user {user_id}: {e}")
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    """Validate JWT token and return authenticated user"""
    try:
        # Extract token
        token = credentials.credentials
        
        # Production: Always verify JWT signatures
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(status_code=500, detail="JWT secret not configured")
        
        try:
            # First try with full verification
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": True, "verify_signature": True}
            )
        except jwt.InvalidAudienceError:
            # Try without audience verification but keep signature verification
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_signature": True}
            )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        # Email is optional, use user_id as fallback
        if not email:
            email = f"user_{user_id}@example.com"
        
        # Get or create user profile in Supabase
        if supabase:
            try:
                # Try to get user profile using backend function
                result = supabase.rpc("get_user_profile_for_backend", {"user_uuid": user_id}).execute()
                if result.data:
                    user_profile = result.data
                    r2_directory = user_profile["r2_user_directory"]
                else:
                    # Profile doesn't exist, create it
                    r2_directory = f"user_{user_id}"
                    result = supabase.rpc("create_user_profile_for_backend", {
                        "user_uuid": user_id,
                        "user_email": email,
                        "r2_dir": r2_directory
                    }).execute()
                    user_profile = result.data
            except Exception as e:
                print(f"Error creating user profile: {e}")
                r2_directory = f"user_{user_id}"
        else:
            # Legacy mode: use user_id as directory
            r2_directory = f"user_{user_id}"
        
        return AuthenticatedUser(user_id, email, r2_directory)
        
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# Optional authentication for backwards compatibility
async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[AuthenticatedUser]:
    """Get current user if authenticated, otherwise return None for legacy support"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=authorization[7:])
        return await get_current_user(credentials)
    except:
        return None

# Database helper functions
async def create_job_in_db(user: AuthenticatedUser, job_id: str, file_name: str = None, file_size: int = None, status: str = "pending"):
    """Create a job record in Supabase - Updated to use backend function"""

    
    if not supabase:
        return None
    
    try:
        # Use backend function to create job (bypasses RLS)
        result = supabase.rpc("create_job_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id,
            "file_name_param": file_name or "unknown",
            "r2_path_param": f"{user.r2_directory}/{job_id}",
            "file_size_param": file_size or 0,
            "status_param": status
        }).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        else:
            return None
            return None
            
    except Exception as e:
        return None

async def update_job_status_in_db(user: AuthenticatedUser, job_id: str, status: str, progress: int = None, error_message: str = None, metadata: dict = None):
    """Update job status in Supabase with enhanced cost tracking"""
    
    if not supabase:
        return None

    try:
        # First, let's check if the job exists using our backend function
        job_check_result = supabase.rpc("check_job_exists_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id
        }).execute()
        
        if not job_check_result.data or not job_check_result.data[0]["job_exists"]:
            return None
        else:
            current_status = job_check_result.data[0]["current_status"]
        
        # Extract data from metadata if provided
        processed_chunks = None
        total_chunks = None
        total_input_tokens = None
        total_output_tokens = None
        total_cost = None
        
        if metadata:
            processed_chunks = metadata.get("processed_chunks")
            total_chunks = metadata.get("total_chunks")
            total_input_tokens = metadata.get("total_input_tokens")
            total_output_tokens = metadata.get("total_output_tokens")
            total_cost = metadata.get("total_cost")
        
        # Use enhanced backend function to update job status with costs
        result = supabase.rpc("update_job_status_with_costs_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id,
            "status_param": status,
            "progress_param": progress,
            "error_message_param": error_message,
            "processed_chunks_param": processed_chunks,
            "total_chunks_param": total_chunks,
            "total_input_tokens_param": total_input_tokens,
            "total_output_tokens_param": total_output_tokens,
            "total_cost_param": total_cost
        }).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        else:
            return None
            
    except Exception as e:
        print(f"❌ Error updating job status in DB: {e}")
        return None

async def update_job_chunks_in_db(user: AuthenticatedUser, job_id: str, total_chunks: int):
    """Update job total_chunks count in Supabase after chunking"""
    
    if not supabase:
        return None

    try:
        result = supabase.rpc("update_job_chunks_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id,
            "total_chunks_param": total_chunks
        }).execute()
        
        if result.data and len(result.data) > 0:
            print(f"✅ Updated job {job_id} total_chunks to {total_chunks}")
            return result.data[0]
        else:
            return None
            
    except Exception as e:
        print(f"❌ Error updating job chunks in DB: {e}")
        return None

async def create_pack_in_db(user: AuthenticatedUser, job_id: str, pack_name: str, r2_pack_path: str, extraction_stats: dict = None, chunk_stats: dict = None, analysis_stats: dict = None, file_size: int = None):
    """Create a pack record in Supabase"""
    
    if not supabase:
        return None
    
    try:
        # First check if the job exists using backend function
        job_check_result = supabase.rpc("check_job_exists_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id
        }).execute()
        
        if not job_check_result.data or not job_check_result.data[0]["job_exists"]:
            return None
        else:
            job_status = job_check_result.data[0]["current_status"]
        
        # Create pack using backend function
        result = supabase.rpc("create_pack_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id,
            "pack_name_param": pack_name,
            "r2_pack_path_param": r2_pack_path,
            "extraction_stats_param": extraction_stats,
            "chunk_stats_param": chunk_stats,
            "analysis_stats_param": analysis_stats,
            "file_size_param": file_size
        }).execute()
        
        if result.data and len(result.data) > 0:
            print(f"✅ Successfully created pack in database: {result.data[0]}")
            return result.data[0]
        else:
            print(f"❌ Pack insertion returned no data: {result}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating pack in database: {e}")
        import traceback
        print(f"📍 Full error traceback: {traceback.format_exc()}")
        return None

# Initialize clients
# Default OpenAI client (fallback)
default_openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
encoder = tiktoken.get_encoding("cl100k_base")

def get_openai_client(api_key: str = None) -> OpenAI:
    """
    Get OpenAI client - always uses server's API key now
    """
    # Always reload the current API key from environment
    current_api_key = os.getenv("OPENAI_API_KEY")
    
    if not current_api_key:
        print("❌ No OpenAI API key found in environment variables")
        raise HTTPException(status_code=500, detail="Server OpenAI API key not configured")
    
    
    try:
        return OpenAI(api_key=current_api_key)
    except Exception as e:
        print(f"❌ Error creating OpenAI client: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize OpenAI client")

async def openai_call_with_retry(openai_client, max_retries=3, job_id=None, **kwargs):
    """
    Make OpenAI API calls with retry logic for connection issues and quota handling
    Supports cancellation checking if job_id is provided
    """
    import time
    import asyncio
    from openai import OpenAI
    
    # Check for cancellation before starting
    if job_id and job_id in cancelled_jobs:
        print(f"🚫 OpenAI call cancelled before starting for job {job_id}")
        raise Exception(f"Job {job_id} was cancelled")
    
    for attempt in range(max_retries):
        try:
            # Check for cancellation before each attempt
            if job_id and job_id in cancelled_jobs:
                print(f"🚫 OpenAI call cancelled during retry attempt {attempt + 1} for job {job_id}")
                raise Exception(f"Job {job_id} was cancelled")
            
            # Run the blocking OpenAI call in a thread pool to avoid blocking the event loop
            response = await asyncio.to_thread(openai_client.chat.completions.create, **kwargs)
            
            # Check for cancellation after call completes
            if job_id and job_id in cancelled_jobs:
                print(f"🚫 OpenAI call cancelled after completion for job {job_id}")
                raise Exception(f"Job {job_id} was cancelled")
                
            print(f"✅ OpenAI API call successful on attempt {attempt + 1}")
            return response
        except Exception as e:
            # If it's a cancellation exception, don't retry
            if job_id and job_id in cancelled_jobs:
                print(f"🚫 Job {job_id} cancelled - aborting OpenAI call")
                raise e
                
            error_str = str(e).lower()
            if attempt == 0:  # Only log on first attempt to reduce noise
                print(f"❌ OpenAI API error on attempt {attempt + 1}: {e}")
                print(f"🔍 Error type: {type(e).__name__}")
            
            # Don't retry quota/billing errors - fail immediately
            if any(term in error_str for term in ['quota', 'insufficient_quota', 'billing', 'plan']):
                print(f"💳 Quota/billing error detected - not retrying")
                raise e
            
            # Don't retry content policy errors - fail immediately
            if any(term in error_str for term in ['content_policy', 'policy', 'safety']):
                print(f"🚫 Content policy error detected - not retrying")
                raise e
            
            # Don't retry context length errors - fail immediately  
            if any(term in error_str for term in ['context_length', 'token limit', 'too long']):
                print(f"📏 Context length error detected - not retrying")
                raise e
            
            # Retry connection/network errors
            if attempt < max_retries - 1 and any(term in error_str for term in [
                'connection', 'timeout', 'network', 'ssl', 'socket', 'read timed out'
            ]):
                wait_time = (attempt + 1) * 2  # Exponential backoff: 2, 4, 6 seconds
                print(f"🔄 Retrying in {wait_time} seconds due to connection error...")
                
                # Check for cancellation during wait
                for i in range(wait_time):
                    if job_id and job_id in cancelled_jobs:
                        print(f"🚫 Job {job_id} cancelled during retry wait")
                        raise Exception(f"Job {job_id} was cancelled")
                    await asyncio.sleep(1)  # Sleep 1 second at a time to check cancellation
                continue
            else:
                # Re-raise the exception if it's not a connection issue or we've exceeded retries
                print(f"❌ Not retrying - either not a connection error or max retries exceeded")
                raise e
    
    raise Exception(f"OpenAI API failed after {max_retries} attempts")

# R2 client configuration - let's try with requests directly to avoid boto3 SSL issues
import requests
from urllib.parse import urlparse

# Import for AWS signature v4
import hashlib
import hmac
from datetime import datetime

def sign_aws_request(method, url, headers, payload, access_key, secret_key, region='auto'):
    """Create AWS Signature Version 4 for R2"""
    
    # Parse URL
    parsed_url = urlparse(url)
    host = parsed_url.netloc
    path = parsed_url.path or '/'
    
    # Create timestamp
    t = datetime.utcnow()
    datestamp = t.strftime('%Y%m%d')
    timestamp = t.strftime('%Y%m%dT%H%M%SZ')
    
    # Step 1: Create canonical request
    canonical_headers = f"host:{host}\nx-amz-content-sha256:{hashlib.sha256(payload.encode()).hexdigest()}\nx-amz-date:{timestamp}\n"
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"{method}\n{path}\n\n{canonical_headers}\n{signed_headers}\n{hashlib.sha256(payload.encode()).hexdigest()}"
    
    # Step 2: Create string to sign
    algorithm = "AWS4-HMAC-SHA256"
    credential_scope = f"{datestamp}/{region}/s3/aws4_request"
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}"
    
    # Step 3: Calculate signature
    def sign(key, msg):
        return hmac.new(key, msg.encode(), hashlib.sha256).digest()
    
    signing_key = sign(f"AWS4{secret_key}".encode(), datestamp)
    signing_key = sign(signing_key, region)
    signing_key = sign(signing_key, "s3")
    signing_key = sign(signing_key, "aws4_request")
    
    signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()
    
    # Step 4: Add signing info to headers
    authorization = f"{algorithm} Credential={access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    
    headers.update({
        'Authorization': authorization,
        'x-amz-date': timestamp,
        'x-amz-content-sha256': hashlib.sha256(payload.encode()).hexdigest()
    })
    
    return headers

def upload_to_r2_direct(key: str, content: str):
    """Upload directly to R2 using requests with proper SSL verification and S3 auth"""
    try:
        
        # Construct the URL
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        
        # Prepare headers
        headers = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Host': urlparse(R2_ENDPOINT).netloc
        }
        
        # Sign the request
        headers = sign_aws_request('PUT', url, headers, content, R2_ACCESS_KEY, R2_SECRET_KEY)
        
        # Make the request with proper SSL verification and better Unicode handling
        try:
            # Clean the content of any surrogate characters before encoding
            import codecs
            # First, encode to bytes handling surrogates
            content_bytes = content.encode('utf-8', errors='ignore')
            # Then decode back to clean string
            clean_content = content_bytes.decode('utf-8')
            response = r2_session.put(url, data=clean_content.encode('utf-8'), headers=headers, timeout=30)
        except requests.exceptions.SSLError as ssl_error:
            print(f"❌ SSL verification failed for R2 upload: {ssl_error}")
            print(f"❌ Cannot upload to R2 due to SSL issues")
            return False
        except UnicodeEncodeError as ue:
            print(f"Unicode encoding error: {ue}")
            # More aggressive cleaning for surrogate pairs
            import unicodedata
            clean_content = ''.join(char for char in content if unicodedata.category(char) != 'Cs')
            try:
                response = r2_session.put(url, data=clean_content.encode('utf-8'), headers=headers, timeout=30)
            except requests.exceptions.SSLError as ssl_error:
                print(f"❌ SSL verification failed on retry: {ssl_error}")
                print(f"❌ Cannot upload to R2 due to SSL issues")
                return False
            # More aggressive cleaning for surrogate pairs
            import unicodedata
            clean_content = ''.join(char for char in content if unicodedata.category(char) != 'Cs')
            response = r2_session.put(url, data=clean_content.encode('utf-8'), headers=headers, timeout=30)
        
        if response.status_code in [200, 201]:
            print(f"✅ R2 upload successful with SSL verification: {key}")
            return True
        else:
            print(f"❌ R2 upload failed: {response.status_code} - {response.text}")
            print(f"❌ Failed to upload {key} to R2 bucket {R2_BUCKET}")
            print(f"❌ Please verify your R2 bucket exists and credentials are correct")
            return False
        
    except Exception as e:
        print(f"❌ R2 upload exception: {e}")
        print(f"❌ Failed to upload {key} to R2")
        print(f"❌ Please verify your R2 bucket '{R2_BUCKET}' exists and credentials are correct")
        return False

# Disable boto3 for now and use direct upload
r2_client = None

# Using local storage for now until R2 SSL issue is resolved


def upload_to_r2(key: str, content: str):
    """Upload content to R2 bucket."""
    
    # Use direct upload method to avoid boto3 SSL recursion
    success = upload_to_r2_direct(key, content)
    
    if success:

        return True
    else:

        return False

def download_from_r2(key: str, silent_404: bool = False) -> str:
    """Download content from R2 bucket with proper SSL verification."""
    try:
        # Try R2 first
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        

        
        # Prepare headers for GET request
        headers = {
            'Host': urlparse(R2_ENDPOINT).netloc
        }
        
        # Sign the request
        headers = sign_aws_request('GET', url, headers, '', R2_ACCESS_KEY, R2_SECRET_KEY)
        
        # Make the request with proper SSL verification
        try:
            response = r2_session.get(url, headers=headers, timeout=30)
        except requests.exceptions.SSLError as ssl_error:
            if not silent_404:
                print(f"🔒 SSL verification failed for R2 download: {ssl_error}")
                print("📋 Falling back to local storage due to SSL issues")
            # Fall back to local storage immediately on SSL issues
            local_path = f"local_storage/{key}"
            try:
                with open(local_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if not silent_404:
                    print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
                return content
            except Exception as local_error:
                if not silent_404:
                    print(f"Error downloading from local storage: {local_error}")
                return None
        
        if response.status_code == 200:
            # Removed success message - too verbose
            return response.text
        elif response.status_code == 404:
            # Try local storage fallback for 404s
            if not silent_404:
                print(f"R2 download failed ({response.status_code}): {response.text}")
                print(f"R2 download failed ({response.status_code}), trying local storage...")
            
            # Fall back to local storage
            local_path = f"local_storage/{key}"
            try:
                with open(local_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if not silent_404:
                    print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
                return content
            except FileNotFoundError:
                if silent_404:
                    return None  # Silently return None for expected 404s when file doesn't exist locally either
                else:
                    print(f"File not found in local storage: {local_path}")
                    return None
        else:
            if not silent_404:
                print(f"R2 download failed ({response.status_code}): {response.text}")
                print(f"R2 download failed ({response.status_code}), trying local storage...")
            # Fall back to local storage
            local_path = f"local_storage/{key}"
            with open(local_path, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
            return content
            
    except Exception as e:
        if not silent_404:
            print(f"Error downloading from R2, trying local storage: {e}")
        try:
            local_path = f"local_storage/{key}"
            with open(local_path, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
            return content
        except Exception as local_error:
            if not silent_404:
                print(f"Error downloading from local storage: {local_error}")
            return None

def download_from_r2_with_fallback(primary_key: str, job_id: str, filename: str, silent_404: bool = False) -> str:
    """Try to download from multiple possible paths based on different user directory formats."""
    
    # First try the primary key (current user directory)
    content = download_from_r2(primary_key, silent_404=True)
    if content:
        if not silent_404:
            print(f"✅ Found file at primary path: {primary_key}")
        return content
    
    # Extract the user ID from the primary key if possible
    import re
    user_id_match = re.search(r'user_([a-f0-9-]{36})', primary_key)
    if user_id_match:
        user_id = user_id_match.group(1)
        
        # Try alternative path formats
        alternative_paths = [
            f"user_{user_id}/{job_id}/{filename}",
            f"{user_id}/{job_id}/{filename}",
            f"users/{user_id}/{job_id}/{filename}",
            f"prod/{user_id}/{job_id}/{filename}",
        ]
        
        for alt_path in alternative_paths:
            if alt_path == primary_key:
                continue  # Skip if it's the same as primary
                
            content = download_from_r2(alt_path, silent_404=True)
            if content:
                if not silent_404:
                    print(f"✅ Found file at alternative path: {alt_path}")
                return content
    
    # If all paths failed, return None
    if not silent_404:
        print(f"❌ File not found at any path for job {job_id}, filename {filename}")
    return None

def list_r2_objects(prefix: str = "") -> List[str]:
    """List objects in R2 bucket with optional prefix."""
    try:
        if r2_client:
            response = r2_client.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix)
            if 'Contents' in response:
                return [obj['Key'] for obj in response['Contents']]
        
        # Fallback to local storage
        local_prefix = f"local_storage/{prefix}"
        if os.path.exists(local_prefix):
            files = []
            for root, dirs, filenames in os.walk(local_prefix):
                for filename in filenames:
                    # Convert back to R2 path format
                    rel_path = os.path.relpath(os.path.join(root, filename), "local_storage")
                    files.append(rel_path.replace("\\", "/"))  # Normalize path separators
            return files
        
        return []
    except Exception as e:
        print(f"Error listing R2 objects: {e}")
        # Try local storage as final fallback
        try:
            local_prefix = f"local_storage/{prefix}"
            if os.path.exists(local_prefix):
                files = []
                for root, dirs, filenames in os.walk(local_prefix):
                    for filename in filenames:
                        rel_path = os.path.relpath(os.path.join(root, filename), "local_storage")
                        files.append(rel_path.replace("\\", "/"))
                return files
        except Exception as local_e:
            print(f"Error with local storage fallback: {local_e}")
        return []

def delete_from_r2(key: str) -> bool:
    """Delete a single object from R2."""
    try:
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        headers = {
            'Host': urlparse(R2_ENDPOINT).netloc
        }
        headers = sign_aws_request('DELETE', url, headers, '', R2_ACCESS_KEY, R2_SECRET_KEY)
        
        response = r2_session.delete(url, headers=headers, timeout=30)
        
        if response.status_code in [200, 204, 404]:  # 404 is ok (already deleted)
            return True
        else:
            print(f"❌ Failed to delete from R2: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error deleting from R2: {e}")
        return False

def delete_r2_directory(prefix: str) -> bool:
    """Delete all objects with a given prefix (directory) from R2."""
    try:
        print(f"🗑️ Deleting R2 directory: {prefix}")
        
        # List all objects with this prefix
        objects = list_r2_objects(prefix)
        
        if not objects:
            print(f"No objects found with prefix: {prefix}")
            return True
        
        print(f"Found {len(objects)} objects to delete")
        deleted_count = 0
        
        # Delete each object
        for key in objects:
            if delete_from_r2(key):
                deleted_count += 1
        
        print(f"✅ Deleted {deleted_count}/{len(objects)} objects from R2")
        
        # Also delete from local storage if it exists
        local_path = f"local_storage/{prefix}"
        if os.path.exists(local_path):
            import shutil
            shutil.rmtree(local_path)
            print(f"✅ Deleted local storage: {local_path}")
        
        return deleted_count == len(objects)
    except Exception as e:
        print(f"❌ Error deleting R2 directory: {e}")
        return False

def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    try:
        return len(encoder.encode(text))
    except Exception:
        return len(text) // 4

import re

# Pre-compile regex patterns for better performance
_UUID_PATTERN = re.compile(r'^[a-f0-9\-]{8,}$', re.IGNORECASE)
_NUMBERS_PATTERN = re.compile(r'^[\d\-\s\.]+$')
_LETTERS_PATTERN = re.compile(r'[a-zA-Z]')
# ChatGPT conversation IDs like "978dfdf8faef413a-LHR" or standalone alphanumeric IDs
_CONVERSATION_ID_PATTERN = re.compile(r'^[a-f0-9]{12,20}-[A-Z]{3}$', re.IGNORECASE)
# Generic conversation/message IDs (standalone alphanumeric strings 8+ chars)
_GENERIC_ID_PATTERN = re.compile(r'^[a-f0-9]{8,}$', re.IGNORECASE)
# Line numbers/conversation indices like "22.", "23.", etc.
_LINE_NUMBER_PATTERN = re.compile(r'^\d{1,3}\.?\s*$')

# Pre-define technical patterns set for faster lookup
_TECHNICAL_PATTERNS = {
    'http://', 'https://', '.com', '.org', '.net', '.json', '.txt', '.py',
    'client-created', 'message_type', 'model_slug', 'gpt-', 'claude-',
    'request_id', 'timestamp_', 'content_type', 'conversation_id',
    'finished_successfully', 'absolute', 'metadata', 'system',
    'user_editable_context', 'is_visually_hidden', 'role:', 'author:',
    'create_time', 'update_time', 'parent_id', 'children', 'mapping',
    'finish_details', 'stop_tokens', 'citations', 'content_references', 'file-service://',
    '-lhr', '-iad', '-syd', '-fra'  # Common ChatGPT server suffixes
}

# Pre-define common JSON elements set
_JSON_ELEMENTS = {'true', 'false', 'null', 'user', 'assistant', 'system', 'all'}

def is_meaningful_text(text: str) -> bool:
    """OPTIMIZED: Check if text is meaningful conversation content"""
    if not isinstance(text, str):
        return False
    
    # Clean and normalize - single strip operation
    text = text.strip()
    
    # Skip if too short or empty
    if len(text) < 3:
        return False
    
    # OPTIMIZED: Use pre-compiled patterns - filter out conversation IDs and other technical identifiers
    if (_NUMBERS_PATTERN.match(text) or _UUID_PATTERN.match(text) or 
        _CONVERSATION_ID_PATTERN.match(text) or _GENERIC_ID_PATTERN.match(text) or
        _LINE_NUMBER_PATTERN.match(text)):
        return False
    
    # OPTIMIZED: Use set lookup instead of list iteration
    text_lower = text.lower()
    if any(pattern in text_lower for pattern in _TECHNICAL_PATTERNS):
        return False
    
    # OPTIMIZED: Single regex check for letters
    if not _LETTERS_PATTERN.search(text):
        return False
    
    # Skip very short single words unless they're meaningful
    if len(text.split()) == 1 and len(text) < 8:
        return False
    
    # OPTIMIZED: Set lookup instead of list check
    if text_lower in _JSON_ELEMENTS:
        return False
    
    return True

# Pre-compile commonly used regex patterns for performance
_WHITESPACE_PATTERN = re.compile(r'\s+')
_TIMESTAMP_PATTERN = re.compile(r'^\[\d{4}-\d{2}-\d{2}.*?\]')
_TIME_PATTERN = re.compile(r'^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?', re.IGNORECASE)
_USERNAME_PATTERN = re.compile(r'^[A-Za-z]+:')

def clean_text(text: str) -> str:
    """OPTIMIZED: Clean and normalize text content"""
    if not text:
        return ""
    
    # Decode HTML entities
    text = html.unescape(text)
    
    # OPTIMIZED: Single regex operation for whitespace
    text = _WHITESPACE_PATTERN.sub(' ', text)
    
    # Strip leading/trailing whitespace
    return text.strip()

class ChatHTMLParser(HTMLParser):
    """HTML parser specifically designed for ChatGPT HTML exports"""
    
    def __init__(self):
        super().__init__()
        self.conversations = []
        self.current_text = ""
        self.in_conversation = False
        self.current_speaker = None
        self.current_content = []
        
    def handle_starttag(self, tag, attrs):
        # Look for conversation boundaries or speaker indicators
        if tag in ['div', 'p', 'article', 'section']:
            # Check for class names that might indicate conversation structure
            for name, value in attrs:
                if name == 'class' and any(keyword in value.lower() for keyword in 
                    ['conversation', 'message', 'user', 'assistant', 'chat', 'turn']):
                    self.in_conversation = True
                    break
    
    def handle_endtag(self, tag):
        if tag in ['div', 'p', 'article', 'section'] and self.in_conversation:
            if self.current_text.strip():
                self.conversations.append(self.current_text.strip())
                self.current_text = ""
            self.in_conversation = False
        elif tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            # Headers might indicate conversation titles
            if self.current_text.strip():
                self.conversations.append(f"TITLE: {self.current_text.strip()}")
                self.current_text = ""
    
    def handle_data(self, data):
        cleaned_data = clean_text(data)
        if cleaned_data and len(cleaned_data) > 5:  # Filter out very short text
            if self.in_conversation:
                self.current_text += cleaned_data + " "
            else:
                # Check if this might be a conversation turn even without explicit markup
                # Look for patterns like "User" or "ChatGPT" at the start
                if any(cleaned_data.lower().startswith(prefix) for prefix in 
                    ['user', 'chatgpt', 'assistant', 'human', 'ai', 'you:', 'me:']):
                    self.conversations.append(cleaned_data)
                elif len(cleaned_data) > 20:  # Longer text is likely conversation content
                    self.current_text += cleaned_data + " "
    
    def close(self):
        super().close()
        # Add any remaining text
        if self.current_text.strip():
            self.conversations.append(self.current_text.strip())

def extract_from_html_content(file_content: str) -> List[str]:
    """Extract conversations from HTML chat export files"""
    extracted_texts = []
    
    try:
        # For HTML files, we need to be more selective to avoid excessive chunks
        print(f"Processing HTML file of {len(file_content)} characters")
        
        # Remove HTML tags entirely and get plain text
        text_only = re.sub(r'<[^>]+>', ' ', file_content)
        text_only = clean_text(text_only)
        
        print(f"After HTML tag removal: {len(text_only)} characters")
        
        # Split by conversation patterns to identify actual chat content
        # Look for patterns like "User" followed by "ChatGPT" or "Assistant"
        conversation_pattern = r'(?i)(?:^|\n\s*)((?:user|human|you)[\s:]+.*?)(?=(?:\n\s*(?:chatgpt|assistant|ai|gpt)[\s:])|$)'
        assistant_pattern = r'(?i)(?:^|\n\s*)((?:chatgpt|assistant|ai|gpt)[\s:]+.*?)(?=(?:\n\s*(?:user|human|you)[\s:])|$)'
        
        # Extract user messages
        user_messages = re.findall(conversation_pattern, text_only, re.DOTALL)
        assistant_messages = re.findall(assistant_pattern, text_only, re.DOTALL)
        
        # Combine and clean messages
        all_messages = user_messages + assistant_messages
        
        for message in all_messages:
            cleaned_message = clean_text(message)
            if cleaned_message and len(cleaned_message) > 50:  # Filter short messages
                # Remove common HTML artifacts and navigation text
                if not any(artifact in cleaned_message.lower() for artifact in [
                    'copy code', 'share', 'regenerate', 'continue', 'new conversation',
                    'upgrade', 'settings', 'history', 'menu', 'sidebar'
                ]):
                    extracted_texts.append(cleaned_message)
        
        # If conversation pattern matching didn't work well, fall back to paragraph splitting
        if len(extracted_texts) < 10:
            print("Falling back to paragraph-based extraction...")
            # Split by multiple line breaks but be more aggressive about filtering
            chunks = re.split(r'\n\s*\n\s*\n|\r\n\s*\r\n\s*\r\n', text_only)
            extracted_texts = []
            
            for chunk in chunks:
                cleaned_chunk = clean_text(chunk)
                # More restrictive filtering for HTML to avoid UI elements
                if (cleaned_chunk and 
                    len(cleaned_chunk) > 100 and  # Longer threshold for HTML
                    len(cleaned_chunk.split()) > 10 and  # At least 10 words
                    not any(artifact in cleaned_chunk.lower() for artifact in [
                        'copy code', 'share', 'regenerate', 'continue', 'new conversation',
                        'upgrade', 'settings', 'history', 'menu', 'sidebar', 'chatgpt',
                        'openai', 'terms', 'privacy', 'help', 'support'
                    ])):
                    extracted_texts.append(cleaned_chunk)
        
        # Log the total amount of extracted content for debugging
        total_chars = sum(len(text) for text in extracted_texts)
        print(f"HTML extraction found {len(extracted_texts)} text segments, total {total_chars} characters")
        print(f"Reduction ratio: {len(file_content)} -> {total_chars} ({total_chars/len(file_content)*100:.1f}%)")
        
        return extracted_texts
        
    except Exception as e:
        print(f"Error in HTML extraction: {e}")
        # Fallback to basic text extraction
        return extract_from_text_content(re.sub(r'<[^>]+>', ' ', file_content))

def extract_text_from_structure(obj: Any, extracted_texts=None, depth=0, progress_callback=None, total_items=None, current_item=None, seen_objects=None, text_set=None) -> List[str]:
    """Recursively extract meaningful text from any data structure - OPTIMIZED for speed"""
    if extracted_texts is None:
        extracted_texts = []
        text_set = set()  # Use set for O(1) duplicate checking
    elif text_set is None:
        text_set = set(extracted_texts)  # Convert existing list to set for speed
    
    if seen_objects is None:
        seen_objects = set()
    
    # Prevent infinite recursion - keep aggressive limit
    if depth > 50:
        return extracted_texts
    
    # Check for circular references
    obj_id = id(obj)
    if obj_id in seen_objects:
        return extracted_texts
    
    # Only track container objects to avoid memory issues
    if isinstance(obj, (dict, list)):
        seen_objects.add(obj_id)
    
    try:
        if isinstance(obj, dict):
            # Look for common text-containing keys first (prioritized extraction)
            text_keys = ['parts', 'content', 'text', 'message', 'body', 'data', 'value', 'title', 'response']
            for key in text_keys:
                if key in obj:
                    extract_text_from_structure(obj[key], extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects, text_set)
            
            # Then check all other keys with improved batching
            processed = 0
            for key, value in obj.items():
                if key not in text_keys and processed < 500:  # Keep comprehensive limit
                    extract_text_from_structure(value, extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects, text_set)
                    processed += 1
                    
        elif isinstance(obj, list):
            # OPTIMIZED: Reduce progress callback frequency dramatically
            list_len = min(len(obj), 5000)
            progress_interval = max(200, list_len // 20)  # Report progress every 200 items OR 5% chunks
            
            for i, item in enumerate(obj[:5000]):
                # OPTIMIZED: Much less frequent progress updates (10x reduction)
                if progress_callback and len(obj) > 500 and i % progress_interval == 0:
                    progress = (i + 1) / list_len * 100
                    progress_callback(f"Processing item {i+1}/{list_len} ({progress:.1f}%)")
                
                extract_text_from_structure(item, extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects, text_set)
                
        elif isinstance(obj, str):
            # OPTIMIZED: Pre-filter before expensive operations
            if len(obj) >= 3 and obj.strip():  # Quick length and whitespace check first
                if is_meaningful_text(obj):
                    # OPTIMIZED: Streamlined text cleaning
                    cleaned_text = obj.strip()
                    
                    # Only do unicode processing if needed
                    if '\\u' in cleaned_text:
                        try:
                            cleaned_text = cleaned_text.encode('utf-8').decode('unicode_escape')
                        except:
                            pass  # Keep original if decode fails
                    
                    # Single regex operation for whitespace normalization
                    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
                    
                    # OPTIMIZED: Use set for O(1) duplicate checking instead of O(n) list search
                    if cleaned_text and cleaned_text not in text_set:
                        # Only do expensive unicode validation if we're going to add it
                        try:
                            cleaned_text.encode('utf-8')  # Quick encoding test
                            extracted_texts.append(cleaned_text)
                            text_set.add(cleaned_text)
                        except UnicodeEncodeError:
                            # Fallback: aggressive cleaning only when needed
                            import unicodedata
                            safe_text = ''.join(char for char in cleaned_text 
                                              if ord(char) < 65536 and unicodedata.category(char) != 'Cs')
                            if safe_text and safe_text not in text_set:
                                extracted_texts.append(safe_text)
                                text_set.add(safe_text)
    
    finally:
        # Remove from seen objects when done (for dict/list only)
        if isinstance(obj, (dict, list)) and obj_id in seen_objects:
            seen_objects.discard(obj_id)
    
    return extracted_texts

def extract_conversations_from_zip(zip_bytes: bytes) -> str:
    """Extract conversations.json from a ZIP file"""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_file:
            # Look for conversations.json in the ZIP
            for file_info in zip_file.namelist():
                if file_info.endswith('conversations.json'):
                    print(f"📦 Found conversations.json in ZIP: {file_info}")
                    return zip_file.read(file_info).decode('utf-8')
            raise ValueError("conversations.json not found in ZIP file")
    except zipfile.BadZipFile:
        raise ValueError("Invalid ZIP file")
    except Exception as e:
        raise ValueError(f"Error extracting ZIP: {str(e)}")

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF using PyPDF2"""
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        pdf_reader = PdfReader(pdf_file)
        
        extracted_text = []
        total_pages = len(pdf_reader.pages)
        
        print(f"📄 Extracting text from PDF ({total_pages} pages)")
        
        for page_num, page in enumerate(pdf_reader.pages, 1):
            try:
                text = page.extract_text()
                if text and text.strip():
                    extracted_text.append(text)
            except Exception as page_error:
                print(f"  Warning: Could not extract text from page {page_num}: {page_error}")
                continue
        
        combined_text = "\n\n".join(extracted_text)
        print(f"✅ PDF extraction complete: {len(combined_text):,} characters extracted")
        
        return combined_text
    except Exception as e:
        print(f"❌ Error extracting PDF: {e}")
        raise ValueError(f"Failed to extract PDF content: {str(e)}")

def extract_from_text_content(file_content: str) -> List[str]:
    """OPTIMIZED: Extract meaningful text from plain text content"""
    extracted_texts = []
    text_set = set()  # Use set for O(1) duplicate checking
    
    try:
        # Try to detect if it's actually structured data in text format
        content_stripped = file_content.strip()
        if content_stripped.startswith(('{', '[')):
            try:
                data = json.loads(file_content)
                return extract_text_from_structure(data)
            except:
                pass  # Continue with text processing
        
        # OPTIMIZED: Split by common delimiters and patterns in one operation
        chunks = re.split(r'\n\s*\n|\r\n\s*\r\n|\.{3,}|---+|\*{3,}', file_content)
        
        for chunk in chunks:
            lines = chunk.strip().split('\n')
            for line in lines:
                cleaned_line = line.strip()
                
                # OPTIMIZED: Use pre-compiled patterns and early filtering
                if len(cleaned_line) < 3:  # Quick length check first
                    continue
                    
                # Remove common prefixes using pre-compiled patterns
                cleaned_line = _TIMESTAMP_PATTERN.sub('', cleaned_line)
                cleaned_line = _TIME_PATTERN.sub('', cleaned_line)
                cleaned_line = _USERNAME_PATTERN.sub('', cleaned_line)
                cleaned_line = cleaned_line.strip()
                
                # OPTIMIZED: Check meaningful text and duplicates efficiently
                if is_meaningful_text(cleaned_line) and cleaned_line not in text_set:
                    extracted_texts.append(cleaned_line)
                    text_set.add(cleaned_line)
    
    except Exception as e:
        print(f"Error processing text content: {e}")
    
    return extracted_texts

from fastapi.responses import StreamingResponse
import asyncio
from typing import AsyncGenerator

# Global progress tracking
# Removed unused progress_tracker - using job_progress for better performance

# Removed old update_progress function - using update_job_progress only for better performance

@app.get("/api/progress/{job_id}/{operation}")
async def get_progress(job_id: str, operation: str):
    """Get current progress for a job operation - using job_progress instead"""
    if job_id in job_progress:
        return job_progress[job_id]
    else:
        return {"job_id": job_id, "step": operation, "progress": 0, "message": "No progress data"}

@app.get("/api/progress/{job_id}")
async def get_progress_stream(job_id: str):
    """Stream progress updates for a job"""
    async def generate():
        last_progress = None
        timeout_count = 0
        while timeout_count < 60:  # 30 seconds timeout
            current_progress = job_progress.get(job_id)
            if current_progress and current_progress != last_progress:
                yield f"data: {json.dumps(current_progress)}\n\n"
                last_progress = current_progress
                timeout_count = 0
            else:
                timeout_count += 1
            await asyncio.sleep(0.5)  # Check every 500ms
        
        # Send final completion message
        yield f"data: {json.dumps({'step': 'complete', 'progress': 100, 'message': 'Progress tracking ended'})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and all its files."""
    try:
        # For now, delete from local storage
        import shutil
        local_job_dir = f"local_storage/jobs/{job_id}"
        if os.path.exists(local_job_dir):
            shutil.rmtree(local_job_dir)
            return {"status": "deleted", "job_id": job_id}
        else:
            raise HTTPException(status_code=404, detail="Job not found")
    except Exception as e:
        print(f"Error deleting job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "Simple UCP Backend with R2 - 3 Steps"}

@app.get("/api/health")
async def detailed_health_check():
    """Comprehensive health check endpoint"""
    
    try:
        start_time = time.time()
        
        # Check database connectivity
        db_healthy = True
        db_latency = 0
        try:
            if supabase:
                db_start = time.time()
                result = supabase.table('user_profiles').select('id').limit(1).execute()
                db_latency = round((time.time() - db_start) * 1000, 2)
            else:
                print("⚠️ Database connection not configured (legacy mode)")
        except Exception as e:
            db_healthy = False
            print(f"Database health check failed: {e}")
        
        # Check active threads and connections
        active_threads = threading.active_count()
        
        # Check job queue status
        pending_jobs = len([job for job in job_progress.values() if job.get('status') == 'pending'])
        processing_jobs = len([job for job in job_progress.values() if job.get('status') == 'processing'])
        
        response_time = round((time.time() - start_time) * 1000, 2)
        
        health_status = {
            "status": "healthy" if db_healthy else "degraded",
            "timestamp": time.time(),
            "response_time_ms": response_time,
            "database": {
                "healthy": db_healthy,
                "latency_ms": db_latency
            },
            "system": {
                "active_threads": active_threads
            },
            "job_queue": {
                "pending_jobs": pending_jobs,
                "processing_jobs": processing_jobs,
                "total_tracked_jobs": len(job_progress)
            }
        }
        
        return health_status
        
    except Exception as e:
        print(f"Health check error: {e}")
        return {
            "status": "error",
            "timestamp": time.time(),
            "error": str(e)
        }

@app.post("/api/reload-env")
async def reload_environment():
    """Reload environment variables from .env file"""
    try:
        old_key = OPENAI_API_KEY
        new_key = reload_env_vars()
        return {
            "status": "reloaded",
            "old_key_ending": f"...{old_key[-4:]}" if old_key and len(old_key) > 4 else "None",
            "new_key_ending": f"...{new_key[-4:]}" if new_key and len(new_key) > 4 else "None",
            "changed": old_key != new_key
        }
    except Exception as e:
        print(f"Error reloading environment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reload environment: {str(e)}")

class ConversationURLRequest(BaseModel):
    url: str


async def extract_and_chunk_source(pack_id: str, source_id: str, file_content: str, filename: str, user: AuthenticatedUser):
    """Step 1: Extract and chunk the source (NO OpenAI calls, NO credit deduction)"""
    try:
        print(f"🔄 Extracting and chunking source {source_id} for pack {pack_id}")
        
        # Update status to processing (extracting and chunking)
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "processing",
            "progress_param": 10
        }).execute()
        
        # Step 1: Extract text
        extracted_texts = extract_from_text_content(file_content)
        
        # Store extracted text in R2
        extracted_path = f"{user.r2_directory}/{pack_id}/{source_id}/extracted.txt"
        upload_to_r2(extracted_path, "\n\n".join(extracted_texts))
        
        # Update progress
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "processing",
            "progress_param": 50
        }).execute()
        
        # Step 2: Dynamic chunking based on actual token counts
        print(f"✂️ Chunking text for source {source_id}")
        chunks = []
        # Target: 50k tokens per chunk - maximize chunk size while staying safe
        # 128k limit - 1k prompt - 1.5k output = 125.5k available, using 50k = 75k headroom
        max_tokens_per_chunk = 50000
        initial_chunk_size = 200000  # Start with ~50k tokens (4 chars/token average)
        overlap = 10000  # Overlap for context continuity
        
        # Combine all extracted text into one piece
        combined_text = "\n\n".join(extracted_texts)
        total_length = len(combined_text)
        
        # Only chunk if text exceeds chunk size
        if total_length > initial_chunk_size:
            print(f"📦 Starting dynamic chunking: {total_length:,} chars, target {max_tokens_per_chunk:,} tokens/chunk")
            chunk_count = 0
            position = 0
            
            while position < total_length:
                # Extract initial chunk
                chunk_end = min(position + initial_chunk_size, total_length)
                chunk = combined_text[position:chunk_end]
                
                # Count actual tokens in this chunk
                chunk_tokens = count_tokens(chunk)
                
                # If chunk exceeds limit, shrink it
                actual_chunk_size = len(chunk)
                if chunk_tokens > max_tokens_per_chunk:
                    # Calculate safe size based on actual token density
                    chars_per_token = len(chunk) / chunk_tokens
                    safe_size = int(max_tokens_per_chunk * chars_per_token * 0.90)  # 10% safety margin
                    # For very dense content (like PDFs), allow smaller chunks
                    safe_size = max(safe_size, 30000)  # Absolute minimum 30k chars (~20k tokens worst case)
                    chunk = combined_text[position:position + safe_size]
                    chunk_tokens = count_tokens(chunk)
                    actual_chunk_size = len(chunk)
                    # Only log dense chunks occasionally to avoid console spam
                    if chunk_count % 20 == 0:
                        print(f"⚠️ Dense content detected, adjusting chunk sizes (avg: {chunk_tokens:,} tokens)")

                else:
                    # Log every 20 chunks for normal content
                    if chunk_count % 20 == 0:
                        print(f"Chunk {chunk_count + 1}: {actual_chunk_size:,} chars, {chunk_tokens:,} tokens")
                
                chunks.append(chunk)
                chunk_count += 1
                
                # Move position forward (use actual chunk size, ensure we always move forward)
                advance_by = max(actual_chunk_size - overlap, initial_chunk_size // 4)  # Always advance at least 25% of initial
                position = position + advance_by
                
                # Show progress every 10 chunks and update database
                if chunk_count % 10 == 0:
                    progress_pct = int((position / total_length) * 100)
                    print(f"Chunking progress: {chunk_count} chunks, {progress_pct}% complete")
                    # Update frontend with chunking progress
                    supabase.rpc("update_source_status", {
                        "user_uuid": user.user_id,
                        "target_source_id": source_id,
                        "status_param": "processing",
                        "progress_param": min(95, progress_pct)  # Cap at 95% until done
                    }).execute()
            
            print(f"✅ Created {len(chunks)} chunks for source {source_id}")
        else:
            # Small enough to process as single chunk
            chunks.append(combined_text)
            chunk_tokens = count_tokens(combined_text)
            print(f"Created 1 chunk for source {source_id} ({total_length:,} chars, {chunk_tokens:,} tokens)", flush=True)
        
        # Store chunks in R2
        chunked_path = f"{user.r2_directory}/{pack_id}/{source_id}/chunked.json"
        chunks_json = json.dumps(chunks)
        upload_to_r2(chunked_path, chunks_json)
        print(f"✅ Chunks uploaded successfully to R2", flush=True)
        
        # Update status to ready_for_analysis (extraction done, awaiting credit confirmation)
        print(f"📝 Updating source {source_id} status to ready_for_analysis...", flush=True)
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "ready_for_analysis",
            "progress_param": 100,
            "total_chunks_param": len(chunks)
        }).execute()
        
        print(f"✅ Extraction and chunking complete: {len(chunks)} chunks ready for analysis", flush=True)
        avg_chunk_size = total_length // len(chunks) if len(chunks) > 0 else 0
        print(f"Stats: {total_length:,} chars -> {len(chunks)} chunks (~{avg_chunk_size:,} chars/chunk avg)", flush=True)
        
        return len(chunks)
        
    except Exception as e:
        print("hi")
        print(f"❌ Error extracting/chunking source {source_id}: {e}")
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "failed",
            "progress_param": 0
        }).execute()
        raise

def apply_redaction_filters(text: str) -> str:
    """Lightweight redaction to mask obvious personal identifiers before analysis."""
    try:
        if not text:
            return text
        redacted = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '[REDACTED_EMAIL]', text)
        redacted = re.sub(r'\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b', '[REDACTED_PHONE]', redacted)
        redacted = re.sub(r'\\b\\d{13,16}\\b', '[REDACTED_NUMBER]', redacted)
        return redacted
    except Exception as redaction_error:
        print(f"⚠️ Redaction filter failed: {redaction_error}")
        return text

async def analyze_source_chunks(pack_id: str, source_id: str, filename: str, user: AuthenticatedUser, max_chunks: int = None, custom_system_prompt: Optional[str] = None):
    """Step 2: Analyze the chunks (OpenAI calls, deduct credits)
    
    Args:
        max_chunks: Optional limit on number of chunks to analyze (for partial analysis with limited credits)
    """
    try:
        print(f"Starting analysis for source {source_id}")
        
        # Update status to analyzing
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "analyzing",
            "progress_param": 10
        }).execute()
        
        # Load chunks from R2
        chunked_path = f"{user.r2_directory}/{pack_id}/{source_id}/chunked.json"
        chunks_data = download_from_r2(chunked_path, silent_404=False)
        if not chunks_data:
            print(f"❌ Failed to download chunks from: {chunked_path}")
            raise Exception("Chunks not found - extraction may have failed")
        
        all_chunks = json.loads(chunks_data)
        
        # Limit chunks if max_chunks is specified
        if max_chunks is not None and max_chunks < len(all_chunks):
            chunks = all_chunks[:max_chunks]
            print(f"📦 Loaded {len(all_chunks)} chunks, analyzing first {len(chunks)} chunks (limited by credits)")
        else:
            chunks = all_chunks
            print(f"📦 Loaded {len(chunks)} chunks from storage")
        
        
        # Check if this is a large job that needs email notification
        is_large_job = len(chunks) >= 10
        
        if is_large_job:
            print(f"📧 Large job detected ({len(chunks)} chunks). Will send email notification on completion.")
        
        openai_client = get_openai_client()
        total_input_tokens = 0
        total_output_tokens = 0
        total_cost = 0.0
        
        # Prepare paths for saving analysis
        pack_analyzed_path = f"{user.r2_directory}/{pack_id}/complete_analyzed.txt"
        analyzed_path = f"{user.r2_directory}/{pack_id}/{source_id}/analyzed.txt"
        
        # Get existing pack content (if any)
        existing_pack_content = download_from_r2(pack_analyzed_path, silent_404=True) or ""
        
        # Add source separator
        if existing_pack_content:
            source_header = f"\n\n--- SOURCE: {filename} ---\n\n"
        else:
            source_header = f"--- SOURCE: {filename} ---\n\n"
        
        base_system_prompt = "You are a personal data analysis assistant analyzing user-owned documents. Extract key insights concisely and comprehensively."
        if custom_system_prompt:
            trimmed_custom_prompt = custom_system_prompt.strip()
            # Prevent runaway prompts while allowing detailed guidance
            if len(trimmed_custom_prompt) > 2000:
                trimmed_custom_prompt = trimmed_custom_prompt[:2000]
            system_prompt = f"{base_system_prompt}\n\nPack instructions:\n{trimmed_custom_prompt}"
        else:
            system_prompt = base_system_prompt
        
        for idx, chunk in enumerate(chunks):
            # Check for cancellation at the start of each chunk
            if source_id in cancelled_jobs:
                print(f"🛑 Cancellation detected for source {source_id}. Stopping at chunk {idx+1}/{len(chunks)}")
                # Update status to cancelled
                supabase.rpc("update_source_status", {
                    "user_uuid": user.user_id,
                    "target_source_id": source_id,
                    "status_param": "cancelled",
                    "progress_param": 0,
                    "processed_chunks_param": idx  # Save how many were processed before cancel
                }).execute()
                cancelled_jobs.discard(source_id)
                return
            
            try:
                content_message = None
                redacted_chunk = apply_redaction_filters(chunk)
                # Something smaller more importnat to prioratize content over preferences/goals/etc.
                if len(chunks) == 1:
                    prompt = """
You are an expert data analyst.  
Your job is to extract and understand the core content of this conversation, not just surface-level topics.

Focus on:
1. The main facts, events, instructions, questions, and decisions made in the chat.
2. Key technical details, workflows, and problem-solving steps.
3. Important context the user relies on repeatedly.
4. Any dependencies, constraints, or long-term threads.

De-prioritize:
– Personal preferences  
– Goals  
– Writing style  
– Personality traits  
(Only include these if they directly influence the content.)

Produce a long, structured output that includes:
• A high-detail summary of what the chat contains  
• A breakdown of all major themes and subtopics  
• Critical information that must be preserved for future reasoning  
• Any relationships or references between parts of the text  
• A list of unresolved questions or next steps  
• A short “importance score” (1–10) for each major item to show how essential it is

Be thorough and factual. Go deep. This output will be used for content analysis and memory construction.
"""
                    content_message = redacted_chunk

                #Look for more of a user overview if looking at conversations.json
                elif "conversations" in filename.lower() or filename.lower().endswith('.json'):
                    # Separate prompt from content for better token management
                    prompt = """Analyze this conversation data and extract key insights in these 6 categories:

1. PERSONAL PROFILE: Demographics, preferences, goals, values, personality
2. BEHAVIORAL PATTERNS: Communication style, problem-solving, learning, habits  
3. KNOWLEDGE DOMAINS: Technical skills, expertise, academic background
4. PROJECT PATTERNS: Workflow preferences, tool usage, collaboration style
5. TIMELINE EVOLUTION: Skill development, milestones, interest changes
6. INTERACTION INSIGHTS: Communication preferences, response styles

Extract key facts (10-30 bullets per category). Be concise but comprehensive. Redact sensitive credentials. Output 1,000-2,000 tokens max."""
                    content_message = redacted_chunk
                
                #Likely just a document or mixed data
                else:
                    prompt = f"""You are an expert data analyst.  
Your job is to extract and understand the core content of the following document.
Analyze the content and produce a detailed output that includes:
• A high-detail summary of what the document contains  
• Critical information that must be preserved for future reasoning   
- Key facts, events, instructions, topics, questions, decisions
Be factual This output will be used for content analysis and memory construction. Looking for 1k token output. 
Document content:
{redacted_chunk}
Provide your comprehensive analysis below:"""


                # Build messages array - use content_message if defined (separated content), otherwise prompt has content embedded
                messages = [
                    {
                        "role": "system", 
                        "content": system_prompt
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ]
                
                # If content_message exists (for conversation analysis), add it as a separate message
                if content_message:
                    messages.append({
                        "role": "user",
                        "content": f"Content to analyze:\n\n{content_message}"
                    })
                
                response = await openai_call_with_retry(
                    openai_client,
                    max_retries=3,
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.3,
                    max_completion_tokens=1500  # Reduced for concise analysis - saves tokens and costs
                )
                
                analysis = response.choices[0].message.content
                
                # Check if OpenAI refused to analyze due to content policy
                if analysis and ("cannot assist" in analysis.lower() or "i'm sorry" in analysis.lower()[:50]):
                    raise Exception(f"Content policy refusal: OpenAI declined to analyze this content. This may occur with documents containing sensitive personal information.")
                
                # Track tokens and cost
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                total_cost += (input_tokens * 0.00015 / 1000) + (output_tokens * 0.0006 / 1000)
                
                print(f"✅ Chunk {idx+1}/{len(chunks)} analyzed: {output_tokens} tokens out, {input_tokens} tokens in")
                
                # Append this chunk's analysis to files
                chunk_sep = f"\n\n--- Chunk {idx+1}/{len(chunks)} ---\n\n" if len(chunks) > 1 else "\n\n"
                
                # Append to pack file
                if idx == 0:
                    # First chunk - add source header
                    upload_to_r2(pack_analyzed_path, existing_pack_content + source_header + analysis)
                else:
                    current = download_from_r2(pack_analyzed_path) or ""
                    upload_to_r2(pack_analyzed_path, current + chunk_sep + analysis)
                
                # Append to individual source file
                current_source = download_from_r2(analyzed_path, silent_404=True) or ""
                upload_to_r2(analyzed_path, current_source + chunk_sep + analysis)
                
                
                # Update progress with chunk count (more reliable than percentage for large files)
                progress = 50 + int((idx + 1) / len(chunks) * 40)
                supabase.rpc("update_source_status", {
                    "user_uuid": user.user_id,
                    "target_source_id": source_id,
                    "status_param": "processing",
                    "progress_param": progress,
                    "processed_chunks_param": idx + 1  # Current chunk number for frontend display
                }).execute()
                
                print(f"📊 Progress updated: {progress}% (chunk {idx+1}/{len(chunks)} complete)")
                
            except Exception as e:
                error_msg = str(e)
                print(f"❌ Error analyzing chunk {idx}: {error_msg}")
                
                # Check if this is a content policy refusal
                if "cannot assist" in error_msg.lower() or "content policy" in error_msg.lower() or "safety" in error_msg.lower():
                    print(f"🚫 Content policy refusal detected. This may be due to sensitive information in the document.")
                    # Save a placeholder for this chunk
                    error_analysis = f"[Chunk {idx+1} could not be analyzed due to content policy restrictions. This may occur with documents containing sensitive personal information like receipts, invoices, or official records.]"
                    current_source = download_from_r2(analyzed_path, silent_404=True) or ""
                    upload_to_r2(analyzed_path, current_source + f"\n\n--- Chunk {idx+1}/{len(chunks)} ---\n\n" + error_analysis)
                
                continue
        
        # Update source status to completed (whether full or partial analysis)
        # If user had limited credits, they successfully completed what they could afford
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "completed",
            "progress_param": 100,
            "total_chunks_param": len(all_chunks),  # Total chunks available in source
            "processed_chunks_param": len(chunks),   # Chunks actually analyzed
            "total_input_tokens_param": total_input_tokens,
            "total_output_tokens_param": total_output_tokens,
            "total_cost_param": total_cost
        }).execute()
        
        if max_chunks is not None and len(chunks) < len(all_chunks):
            print(f"✅ Source {source_id} analyzed: {len(chunks)} of {len(all_chunks)} chunks (limited by available credits)")
        else:
            print(f"✅ Source {source_id} analyzed successfully")
        
        # Send email notification if it was a large job
        if is_large_job:
            try:
                await send_email_notification(
                    user_email=user.email,
                    job_id=source_id,
                    chunks_processed=len(chunks),
                    total_chunks=len(chunks),
                    success=True
                )
                print(f"📧 Email notification sent to {user.email}")
            except Exception as email_error:
                print(f"⚠️ Failed to send email notification: {email_error}")
        
        # Deduct credits from user
        await update_user_chunks_used(user.user_id, len(chunks))
        
    except Exception as e:
        print(f"❌ Error analyzing source {source_id}: {e}")
        
        # Update source status to failed
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "failed",
            "error_message_param": str(e)
        }).execute()
        
        # Send failure email notification if it was a large job
        if 'is_large_job' in locals() and is_large_job:
            try:
                await send_email_notification(
                    user_email=user.email,
                    job_id=source_id,
                    chunks_processed=0,
                    total_chunks=len(chunks) if 'chunks' in locals() else 0,
                    success=False
                )
                print(f"📧 Failure email notification sent to {user.email}")
            except Exception as email_error:
                print(f"⚠️ Failed to send failure email notification: {email_error}")

@app.get("/api/job-summary/{job_id}")
async def get_job_summary(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get job summary information."""
    try:
        # Try to get job summary from R2
        job_summary_content = download_from_r2(f"{user.r2_directory}/{job_id}/job_summary.json", silent_404=True)
        if job_summary_content:
            return json.loads(job_summary_content)
        
        # If no job summary exists, return a default response
        return {
            "job_id": job_id,
            "status": "not_found",
            "message": "Job summary not available"
        }
        
    except Exception as e:
        print(f"Error getting job summary for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving job summary: {str(e)}")

@app.get("/api/results/{job_id}")
async def get_extraction_results(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get final extraction results after background processing completes."""
    try:
        # First check database for job status
        db_job_status = None
        try:
            import sqlite3
            # Create database path based on user directory
            user_dir = user.r2_directory.replace('/', '_')
            db_path = f'jobs_{user_dir}.db'
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT status, error_message FROM jobs WHERE job_id = ?", (job_id,))
                result = cursor.fetchone()
                if result:
                    db_job_status = {"status": result[0], "error_message": result[1]}
                conn.close()
        except Exception as db_error:
            print(f"Error checking database for job {job_id}: {db_error}")
        
        # If job failed in database, return the error
        if db_job_status and db_job_status["status"] == "failed":
            return {
                "status": "failed",
                "error": db_job_status.get("error_message", "Unknown error occurred"),
                "extracted": False,
                "chunked": False,
                "analyzed": False,
                "job_id": job_id
            }
        
        # Check if extracted (use silent_404=True to avoid error logging)
        extracted_exists = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt", silent_404=True) is not None
        
        # Check if chunked
        chunks_metadata = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json", silent_404=True)
        chunks_exist = chunks_metadata is not None
        
        # Check if completed (analysis done)
        summary = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json", silent_404=True)
        completed = summary is not None
        
        if completed:
            summary_data = json.loads(summary)
            # Get chunks data for UI
            if chunks_exist:
                chunk_data = json.loads(chunks_metadata)
                summary_data["chunks"] = chunk_data.get("chunks", [])
            
            # Check if pack is available in database (with retry for timing issues)
            pack_available = False
            pack_info = None
            for attempt in range(3):  # Try 3 times with delays
                try:
                    if supabase:  # Use global supabase client
                        pack_result = supabase.table('packs').select('*').eq('job_id', job_id).eq('user_id', user.user_id).execute()
                        if pack_result.data:
                            pack_available = True
                            pack_info = pack_result.data[0]
                            print(f"✅ Pack found in database for job {job_id}")
                            break
                        else:
                            print(f"⏳ Pack not yet available for job {job_id}, attempt {attempt + 1}/3")
                            if attempt < 2:  # Don't wait on last attempt
                                import asyncio
                                await asyncio.sleep(1)  # Wait 1 second before retry
                    else:
                        print(f"❌ Supabase client not available")
                        break
                except Exception as pack_check_error:
                    print(f"❌ Error checking pack availability: {pack_check_error}")
                    if attempt < 2:
                        import asyncio
                        await asyncio.sleep(1)
            
            return {
                "status": "completed",
                "extracted": True,
                "chunked": True,
                "analyzed": True,
                "pack_available": pack_available,
                "pack_info": pack_info,
                **summary_data
            }
        elif chunks_exist:
            chunk_data = json.loads(chunks_metadata)
            return {
                "status": "chunked",
                "extracted": True,
                "chunked": True,
                "analyzed": False,
                **chunk_data
            }
        elif extracted_exists:
            return {
                "status": "extracted",
                "extracted": True,
                "chunked": False,
                "analyzed": False,
                "job_id": job_id
            }
        else:
            raise HTTPException(status_code=404, detail="Job results not found")
        
    except Exception as e:
        print(f"Error getting results for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get results: {str(e)}")

@app.get("/api/estimate/{job_id}")
async def estimate_processing_cost(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Estimate the cost of processing based on extracted text."""
    try:
        # Download extracted text from R2
        extracted_content = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt")
        if not extracted_content:
            raise HTTPException(status_code=404, detail="Extracted text not found")

        # Count total tokens in extracted content
        total_tokens = count_tokens(extracted_content)
        
        # Estimate chunks (same logic as chunking process)
        max_tokens = 150000  # Same as chunking process
        estimated_chunks = max(1, (total_tokens + max_tokens - 1) // max_tokens)  # Ceiling division
        
        # GPT-5-nano pricing
        input_cost_per_million = 0.050  # $0.050 per 1M input tokens
        output_cost_per_million = 0.400  # $0.400 per 1M output tokens
        estimated_output_tokens_per_chunk = 15000  # Same as max_completion_tokens in analyze
        
        # Calculate costs
        total_input_tokens = total_tokens
        total_output_tokens = estimated_chunks * estimated_output_tokens_per_chunk
        
        input_cost = (total_input_tokens / 1_000_000) * input_cost_per_million
        output_cost = (total_output_tokens / 1_000_000) * output_cost_per_million
        total_cost = input_cost + output_cost
        
        return {
            "job_id": job_id,
            "total_tokens": total_tokens,
            "estimated_chunks": estimated_chunks,
            "total_input_tokens": total_input_tokens,
            "estimated_output_tokens": total_output_tokens,
            "input_cost": round(input_cost, 4),
            "output_cost": round(output_cost, 4),
            "total_estimated_cost": round(total_cost, 4),
            "model": "gpt-5-nano-2025-08-07",
            "pricing": {
                "input_per_million": input_cost_per_million,
                "output_per_million": output_cost_per_million
            }
        }
        
    except Exception as e:
        print(f"Error estimating cost for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to estimate cost: {str(e)}")

@app.get("/api/payment/status")
async def get_payment_status(user: AuthenticatedUser = Depends(get_current_user)):
    """Get user's current payment status and chunk limits"""
    try:
        payment_status = await get_user_payment_status(user.user_id)
        return payment_status
    except Exception as e:
        print(f"Error getting payment status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get payment status: {str(e)}")

@app.get("/api/payment/history")
async def get_payment_history(user: AuthenticatedUser = Depends(get_current_user)):
    """Get user's payment and credit transaction history"""
    try:
        if not supabase:
            return {"transactions": [], "summary": {}}
        
        # Get all transactions for the user
        transactions = supabase.table("credit_transactions").select("*").eq("user_id", user.user_id).order("created_at", desc=True).limit(100).execute()
        
        if not transactions.data:
            return {
                "transactions": [],
                "summary": {
                    "total_purchased": 0,
                    "total_used": 0,
                    "total_refunded": 0,
                    "total_transactions": 0
                }
            }
        
        # Calculate summary statistics
        total_purchased = sum(t["credits"] for t in transactions.data if t["transaction_type"] == "purchase" and t["credits"] > 0)
        total_used = abs(sum(t["credits"] for t in transactions.data if t["transaction_type"] == "usage" and t["credits"] < 0))
        total_refunded = sum(t["credits"] for t in transactions.data if t["transaction_type"] == "refund" and t["credits"] > 0)
        
        return {
            "transactions": transactions.data,
            "summary": {
                "total_purchased": total_purchased,
                "total_used": total_used,
                "total_refunded": total_refunded,
                "total_transactions": len(transactions.data),
                "net_credits": total_purchased + total_refunded - total_used
            }
        }
        
    except Exception as e:
        print(f"Error getting payment history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get payment history: {str(e)}")

@app.post("/api/payment/purchase-credits")
async def purchase_credits(request: CreditPurchaseRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Purchase credits for pay-per-chunk analysis"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Payment system not available")
        
        if request.credits <= 0:
            raise HTTPException(status_code=400, detail="Credits must be greater than 0")
        
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        
        # Get current user profile to validate
        result = supabase.table("user_profiles").select("*").eq("id", user.user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        # Use the database function to add credits (handles both transaction and balance update)
        credit_result = supabase.rpc("add_credits_to_user", {
            "user_uuid": user.user_id,
            "credits_to_add": request.credits,
            "transaction_description": f"Credit purchase - ${request.amount} for {request.credits} credits"
        }).execute()
        
        if credit_result.data and credit_result.data != -1:
            new_balance = credit_result.data
            print(f"✅ Successfully added {request.credits} credits. New balance: {new_balance}")
        else:
            print(f"❌ Failed to add credits: {credit_result}")
            raise HTTPException(status_code=500, detail="Failed to add credits to account")
        
        return {
            "status": "success",
            "credits_purchased": request.credits,
            "amount_paid": request.amount,
            "new_balance": new_balance,
            "package_id": request.package_id,
            "message": f"Successfully purchased {request.credits} credits"
        }
        
    except Exception as e:
        print(f"Error purchasing credits: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to purchase credits: {str(e)}")

@app.get("/api/user/profile")
async def get_user_profile(user: AuthenticatedUser = Depends(get_current_user)):
    """Get user's profile including credit balance"""
    try:
        if not supabase:
            # Legacy mode - return default values
            return {
                "credits_balance": get_new_user_credits(),
                "can_process": True,
                "email": user.email if hasattr(user, 'email') else "unknown@example.com",
                "payment_plan": "legacy"
            }
        
        # Get user profile using database function
        result = supabase.rpc("get_user_profile_for_backend", {"user_uuid": user.user_id}).execute()
        
        if result.data:
            profile = result.data
            return {
                "credits_balance": profile.get("credits_balance", 0),
                "can_process": profile.get("payment_plan") == "unlimited" or profile.get("credits_balance", 0) > 0,
                "email": profile.get("email", "unknown@example.com"),
                "payment_plan": profile.get("payment_plan", "credits"),
                "chunks_analyzed": profile.get("chunks_analyzed", 0),
                "created_at": profile.get("created_at"),
                "updated_at": profile.get("updated_at")
            }
        else:
            # Create profile if it doesn't exist
            create_result = supabase.rpc("create_user_profile_for_backend", {
                "user_uuid": user.user_id,
                "user_email": getattr(user, 'email', "unknown@example.com"),
                "r2_dir": f"user_{user.user_id}"
            }).execute()
            
            if create_result.data:
                profile = create_result.data
                return {
                    "credits_balance": profile.get("credits_balance", get_new_user_credits()),
                    "can_process": True,
                    "email": profile.get("email", "unknown@example.com"),
                    "payment_plan": profile.get("payment_plan", "credits"),
                    "chunks_analyzed": profile.get("chunks_analyzed", 0),
                    "created_at": profile.get("created_at"),
                    "updated_at": profile.get("updated_at")
                }
            else:
                # Fallback default
                return {
                    "credits_balance": get_new_user_credits(),
                    "can_process": True,
                    "email": getattr(user, 'email', "unknown@example.com"),
                    "payment_plan": "credits"
                }
        
    except Exception as e:
        print(f"Error getting user profile: {e}")
        # Return safe defaults on error
        return {
            "credits_balance": 0,
            "can_process": False,
            "email": getattr(user, 'email', "unknown@example.com"),
            "payment_plan": "credits",
            "error": str(e)
        }

# Global job cancellation tracking
cancelled_jobs = set()

@app.post("/api/cancel/{job_id}")
async def cancel_job(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Cancel a running analysis job"""
    try:
        # Add to cancelled jobs set
        cancelled_jobs.add(job_id)
        
        # Update job progress and database
        update_job_progress(job_id, "cancelling", 0, "Cancellation requested...")
        await update_job_status_in_db(user, job_id, "cancelled", 0, "Cancelled by user")
        
        print(f"🚫 Job {job_id} cancellation requested by user {user.user_id}")
        
        return {
            "job_id": job_id,
            "status": "cancellation_requested",
            "message": "Job cancellation has been requested. It may take a moment to stop.",
            "credit_policy": "If 10 or more chunks were processed, credits will be deducted for the completed work."
        }
        
    except Exception as e:
        print(f"❌ Error cancelling job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")


@app.get("/api/status/{job_id}")
async def get_status(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get job status and progress with real-time updates."""
    try:
        # Get real-time progress first
        progress_info = get_job_progress(job_id)
        
        # Check if extracted
        extracted_exists = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt", silent_404=True) is not None
        
        # Check if chunked
        chunks_metadata = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json", silent_404=True)
        chunks_exist = chunks_metadata is not None
        
        # Check if completed
        summary = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json", silent_404=True)
        completed = summary is not None
        
        if completed:
            summary_data = json.loads(summary)
            return {
                "status": "completed",
                "extracted": True,
                "chunked": True,
                "analyzed": True,
                "progress": progress_info,
                **summary_data
            }
        elif chunks_exist:
            chunk_data = json.loads(chunks_metadata)
            return {
                "status": progress_info.get("step", "chunked"),
                "extracted": True,
                "chunked": True,
                "analyzed": False,
                "progress": progress_info,
                **chunk_data
            }
        elif extracted_exists:
            return {
                "status": progress_info.get("step", "extracted"),
                "extracted": True,
                "chunked": False,
                "analyzed": False,
                "progress": progress_info
            }
        else:
            return {
                "status": "not_found",
                "extracted": False,
                "chunked": False,
                "analyzed": False
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@app.get("/api/logs/{job_id}")
async def get_job_logs(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get processing logs for a job."""
    try:
        process_log_path = f"{user.r2_directory}/{job_id}/process.log"
        log_content = download_from_r2(process_log_path, silent_404=True)
        
        if not log_content:
            return {"logs": ""}
        
        return {"logs": log_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/progress-stream/{job_id}")
async def get_job_progress_stream(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Real-time Server-Sent Events stream for job progress."""
    try:
        print(f"🚀 Creating SSE stream for job: {job_id}")
        
        # Set proper SSE headers
        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
        
        return StreamingResponse(
            progress_stream_generator(job_id),
            media_type="text/event-stream",
            headers=headers
        )
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{job_id}/complete")
async def download_complete_ucp(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download complete UCP file from R2. Works with both legacy jobs and v2 packs."""
    try:
        print(f"Attempting to download complete UCP for job/pack: {job_id}")
        
        # Try direct path first (legacy jobs)
        content = download_from_r2_with_fallback(
            f"{user.r2_directory}/{job_id}/complete_ucp.txt",
            job_id,
            "complete_ucp.txt",
            silent_404=True
        )
        
        # If not found, check if this is a v2 pack with sources
        if not content and supabase:
            try:
                print(f"Checking if {job_id} is a v2 pack...")
                result = supabase.rpc("get_pack_details_v2", {
                    "user_uuid": user.user_id,
                    "target_pack_id": job_id
                }).execute()
                
                print(f"Pack lookup result: {result.data is not None}")
                if result.data:
                    pack_data = result.data.get("pack", {})
                    sources = result.data.get("sources", [])
                    print(f"Found {len(sources)} sources in pack")
                    
                    # Check if this pack was migrated from a legacy job
                    legacy_job_id = pack_data.get("legacy_job_id")
                    if legacy_job_id:
                        print(f"Pack has legacy_job_id: {legacy_job_id}, trying that path...")
                        content = download_from_r2_with_fallback(
                            f"{user.r2_directory}/{legacy_job_id}/complete_ucp.txt",
                            legacy_job_id,
                            "complete_ucp.txt",
                            silent_404=True
                        )
                        if content:
                            print(f"✅ Found complete_ucp.txt in legacy job {legacy_job_id}")
                    
                    if not content:
                        # Try to find complete_ucp.txt in any of the sources
                        for source in sources:
                            source_id = source.get("source_id")
                            source_name = source.get("source_name", "unknown")
                            print(f"Checking source {source_id} ({source_name})")
                            
                            if source_id:
                                # Try the source's directory
                                content = download_from_r2_with_fallback(
                                    f"{user.r2_directory}/{source_id}/complete_ucp.txt",
                                    source_id,
                                    "complete_ucp.txt",
                                    silent_404=True
                                )
                                if content:
                                    print(f"✅ Found complete_ucp.txt in source {source_id}")
                                    break
                    
                    # If still not found, try to get the combined pack analysis
                    if not content:
                        pack_analyzed_path = f"{user.r2_directory}/{job_id}/complete_analyzed.txt"
                        content = download_from_r2(pack_analyzed_path, silent_404=True)
                        if content:
                            print(f"✅ Found combined pack analysis")
                    
                    # If still not found, generate UCP from analyzed sources
                    if not content and sources:
                        print("No pre-generated UCP found, creating from pack sources...")
                        combined_content = []
                        pack_name = pack_data.get("pack_name", "Untitled Pack")
                        
                        combined_content.append(f"UNIVERSAL CONTEXT PACK - {pack_name}")
                        combined_content.append("=" * 80)
                        combined_content.append(f"\nGenerated from {len(sources)} source(s)\n")
                        
                        for source in sources:
                            if source.get("status") == "completed":
                                source_id = source.get("source_id")
                                source_name = source.get("source_name", "unknown")
                                
                                # Try to get analyzed content
                                analyzed_path = f"{user.r2_directory}/{job_id}/{source_id}/analyzed.txt"
                                analyzed_content = download_from_r2(analyzed_path, silent_404=True)
                                
                                if analyzed_content:
                                    combined_content.append(f"\n{'='*80}")
                                    combined_content.append(f"SOURCE: {source_name}")
                                    combined_content.append('='*80 + '\n')
                                    combined_content.append(analyzed_content)
                        
                        if len(combined_content) > 3:  # Has content beyond header
                            content = "\n".join(combined_content)
                            print(f"✅ Generated UCP from {len([s for s in sources if s.get('status') == 'completed'])} completed sources")
                else:
                    print(f"No pack found with ID {job_id}")
            except Exception as e:
                print(f"Error checking pack sources: {e}")
                import traceback
                traceback.print_exc()
        
        if content is None:
            raise HTTPException(status_code=404, detail="Complete UCP file not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=complete_ucp_{job_id}.txt"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/download/{job_id}/ultra-compact")
async def download_ultra_compact_ucp(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download ultra-compact UCP file (~50k tokens). Works with both legacy jobs and v2 packs."""
    try:
        print(f"Attempting to download ultra-compact UCP for job/pack: {job_id}")
        
        # Try direct path first (legacy jobs)
        content = download_from_r2_with_fallback(
            f"{user.r2_directory}/{job_id}/ultra_compact_ucp.txt",
            job_id,
            "ultra_compact_ucp.txt",
            silent_404=True
        )
        
        # If not found, check if this is a v2 pack with sources
        if not content and supabase:
            try:
                result = supabase.rpc("get_pack_details_v2", {
                    "user_uuid": user.user_id,
                    "target_pack_id": job_id
                }).execute()
                
                if result.data:
                    sources = result.data.get("sources", [])
                    for source in sources:
                        source_id = source.get("source_id")
                        if source_id:
                            content = download_from_r2_with_fallback(
                                f"{user.r2_directory}/{source_id}/ultra_compact_ucp.txt",
                                source_id,
                                "ultra_compact_ucp.txt",
                                silent_404=True
                            )
                            if content:
                                print(f"✅ Found ultra_compact_ucp.txt in source {source_id}")
                                break
            except Exception as e:
                print(f"Error checking pack sources: {e}")
        
        if content is None:
            raise HTTPException(status_code=404, detail="Ultra-compact UCP not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=ultra_compact_ucp_{job_id}.txt"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Ultra-compact UCP not found: {str(e)}")

@app.get("/api/download/{job_id}/standard")
async def download_standard_ucp(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download standard UCP file (~100k tokens). Works with both legacy jobs and v2 packs.""" 
    try:
        print(f"Attempting to download standard UCP for job/pack: {job_id}")
        
        # Try direct path first (legacy jobs)
        content = download_from_r2_with_fallback(
            f"{user.r2_directory}/{job_id}/standard_ucp.txt",
            job_id,
            "standard_ucp.txt",
            silent_404=True
        )
        
        # If not found, check if this is a v2 pack with sources
        if not content and supabase:
            try:
                result = supabase.rpc("get_pack_details_v2", {
                    "user_uuid": user.user_id,
                    "target_pack_id": job_id
                }).execute()
                
                if result.data:
                    sources = result.data.get("sources", [])
                    for source in sources:
                        source_id = source.get("source_id")
                        if source_id:
                            content = download_from_r2_with_fallback(
                                f"{user.r2_directory}/{source_id}/standard_ucp.txt",
                                source_id,
                                "standard_ucp.txt",
                                silent_404=True
                            )
                            if content:
                                print(f"✅ Found standard_ucp.txt in source {source_id}")
                                break
            except Exception as e:
                print(f"Error checking pack sources: {e}")
        
        if content is None:
            raise HTTPException(status_code=404, detail="Standard UCP not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=standard_ucp_{job_id}.txt"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Standard UCP not found: {str(e)}")

@app.get("/api/download/{job_id}/chunked")
async def download_chunked_ucp_index(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download chunked UCP index with instructions."""
    try:
        content = download_from_r2(f"{user.r2_directory}/{job_id}/chunked_ucp_index.txt")
        if content is None:
            raise HTTPException(status_code=404, detail="Chunked UCP index not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=chunked_ucp_index_{job_id}.txt"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="Chunked UCP index not found")

@app.get("/api/download/{job_id}/chunked/{part_number}")
async def download_chunked_ucp_part(job_id: str, part_number: int, user: AuthenticatedUser = Depends(get_current_user)):
    """Download specific part of chunked UCP."""
    try:
        content = download_from_r2(f"{user.r2_directory}/{job_id}/chunked_ucp_part_{part_number}.txt")
        if content is None:
            raise HTTPException(status_code=404, detail=f"Chunked UCP part {part_number} not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=chunked_ucp_part_{part_number}_{job_id}.txt"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Chunked UCP part {part_number} not found")

@app.get("/api/ucp-info/{job_id}")
async def get_ucp_info(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get information about available UCP formats and their sizes."""
    try:
        import tiktoken
        tokenizer = tiktoken.get_encoding("cl100k_base")
        
        def count_tokens(text: str) -> int:
            return len(tokenizer.encode(text))
        
        # Check which UCP versions are available
        available_formats = {}
        
        # Complete UCP
        complete_content = download_from_r2(f"{user.r2_directory}/{job_id}/complete_ucp.txt")
        if complete_content:
            available_formats["complete"] = {
                "name": "Complete UCP",
                "description": "Full detailed analysis with all insights",
                "token_count": count_tokens(complete_content),
                "best_for": "Comprehensive context, research purposes",
                "compatibility": "May exceed context limits of some LLMs"
            }
        
        # Ultra-compact UCP
        ultra_content = download_from_r2(f"{user.r2_directory}/{job_id}/ultra_compact_ucp.txt")
        if ultra_content:
            available_formats["ultra_compact"] = {
                "name": "Ultra-Compact UCP",
                "description": "Essential context only (~50k tokens)",
                "token_count": count_tokens(ultra_content),
                "best_for": "Quick context transfer, fits any LLM",
                "compatibility": "Works with all LLMs (GPT, Claude, Gemini)"
            }
        
        # Standard UCP
        standard_content = download_from_r2(f"{user.r2_directory}/{job_id}/standard_ucp.txt")
        if standard_content:
            available_formats["standard"] = {
                "name": "Standard UCP", 
                "description": "Balanced detail (~100k tokens)",
                "token_count": count_tokens(standard_content),
                "best_for": "General use, good balance of detail and size",
                "compatibility": "Works with most LLMs"
            }
        
        # Chunked UCP
        chunked_index = download_from_r2(f"{user.r2_directory}/{job_id}/chunked_ucp_index.txt")
        if chunked_index:
            # Count chunked parts
            part_num = 1
            total_chunks = 0
            while True:
                part_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunked_ucp_part_{part_num}.txt")
                if not part_content:
                    break
                total_chunks += 1
                part_num += 1
            
            available_formats["chunked"] = {
                "name": "Chunked UCP",
                "description": f"Complete UCP split into {total_chunks} manageable parts",
                "parts": total_chunks,
                "best_for": "When you need full detail but have context limits",
                "compatibility": "Each part fits within standard context windows"
            }
        
        return {
            "job_id": job_id,
            "available_formats": available_formats,
            "recommendations": {
                "claude": "Use Ultra-Compact or Standard (Claude has 200k context but strict limits)",
                "gpt4": "Use Standard or Chunked (100k context window)",
                "gpt3.5": "Use Ultra-Compact only (16k context window)",
                "gemini": "Use Standard or Complete (1M context window)"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get UCP info: {str(e)}")

@app.get("/api/download/{job_id}/extracted")
async def download_extracted_text(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download extracted text file from R2."""
    try:
        content = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt")
        if content is None:
            raise HTTPException(status_code=404, detail="File not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=extracted_{job_id}.txt"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/download/{job_id}/chunk/{chunk_index}")
async def download_chunk_file(job_id: str, chunk_index: int, user: AuthenticatedUser = Depends(get_current_user)):
    """Download individual chunk file from R2."""
    try:
        # Chunks are stored as chunk_001.txt, chunk_002.txt, etc. (1-indexed)
        # chunk_index parameter is already 1-based from frontend
        chunk_filename = f"chunk_{chunk_index:03d}.txt"
        chunk_key = f"{user.r2_directory}/{job_id}/{chunk_filename}"
        
        print(f"Attempting to download chunk: {chunk_key}")
        
        content = download_from_r2(chunk_key)
        if content is None:
            print(f"Chunk download failed - content is None for: {chunk_key}")
            raise HTTPException(status_code=404, detail=f"Chunk file not found: {chunk_filename}")
        
        print(f"Successfully downloaded chunk {chunk_filename} ({len(content)} chars)")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename={chunk_filename}"}
        )
    except Exception as e:
        print(f"Error downloading chunk {chunk_index} for job {job_id}: {e}")
        print(f"Attempted key: {user.r2_directory}/{job_id}/chunk_{chunk_index:03d}.txt")
        raise HTTPException(status_code=404, detail=f"Chunk file not found: {str(e)}")

@app.get("/api/download/{job_id}/pack")
async def download_complete_pack(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download complete pack as ZIP file containing all job files."""
    try:
        import zipfile
        import tempfile
        
        print(f"Download pack request for job {job_id} by user {user.user_id} (directory: {user.r2_directory})")
        
        # Create a temporary file for the ZIP
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                
                # List of files to include in the pack (only add if they exist)
                file_mappings = [
                    (f"{user.r2_directory}/{job_id}/extracted.txt", "extracted.txt"),
                    (f"{user.r2_directory}/{job_id}/complete_ucp.txt", "complete_ucp.txt"),
                    (f"{user.r2_directory}/{job_id}/summary.json", "summary.json"),
                    (f"{user.r2_directory}/{job_id}/job_summary.json", "job_summary.json"),
                    (f"{user.r2_directory}/{job_id}/chunks_metadata.json", "chunks_metadata.json"),
                ]
                
                # Add main files (only if they exist)
                files_added = 0
                missing_files = []
                for r2_key, zip_name in file_mappings:
                    try:
                        print(f"Attempting to download: {r2_key}")
                        # Extract filename from the path for fallback function
                        filename = zip_name  # Use the zip name as the filename
                        content = download_from_r2_with_fallback(r2_key, job_id, filename)
                        if content:
                            zipf.writestr(zip_name, content)
                            files_added += 1
                            print(f"✅ Added {zip_name} to pack")
                        else:
                            missing_files.append(zip_name)
                            print(f"❌ File not found: {zip_name}")
                    except Exception as e:
                        # Skip missing files
                        missing_files.append(zip_name)
                        print(f"❌ Error downloading {zip_name}: {e}")
                        continue
                
                # Add all chunk files
                chunk_metadata_content = download_from_r2_with_fallback(f"{user.r2_directory}/{job_id}/chunks_metadata.json", job_id, "chunks_metadata.json")
                if chunk_metadata_content:
                    chunk_metadata = json.loads(chunk_metadata_content)
                    total_chunks = chunk_metadata.get("total_chunks", 0)
                    print(f"Found chunk metadata with {total_chunks} chunks")
                    
                    # Create chunks directory in ZIP
                    chunks_added = 0
                    for i in range(1, total_chunks + 1):
                        chunk_filename = f"chunk_{i:03d}.txt"
                        chunk_content = download_from_r2_with_fallback(f"{user.r2_directory}/{job_id}/{chunk_filename}", job_id, chunk_filename)
                        if chunk_content:
                            zipf.writestr(f"chunks/{chunk_filename}", chunk_content)
                            chunks_added += 1
                    print(f"Added {chunks_added}/{total_chunks} chunk files")
                else:
                    print("No chunk metadata found")
                
                # Add all result files (only if they exist)
                summary_content = download_from_r2_with_fallback(f"{user.r2_directory}/{job_id}/summary.json", job_id, "summary.json")
                if summary_content:
                    try:
                        summary = json.loads(summary_content)
                        processed_chunks = summary.get("processed_chunks", 0)
                        print(f"Found summary with {processed_chunks} processed chunks")
                        
                        # Create results directory in ZIP only if we have processed chunks
                        results_added = 0
                        if processed_chunks > 0:
                            for i in range(1, processed_chunks + 1):
                                result_filename = f"result_{i:03d}.json"
                                result_content = download_from_r2_with_fallback(f"{user.r2_directory}/{job_id}/{result_filename}", job_id, result_filename)
                                if result_content:
                                    zipf.writestr(f"results/{result_filename}", result_content)
                                    results_added += 1
                        print(f"Added {results_added}/{processed_chunks} result files")
                    except (json.JSONDecodeError, KeyError):
                        # Skip results if summary is invalid
                        print("Invalid summary JSON, skipping results")
                        pass
                else:
                    print("No summary found")
                
                # Check if we have any files in the ZIP
                zip_files = zipf.namelist()
                print(f"Total files in ZIP: {len(zip_files)}")
                if len(zip_files) == 0:
                    print(f"No files found for job {job_id} in directory {user.r2_directory}")
                    print(f"Missing files: {missing_files}")
                    raise HTTPException(
                        status_code=404, 
                        detail=f"No files found for job {job_id}. This job may not exist, may belong to a different user, or may not have completed processing yet."
                    )
        
        # Read the ZIP file and return it
        with open(temp_zip.name, 'rb') as f:
            zip_data = f.read()
        
        # Clean up temp file
        os.unlink(temp_zip.name)
        
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type='application/zip',
            headers={"Content-Disposition": f"attachment; filename=ucp_pack_{job_id}.zip"}
        )
        
    except Exception as e:
        print(f"Error creating pack for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create pack: {str(e)}")

@app.get("/api/download/{job_id}/chunks")
async def download_chunks_only(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download chunks as ZIP file containing only the chunked text files."""
    try:
        import zipfile
        import tempfile
        
        print(f"Download chunks request for job {job_id} by user {user.user_id} (directory: {user.r2_directory})")
        
        # Create a temporary file for the ZIP
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                
                # Add chunk metadata
                metadata_path = f"{user.r2_directory}/{job_id}/chunks_metadata.json"
                print(f"Looking for chunk metadata at: {metadata_path}")
                chunk_metadata_content = download_from_r2_with_fallback(metadata_path, job_id, "chunks_metadata.json")
                
                # Get processed chunks count from summary (like pack download does)
                summary_content = download_from_r2_with_fallback(f"{user.r2_directory}/{job_id}/summary.json", job_id, "summary.json")
                processed_chunks = 0
                if summary_content:
                    try:
                        summary = json.loads(summary_content)
                        processed_chunks = summary.get("processed_chunks", 0)
                        print(f"Found summary with {processed_chunks} processed chunks")
                    except (json.JSONDecodeError, KeyError):
                        print("Failed to parse summary.json, falling back to all chunks")
                
                if chunk_metadata_content:
                    zipf.writestr("chunks_metadata.json", chunk_metadata_content)
                    chunk_metadata = json.loads(chunk_metadata_content)
                    total_chunks = chunk_metadata.get("total_chunks", 0)
                    
                    # Use processed_chunks if available, otherwise fall back to total_chunks
                    chunks_to_download = processed_chunks if processed_chunks > 0 else total_chunks
                    print(f"Found {total_chunks} total chunks, will download {chunks_to_download} processed chunks")
                    
                    # Add only the processed chunk files
                    chunks_added = 0
                    for i in range(1, chunks_to_download + 1):
                        chunk_filename = f"chunk_{i:03d}.txt"
                        chunk_path = f"{user.r2_directory}/{job_id}/{chunk_filename}"
                        print(f"Looking for chunk {i} at: {chunk_path}")
                        chunk_content = download_from_r2_with_fallback(chunk_path, job_id, chunk_filename)
                        if chunk_content:
                            zipf.writestr(chunk_filename, chunk_content)
                            chunks_added += 1
                            print(f"✅ Added {chunk_filename} to ZIP")
                        else:
                            print(f"❌ Chunk {i} not found")
                    
                    print(f"Successfully added {chunks_added}/{chunks_to_download} processed chunks to ZIP")
                    
                    if chunks_added == 0:
                        raise HTTPException(
                            status_code=404, 
                            detail=f"No chunk files found for job {job_id}. Expected path: {user.r2_directory}/{job_id}/chunk_XXX.txt"
                        )
                else:
                    print(f"❌ Chunk metadata not found at: {metadata_path}")
                    # Let's also check what the user path is vs the screenshot path
                    screenshot_path = f"user_08192f18-0b1c-4d00-9b90-208c64dd972e/{job_id}/chunks_metadata.json"
                    print(f"Screenshot shows path like: {screenshot_path}")
                    print(f"User directory is: {user.r2_directory}")
                    raise HTTPException(
                        status_code=404, 
                        detail=f"Chunks metadata not found for job {job_id}. Expected at: {metadata_path}"
                    )
        
        # Read the ZIP file and return it
        with open(temp_zip.name, 'rb') as f:
            zip_data = f.read()
        
        # Clean up temp file
        os.unlink(temp_zip.name)
        
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type='application/zip',
            headers={"Content-Disposition": f"attachment; filename=ucp_chunks_{job_id}.zip"}
        )
        
    except Exception as e:
        print(f"Error creating chunks pack for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create chunks pack: {str(e)}")

@app.get("/api/download/{job_id}/{filename}")
async def download_result_file(job_id: str, filename: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download individual result files (result_001.json, result_002.json, etc.) from R2."""
    try:
        # Validate filename to prevent directory traversal
        if not ((filename.startswith('result_') and filename.endswith('.json')) or filename == 'summary.json'):
            raise HTTPException(status_code=400, detail="Invalid filename format")
        
        file_key = f"{user.r2_directory}/{job_id}/{filename}"
        
        print(f"Attempting to download result file: {file_key}")
        
        content = download_from_r2(file_key)
        if content is None:
            print(f"Result file download failed - content is None for: {file_key}")
            raise HTTPException(status_code=404, detail=f"Result file not found: {filename}")
        
        print(f"Successfully downloaded result file {filename} ({len(content)} chars)")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='application/json',
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"Error downloading result file {filename} for job {job_id}: {e}")
        print(f"Attempted key: {user.r2_directory}/{job_id}/{filename}")
        raise HTTPException(status_code=404, detail=f"Result file not found: {str(e)}")

@app.get("/api/debug/{job_id}/files")
async def debug_job_files(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Debug endpoint to check which files exist for a job."""
    try:
        base_path = f"{user.r2_directory}/{job_id}"
        files_to_check = [
            "extracted.txt",
            "complete_ucp.txt", 
            "summary.json",
            "job_summary.json",
            "chunks_metadata.json"
        ]
        
        file_status = {}
        for filename in files_to_check:
            full_path = f"{base_path}/{filename}"
            try:
                content = download_from_r2(full_path, silent_404=True)
                file_status[filename] = {
                    "exists": content is not None,
                    "size": len(content) if content else 0,
                    "path": full_path
                }
            except Exception as e:
                file_status[filename] = {
                    "exists": False,
                    "error": str(e),
                    "path": full_path
                }
        
        # Check chunks
        chunks_info = {"total_chunks": 0, "existing_chunks": []}
        chunk_metadata = download_from_r2(f"{base_path}/chunks_metadata.json", silent_404=True)
        if chunk_metadata:
            try:
                metadata = json.loads(chunk_metadata)
                total_chunks = metadata.get("total_chunks", 0)
                chunks_info["total_chunks"] = total_chunks
                
                for i in range(1, total_chunks + 1):
                    chunk_content = download_from_r2(f"{base_path}/chunk_{i:03d}.txt", silent_404=True)
                    if chunk_content:
                        chunks_info["existing_chunks"].append(i)
            except Exception as e:
                chunks_info["error"] = str(e)
        
        return {
            "job_id": job_id,
            "user_directory": user.r2_directory,
            "base_path": base_path,
            "files": file_status,
            "chunks": chunks_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug failed: {str(e)}")

@app.get("/api/debug/user")
async def debug_user_info(user: AuthenticatedUser = Depends(get_current_user)):
    """Debug endpoint to check user authentication and directory."""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "r2_directory": user.r2_directory,
        "expected_path_format": f"{user.r2_directory}/{{job_id}}/{{filename}}"
    }

@app.get("/api/jobs/{job_id}/exists")
async def check_job_exists(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Quick check if a job exists and has any files."""
    try:
        # Check for the most basic file that should exist after extraction
        job_summary_path = f"{user.r2_directory}/{job_id}/job_summary.json"
        job_summary = download_from_r2_with_fallback(job_summary_path, job_id, "job_summary.json", silent_404=True)
        
        # Also check for chunks metadata
        chunks_metadata_path = f"{user.r2_directory}/{job_id}/chunks_metadata.json"
        chunks_metadata = download_from_r2_with_fallback(chunks_metadata_path, job_id, "chunks_metadata.json", silent_404=True)
        
        # Try to list some common alternative paths that might exist
        alternative_checks = []
        if not job_summary and not chunks_metadata:
            # Try some alternative user directory formats
            alt_user_dirs = [
                f"user_{user.user_id}",
                user.user_id,
                f"users/{user.user_id}",
                f"prod/{user.user_id}"
            ]
            
            for alt_dir in alt_user_dirs:
                alt_job_summary = download_from_r2(f"{alt_dir}/{job_id}/job_summary.json", silent_404=True)
                alt_chunks = download_from_r2(f"{alt_dir}/{job_id}/chunks_metadata.json", silent_404=True)
                alternative_checks.append({
                    "path": alt_dir,
                    "job_summary_exists": alt_job_summary is not None,
                    "chunks_metadata_exists": alt_chunks is not None
                })
        
        return {
            "job_id": job_id,
            "user_directory": user.r2_directory,
            "job_summary_exists": job_summary is not None,
            "chunks_metadata_exists": chunks_metadata is not None,
            "alternative_paths_checked": alternative_checks
        }
        
    except Exception as e:
        return {
            "job_id": job_id,
            "error": str(e),
            "user_directory": user.r2_directory
        }

@app.get("/api/packs")
async def list_packs(user: AuthenticatedUser = Depends(get_current_user)):
    """List all completed packs from Supabase for the authenticated user - redirects to V2."""
    # Simply redirect to the V2 endpoint which uses the unified view
    return await list_packs_v2(user)

# ============================================================================
# PACK V2 HELPER FUNCTIONS
# ============================================================================

async def process_conversation_url_for_pack(pack_id: str, source_id: str, url: str, platform: str, user: AuthenticatedUser):
    """Background task for extracting conversation from URL for Pack V2 sources."""
    try:
        print(f"🔗 Starting URL extraction for source {source_id} in pack {pack_id}")
        
        if not supabase:
            raise Exception("Database not configured")
        
        # Update source status to extracting
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "processing",  # align with DB constraint
            "progress_param": 10
        }).execute()
        
        # Import the appropriate extractor
        try:
            import sys
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            if current_dir not in sys.path:
                sys.path.append(current_dir)
            
            from chatgpt_extractor import extract_chatgpt_conversation
            extract_function = extract_chatgpt_conversation
                
        except ImportError as e:
            print("Could not import gpt extractor module")
            supabase.rpc("update_source_status", {"user_uuid": user.user_id,"target_source_id": source_id,"status_param": "failed","progress_param": 0,"error_message_param": error_msg}).execute()
            return
        
        # Update progress
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "processing",  # align with DB constraint
            "progress_param": 30
        }).execute()
        
        # Extract conversation
        try:
            timeout = 30
            print(f"Starting {platform} extraction with {timeout}s timeout...")
            result = extract_function(url, timeout=timeout)
            
            if not result or not result.get('messages'):
                error_msg = "No conversation found at the provided URL"
                print(f"❌ {error_msg}")
                supabase.rpc("update_source_status", {"target_source_id": source_id,"status_param": "failed","user_uuid": user.user_id,"progress_param": 0,"error_message_param": error_msg}).execute()
                return
                
        except Exception as e:
            error_msg = f"Failed to extract conversation: {str(e)}"
            print(f"❌ {error_msg}")
            supabase.rpc("update_source_status", {
                "user_uuid": user.user_id,
                "target_source_id": source_id,
                "status_param": "failed",
                "progress_param": 0,
                "error_message_param": error_msg
            }).execute()
            return
        
        message_count = len(result['messages'])
        print(f"✅ Extracted {message_count} messages from {platform} conversation")
        
        # Update progress
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "processing",  # align with DB constraint
            "progress_param": 70
        }).execute()
        
        # Convert to text format
        extracted_texts = []
        for message in result['messages']:
            formatted_message = f"[{message['role'].upper()}]: {message['content']}"
            extracted_texts.append(formatted_message)
        
        extracted_content = '\n\n'.join(extracted_texts)
        
        # Continue with chunking (just like file-based sources)
        print(f"Starting chunking for source {source_id}...")
        await extract_and_chunk_source(
            pack_id=pack_id,
            source_id=source_id,
            file_content=extracted_content,
            filename=f"{platform}_conversation.txt",
            user=user
        )


        
    except Exception as e:
        print(f"❌ Error processing URL for source {source_id}: {e}")
        traceback.print_exc()
        try:
            supabase.rpc("update_source_status", {
                "user_uuid": user.user_id,
                "target_source_id": source_id,
                "status_param": "failed",
                "progress_param": 0,
                "error_message_param": str(e)
            }).execute()
        except Exception as update_error:
            print(f"Failed to update source status: {update_error}")

# ============================================================================
# PACK V2 API ENDPOINTS (NotebookLM-style)
# ============================================================================

@app.post("/api/v2/packs")
async def create_pack_v2(request: CreatePackRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Create a new pack (container) - Step 1 of new workflow"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        pack_id = str(uuid.uuid4())
        custom_prompt = request.custom_system_prompt.strip() if request.custom_system_prompt else None
        if custom_prompt and len(custom_prompt) > 2000:
            custom_prompt = custom_prompt[:2000]
        # Ensure we always provide an R2 directory for the pack (column is NOT NULL)
        base_directory = (user.r2_directory or "").rstrip("/") or f"user_{user.user_id}"
        pack_directory = f"{base_directory}/{pack_id}"
        
        print(f"Creating new pack {pack_id} for user {user.email}")
        
        # Create pack in database
        result = supabase.rpc("create_pack_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id,
            "pack_name_param": request.pack_name,
            "pack_description": request.description,
            "custom_system_prompt_param": custom_prompt,
            "r2_pack_directory_param": pack_directory
        }).execute()
        
        if result.data and len(result.data) > 0:
            pack_data = result.data[0]
            print(f"✅ Pack created successfully: {pack_id}")
            return {
                "pack_id": pack_id,
                "pack_name": request.pack_name,
                "description": request.description,
                "custom_system_prompt": pack_data.get("custom_system_prompt"),
                "total_sources": 0,
                "total_tokens": 0,
                "created_at": pack_data.get("created_at"),
                "r2_pack_directory": pack_data.get("r2_pack_directory") or pack_directory,
                "status": "created"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create pack")
            
    except Exception as e:
        print(f"Error creating pack: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create pack: {str(e)}")

@app.get("/api/v2/packs")
async def list_packs_v2(user: AuthenticatedUser = Depends(get_current_user)):
    """List all v2 packs for user"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Use RPC function to get packs (bypasses RLS with SECURITY DEFINER)
        result = supabase.rpc("get_user_packs_v2", {
            "user_uuid": user.user_id
        }).execute()
        
        if not result.data:
            return []
        
        packs = []
        for pack in result.data:
            pack_data = {
                "pack_id": pack["pack_id"],
                "pack_name": pack["pack_name"],
                "description": pack.get("description"),
                "custom_system_prompt": pack.get("custom_system_prompt"),
                "total_sources": pack.get("total_sources", 0),
                "total_tokens": pack.get("total_tokens", 0),
                "created_at": pack["created_at"],
                "last_updated": pack.get("last_updated") or pack.get("updated_at"),
                "pack_version": "v2"
            }
            packs.append(pack_data)
        
        return packs
        
    except Exception as e:
        print(f"Error listing packs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list packs: {str(e)}")

@app.get("/api/v2/packs/{pack_id}")
async def get_pack_details_v2(pack_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get pack details with all sources"""
    try:
        if not supabase:
            raise HTTPException(status_code=404, detail="Database not configured")
        
        # Use RPC function to get pack details (bypasses RLS)
        result = supabase.rpc("get_pack_details_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        return result.data
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting pack details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pack: {str(e)}")

@app.patch("/api/v2/packs/{pack_id}")
async def update_pack_v2(pack_id: str, request: Request, user: AuthenticatedUser = Depends(get_current_user)):
    """Update pack metadata (name, description)"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Parse request body
        body = await request.json()
        pack_name = body.get("pack_name")
        description = body.get("description")
        custom_system_prompt = body.get("custom_system_prompt")
        
        if custom_system_prompt is not None:
            if not isinstance(custom_system_prompt, str):
                raise HTTPException(status_code=400, detail="custom_system_prompt must be a string")
            custom_system_prompt = custom_system_prompt.strip()
            if len(custom_system_prompt) > 2000:
                custom_system_prompt = custom_system_prompt[:2000]
        
        print(f"Updating pack {pack_id} for user {user.email}")
        
        if not pack_name and not description and custom_system_prompt is None:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update pack using RPC function (respects RLS policies)
        result = supabase.rpc("update_pack_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id,
            "pack_name_param": pack_name,
            "pack_description": description,
            "custom_system_prompt_param": custom_system_prompt
        }).execute()
        
        if result.data and len(result.data) > 0:
            print(f"✅ Pack updated successfully: {pack_id}")
            pack_data = result.data[0]
            return {
                "pack_id": pack_data["pack_id"],
                "pack_name": pack_data["pack_name"],
                "description": pack_data.get("description"),
                "custom_system_prompt": pack_data.get("custom_system_prompt"),
                "total_sources": pack_data["total_sources"],
                "total_tokens": pack_data["total_tokens"],
                "updated_at": pack_data["updated_at"]
            }
        else:
            raise HTTPException(status_code=404, detail="Pack not found or unauthorized")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating pack: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update pack: {str(e)}")

class PackSourceCreate(BaseModel):
    """Allow JSON payloads for creating pack sources when multipart isn't used"""
    url: Optional[str] = None
    source_name: Optional[str] = None
    source_type: Optional[str] = "chat_export"

@app.post("/api/v2/packs/{pack_id}/sources")
async def add_source_to_pack(
    pack_id: str, 
    file: UploadFile = File(None),  # Optional - either file OR url must be provided
    url: Optional[str] = Form(None),  # Optional - for shared conversation URLs
    source_name: Optional[str] = Form(None),
    source_type: Optional[str] = Form("chat_export"),
    payload: Optional[PackSourceCreate] = Body(None),  # Accept JSON for clients that can't send multipart
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Add a new source (file/chat export OR URL) to an existing pack"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")

        # Merge JSON payload values when request isn't multipart/form-data
        if payload:
            if not url:
                url = payload.url
            if not source_name:
                source_name = payload.source_name
            if not source_type and payload.source_type:
                source_type = payload.source_type
        
        # Normalize defaults
        source_type = source_type or "chat_export"
        
        if not source_name:
            source_name = file.filename if file else None
        if not source_name:
            raise HTTPException(status_code=400, detail="source_name is required")
        
        source_id = str(uuid.uuid4())
        
        print(f"Adding source {source_id} to pack {pack_id} for user {user.email}")
        
        # Handle URL-based sources (ChatGPT shared conversations)
        if url:
            # Normalize source type for DB constraint
            source_type = "url"
            # Detect platform from URL
            platform = 'ChatGPT'
            
            # Create source record in database with URL
            result = supabase.rpc("add_pack_source", {
                "user_uuid": user.user_id,
                "target_pack_id": pack_id,
                "target_source_id": source_id,
                "source_name_param": source_name,
                "source_type_param": source_type,  # Use allowed source type for constraint
                "file_name_param": url,  # Store URL in file_name field
                "file_size_param": 0
            }).execute()
            
            if not result.data or len(result.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create source record")
            
            # Start background URL extraction and chunking
            asyncio.create_task(
                process_conversation_url_for_pack(
                    pack_id=pack_id,
                    source_id=source_id,
                    url=url,
                    platform=platform,
                    user=user
                )
            )
            
            return {
                "pack_id": pack_id,
                "source_id": source_id,
                "source_name": source_name,
                "status": "extracting",
                "message": f"URL source added, extracting {platform} conversation"
            }
        
        # Handle file-based sources 
        else:
            # Read file content
            content = await file.read()
            file_size = len(content)
            
            # Handle different file types
            file_content_str = ""
            filename_lower = file.filename.lower()
            
            if filename_lower.endswith('.zip') and source_type == 'chat_export':
                # Extract chat export from ZIP
                try:
                    print("Zip file extraction")
                    file_content_str = extract_conversations_from_zip(content)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))
                
            elif filename_lower.endswith('.pdf'):
                # Extract text from PDF
                try:
                    print("PDF file extraction")
                    file_content_str = extract_text_from_pdf(content)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))
            else:
                # Plain text or other format
                file_content_str = content.decode('utf-8') if source_type == 'chat_export' else content.decode('utf-8', errors='ignore')
            
            # Create source record in database
            result = supabase.rpc("add_pack_source", {
                "user_uuid": user.user_id,
                "target_pack_id": pack_id,
                "target_source_id": source_id,
                "source_name_param": source_name,
                "source_type_param": source_type,
                "file_name_param": file.filename,
                "file_size_param": file_size
            }).execute()
            
            if not result.data or len(result.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create source record")
            
            # Start background extraction and chunking (NO analysis yet, NO credit deduction)
            asyncio.create_task(
                extract_and_chunk_source(
                    pack_id=pack_id,
                    source_id=source_id,
                    file_content=file_content_str,
                    filename=file.filename,
                    user=user
                )
            )
            
            return {
                "pack_id": pack_id,
                "source_id": source_id,
                "source_name": source_name,
                "status": "extracting",
                "message": "Source added, extraction and chunking started"
            }
        
    except Exception as e:
        print(f"Error adding source to pack: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add source: {str(e)}")

@app.delete("/api/v2/packs/{pack_id}")
async def delete_pack(
    pack_id: str, 
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete a pack and all its sources"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        print(f"Deleting pack {pack_id} for user {user.email}")
        
        # Delete all R2 files for this pack (user_id/pack_id/)
        r2_prefix = f"{user.r2_directory}/{pack_id}/"
        delete_r2_directory(r2_prefix)
        
        # Use RPC function to delete pack from database (bypasses RLS)
        result = supabase.rpc("delete_pack_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id
        }).execute()
        
        if result.data:
            print(f"✅ Pack {pack_id} deleted successfully from database and R2")
            return {"success": True, "message": "Pack deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Pack not found or unauthorized")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting pack: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete pack: {str(e)}")

@app.get("/api/v2/sources/{source_id}/status")
async def get_source_status(
    source_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get processing status for a source"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Use RPC function to get source status (bypasses RLS)
        result = supabase.rpc("get_source_status_v2", {
            "user_uuid": user.user_id,
            "target_source_id": source_id
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Source not found")
        
        source = result.data
        
        return {
            "source_id": source["source_id"],
            "pack_id": source["pack_id"],
            "status": source["status"],
            "progress": source.get("progress", 0),
            "error_message": source.get("error_message"),
            "total_chunks": source.get("total_chunks", 0),
            "extracted_count": source.get("extracted_count", 0),
            "total_input_tokens": source.get("total_input_tokens", 0),
            "total_output_tokens": source.get("total_output_tokens", 0),
            "completed_at": source.get("completed_at")
        }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting source status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get source status: {str(e)}")

@app.delete("/api/v2/packs/{pack_id}/sources/{source_id}")
async def delete_source_from_pack(
    pack_id: str, 
    source_id: str, 
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Remove a source from a pack"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    print(f"Deleting source {source_id} from pack {pack_id}")
    
    # Delete R2 files for this source (user_id/pack_id/source_id/)
    r2_prefix = f"{user.r2_directory}/{pack_id}/{source_id}/"
    delete_r2_directory(r2_prefix)
    
    # Delete from database using RPC function (bypasses RLS, same as pack deletion)
    try:
        print(f"Attempting database delete for source {source_id}")
        
        # Use RPC function to delete source (bypasses RLS, just like delete_pack_v2)
        result = supabase.rpc("delete_pack_source", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id,
            "target_source_id": source_id
        }).execute()
        
        if result.data:
            print(f"✅ Source {source_id} deleted from database successfully")
        else:
            print(f"⚠️ Database delete returned False (source may not exist)")
            
    except Exception as db_error:
        print(f"⚠️ Database delete failed: {db_error}")
    
    # Always return success - the source is gone from R2 and UI will be updated
    return {"success": True, "message": "Source deleted successfully"}

@app.get("/api/v2/sources/{source_id}/credit-check")
async def check_source_credits(
    source_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Check if user has enough credits to analyze this source"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Get source status to find chunk count
        result = supabase.rpc("get_source_status_v2", {
            "user_uuid": user.user_id,
            "target_source_id": source_id
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Source not found")
        
        source = result.data
        total_chunks = source.get("total_chunks", 0)
        
        if total_chunks == 0:
            raise HTTPException(status_code=400, detail="Source not yet chunked")
        
        # Get user's current credits and payment plan
        user_result = supabase.table("user_profiles").select("credits_balance, payment_plan").eq("id", user.user_id).single().execute()
        user_credits = user_result.data.get("credits_balance", 0) if user_result.data else 0
        payment_plan = user_result.data.get("payment_plan", "credits") if user_result.data else "credits"
        
        # Check if user has unlimited plan
        has_unlimited = payment_plan == "unlimited"
        
        credit_check_result = {
            "sourceId": source_id,
            "totalChunks": total_chunks,
            "creditsRequired": total_chunks,
            "userCredits": user_credits,
            "hasUnlimited": has_unlimited,
            "canProceed": has_unlimited or user_credits >= total_chunks,
            "needsPurchase": not has_unlimited and user_credits < total_chunks,
            "creditsNeeded": max(0, total_chunks - user_credits) if not has_unlimited else 0
        }

        
        return credit_check_result
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking source credits: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check credits: {str(e)}")

@app.post("/api/v2/sources/{source_id}/start-analysis")
async def start_source_analysis(
    source_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Start analysis after user confirms they have enough credits (supports partial analysis)"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Parse request body for max_chunks parameter
        body = await request.json() if request.headers.get('content-type') == 'application/json' else {}
        max_chunks = body.get("max_chunks")  # Optional: limit analysis to specific number of chunks
        
        # Get source info
        result = supabase.rpc("get_source_status_v2", {
            "user_uuid": user.user_id,
            "target_source_id": source_id
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Source not found")
        
        source = result.data
        pack_id = source["pack_id"]
        status = source["status"]
        total_chunks = source.get("total_chunks", 0)
        
        # Validate source is ready
        if status != "ready_for_analysis":
            raise HTTPException(status_code=400, detail=f"Source not ready for analysis (status: {status})")
        
        # Check credits one more time and get payment plan
        user_result = supabase.table("user_profiles").select("credits_balance, payment_plan").eq("id", user.user_id).single().execute()
        user_credits = user_result.data.get("credits_balance", 0) if user_result.data else 0
        payment_plan = user_result.data.get("payment_plan", "credits") if user_result.data else "credits"
        
        # Check unlimited plan
        has_unlimited = payment_plan == "unlimited"
        
        # Determine how many chunks to analyze
        chunks_to_analyze = total_chunks
        if max_chunks is not None:
            chunks_to_analyze = min(max_chunks, total_chunks)
        
        # For non-unlimited users, check if they have any credits
        if not has_unlimited:
            if user_credits <= 0:
                raise HTTPException(
                    status_code=402, 
                    detail="No credits available. Purchase credits to analyze."
                )
            # Limit to available credits
            chunks_to_analyze = min(chunks_to_analyze, user_credits)
        
        # Get filename from source data (already fetched above via RPC)
        filename = source.get("file_name", "unknown")
        custom_system_prompt = None
        try:
            pack_settings = supabase.table("packs_v2").select("custom_system_prompt").eq("pack_id", pack_id).eq("user_id", user.user_id).single().execute()
            if pack_settings.data:
                custom_system_prompt = pack_settings.data.get("custom_system_prompt")
        except Exception as pack_settings_error:
            print(f"⚠️ Could not load custom system prompt for pack {pack_id}: {pack_settings_error}")
        
        print(f"🚀 Starting analysis: {chunks_to_analyze} of {total_chunks} chunks")
        
        # Update status to analyzing IMMEDIATELY so frontend sees it right away
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "analyzing",
            "progress_param": 5
        }).execute()
        
        # Start background analysis
        asyncio.create_task(
            analyze_source_chunks(
                pack_id=pack_id,
                source_id=source_id,
                filename=filename,
                user=user,
                max_chunks=chunks_to_analyze,
                custom_system_prompt=custom_system_prompt
            )
        )
        
        return {
            "source_id": source_id,
            "pack_id": pack_id,
            "status": "analyzing",
            "message": f"Analysis started for {chunks_to_analyze} of {total_chunks} chunks",
            "total_chunks": total_chunks,
            "analyzing_chunks": chunks_to_analyze
        }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starting source analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")

@app.post("/api/v2/sources/{source_id}/cancel")
async def cancel_source_analysis(
    source_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Cancel a running source analysis"""
    try:
        # Add to cancelled jobs set (this stops the analysis loop)
        cancelled_jobs.add(source_id)
        
        print(f"🚫 Source {source_id} cancellation requested by user {user.user_id}")
        
        # The analysis loop will detect cancellation and update the database status
        # We don't need to update it here - just adding to cancelled_jobs is enough
        
        return {
            "source_id": source_id,
            "status": "cancelling",
            "message": "Cancellation requested. Analysis will stop shortly. If 10+ chunks were processed, credits were deducted."
        }
        
    except Exception as e:
        print(f"Error cancelling source analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel analysis: {str(e)}")

@app.get("/api/v2/packs/{pack_id}/download/zip")
async def download_pack_zip_v2(pack_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download complete pack as ZIP with all sources"""
    import zipfile
    import tempfile
    
    try:
        # Get pack details with sources
        result = supabase.rpc("get_pack_details_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        pack_data = result.data.get("pack", {})
        sources = result.data.get("sources", [])
        
        print(f"Creating ZIP for pack {pack_id} with {len(sources)} sources")
        
        # Create temp ZIP file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                files_added = 0
                
                # Add each source's files
                for source in sources:
                    source_id = source.get("source_id")
                    source_name = source.get("source_name", "unknown")
                    status = source.get("status", "unknown")
                    
                    print(f"Processing source {source_id} ({source_name}) - status: {status}")
                    
                    # Add extracted text if available
                    extracted_path = f"{user.r2_directory}/{pack_id}/{source_id}/extracted.txt"
                    try:
                        extracted_content = download_from_r2(extracted_path)
                        if extracted_content:
                            zipf.writestr(f"sources/{source_name}/extracted.txt", extracted_content)
                            files_added += 1
                            print(f"✅ Added extracted.txt for {source_name}")
                        else:
                            print(f"⚠️ No extracted content for {source_name}")
                    except Exception as e:
                        print(f"❌ Error downloading extracted.txt for {source_name}: {e}")
                    
                    # Add analyzed content if completed
                    if status == "completed":
                        analyzed_path = f"{user.r2_directory}/{pack_id}/{source_id}/analyzed.txt"
                        try:
                            analyzed_content = download_from_r2(analyzed_path)
                            if analyzed_content:
                                zipf.writestr(f"sources/{source_name}/analyzed.txt", analyzed_content)
                                files_added += 1
                                print(f"✅ Added analyzed.txt for {source_name}")
                            else:
                                print(f"⚠️ No analyzed content for {source_name}")
                        except Exception as e:
                            print(f"❌ Error downloading analyzed.txt for {source_name}: {e}")
                    
                    # Add chunked data if available
                    chunked_path = f"{user.r2_directory}/{pack_id}/{source_id}/chunked.json"
                    try:
                        chunked_content = download_from_r2(chunked_path)
                        if chunked_content:
                            zipf.writestr(f"sources/{source_name}/chunked.json", chunked_content)
                            files_added += 1
                            print(f"✅ Added chunked.json for {source_name}")
                        else:
                            print(f"⚠️ No chunked content for {source_name}")
                    except Exception as e:
                        print(f"❌ Error downloading chunked.json for {source_name}: {e}")
                
                # Add pack metadata
                pack_info = {
                    "pack_id": pack_id,
                    "pack_name": pack_data.get("pack_name"),
                    "description": pack_data.get("description"),
                    "total_sources": len(sources),
                    "sources": [
                        {
                            "source_id": s.get("source_id"),
                            "source_name": s.get("source_name"),
                            "status": s.get("status"),
                            "created_at": s.get("created_at")
                        }
                        for s in sources
                    ]
                }
                zipf.writestr("pack_info.json", json.dumps(pack_info, indent=2))
                files_added += 1
                
                print(f"Total files added to ZIP: {files_added}")
                
                if files_added == 1:  # Only pack_info
                    raise HTTPException(status_code=404, detail="No source files found in pack. Sources may still be processing.")
        
        # Read and return ZIP
        with open(temp_zip.name, 'rb') as f:
            zip_data = f.read()
        
        os.unlink(temp_zip.name)
        
        return StreamingResponse(
            io.BytesIO(zip_data),
            media_type='application/zip',
            headers={"Content-Disposition": f"attachment; filename=pack_{pack_data.get('pack_name', pack_id)}.zip"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating pack ZIP: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP: {str(e)}")

@app.get("/api/v2/packs/{pack_id}/export/{export_type}")
async def download_pack_export_v2(
    pack_id: str, 
    export_type: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Download a pack export (compact/standard/complete)"""
    try:
        if export_type not in ['compact', 'standard', 'complete']:
            raise HTTPException(status_code=400, detail="Invalid export type")
        
        # Check if it's a v2 pack or legacy
        pack_result = supabase.rpc("get_pack_details", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id
        }).execute()
        
        if not pack_result.data:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        pack_data = pack_result.data
        
        # For legacy packs that were auto-migrated, use old download paths
        if pack_data.get("migrated_from_legacy"):
            # Use the old download endpoint logic
            if export_type == 'compact':
                return await download_ultra_compact_ucp(pack_id, user)
            elif export_type == 'standard':
                return await download_standard_ucp(pack_id, user)
            else:
                return await download_complete_ucp(pack_id, user)
        
        # For v2 packs, combine all sources
        sources = pack_data.get("sources", [])
        
        # Combine all analyzed content from sources
        combined_content = []
        for source in sources:
            if source["status"] == "completed":
                # Download analyzed content from R2
                analyzed_path = source.get("r2_analyzed_path")
                if analyzed_path:
                    content = download_from_r2(analyzed_path)
                    if content:
                        combined_content.append(f"=== Source: {source['source_name']} ===\n\n{content}\n\n")
        
        # Generate export based on type
        if export_type == "compact":
            full_text = "\n".join(combined_content)
            export_content = full_text
        elif export_type == "standard":
            export_content = "\n".join(combined_content)
        else:  # complete
            export_content = "\n".join(combined_content)
        
        # Return as downloadable file
        return StreamingResponse(
            iter([export_content.encode('utf-8')]),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={export_type}_pack_{pack_id}.txt"
            }
        )
        
    except Exception as e:
        print(f"Error downloading pack export: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download export: {str(e)}")

@app.get("/api/test-packs")
async def test_packs():
    """Test packs table connection"""
    try:
        if not supabase:
            return {"error": "Supabase not configured"}
        
        # Try to query the packs table
        result = supabase.table("packs").select("*").limit(5).execute()
        return {"success": True, "packs_count": len(result.data), "sample_packs": result.data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/test-create-pack/{job_id}")
async def test_create_pack(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Test creating a pack for an existing job with full logging"""
    print(f"🧪 TESTING PACK CREATION FOR JOB: {job_id}")
    
    try:
        # First, let's create the job if it doesn't exist

        job_record = await create_job_in_db(
            user=user,
            job_id=job_id,
            file_name="test_file.txt",
            file_size=1000,
            status="completed"
        )
        
        if job_record:
            pass
        
        # Now try to create the pack
        pack_record = await create_pack_in_db(
            user=user,
            job_id=job_id,
            pack_name=f"Test Pack {job_id[:8]}",
            r2_pack_path=f"{user.r2_directory}/{job_id}/",
            extraction_stats={"test": True},
            analysis_stats={"test": True}
        )
        
        return {
            "success": pack_record is not None,
            "job_record": job_record,
            "pack_record": pack_record,
            "message": "Check backend logs for detailed output"
        }
        
    except Exception as e:

        return {"error": str(e)}

@app.get("/api/debug-jobs")
async def debug_jobs(user: AuthenticatedUser = Depends(get_current_user)):
    """Debug: List all jobs for the current user"""
    if not supabase:
        return {"error": "Supabase not available"}
    
    try:
        result = supabase.table("jobs").select("*").eq("user_id", user.user_id).execute()
        return {
            "user_id": user.user_id,
            "jobs_count": len(result.data),
            "jobs": result.data
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/test-auth")
async def test_auth(request: Request):
    """Test authentication with JWT token - shows token details"""
    try:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return {"error": "No authorization header found"}
        
        if not auth_header.startswith("Bearer "):
            return {"error": "Invalid authorization header format"}
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Try to decode the token properly with verification
        try:
            if not SUPABASE_JWT_SECRET:
                return {"error": "JWT secret not configured"}
            
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                options={"verify_signature": True}
            )
            
            return {
                "token_received": True,
                "token_length": len(token),
                "token_preview": token[:20] + "...",
                "payload_preview": {
                    "sub": payload.get("sub"),
                    "email": payload.get("email"),
                    "aud": payload.get("aud"),
                    "iss": payload.get("iss"),
                    "exp": payload.get("exp")
                }
            }
        except Exception as decode_error:
            return {
                "token_received": True,
                "token_length": len(token),
                "decode_error": str(decode_error)
            }
            
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/test-auth-full")
async def test_auth_full(user: AuthenticatedUser = Depends(get_current_user)):
    """Test authentication with full validation"""
    try:
        return {
            "success": True,
            "user_id": user.user_id,
            "email": user.email,
            "r2_directory": user.r2_directory,
            "message": "Authentication successful"
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/manual-migrate")
async def manual_migrate():
    """Manually create job and pack records for known job - TEMPORARY"""
    try:
        if not supabase:
            return {"error": "Supabase not configured"}
        
        # Manually create records for the known job from the screenshot
        job_id = "a2a6249-81d2-44ba-bd90-3414c6516fb5"
        user_id = "0b39c68a-46b3-4d99-b5bb-0c8525fdc4cc"
        
        # First, create the job record in the jobs table
        job_data = {
            "job_id": job_id,
            "user_id": user_id,
            "file_name": "migrated_data.json",  # Add required file_name field
            "file_size": 1024,  # Add required file_size field (estimated)
            "r2_path": f"user_{user_id}/{job_id}/",  # Add required r2_path field
            "status": "completed",
            "progress": 100,
            "completed_at": "2025-08-14T22:00:00.000Z"
        }
        
        # Check if job already exists
        existing_job = supabase.table("jobs").select("*").eq("job_id", job_id).execute()
        
        if not existing_job.data:
            # Create job record
            job_result = supabase.table("jobs").insert(job_data).execute()
            if not job_result.data:
                return {"error": "Failed to create job record", "job_result": job_result}
        
        # Now create the pack record
        pack_data = {
            "user_id": user_id,
            "job_id": job_id,
            "pack_name": f"UCP Pack {job_id[:8]}",
            "r2_pack_path": f"user_{user_id}/{job_id}/",
            "extraction_stats": {
                "total_chunks": 2,  # Updated to match new free plan limit
                "processed_chunks": 2,
                "failed_chunks": 0
            },
            "analysis_stats": {
                "total_input_tokens": 0,  # We'll update these later when R2 access is fixed
                "total_output_tokens": 0,
                "total_cost": 0.0,
                "completed_at": "2025-08-14T22:00:00.000Z"
            }
        }
        
        # Check if pack already exists
        existing_pack = supabase.table("packs").select("*").eq("job_id", job_id).execute()
        
        if existing_pack.data:
            return {
                "success": True,
                "message": "Pack record already exists in Supabase",
                "job_id": job_id,
                "existing_pack": existing_pack.data[0]
            }
        
        # Insert pack record
        pack_result = supabase.table("packs").insert(pack_data).execute()
        
        if pack_result.data:
            return {
                "success": True,
                "message": "Successfully created job and pack records in Supabase",
                "job_id": job_id,
                "job_record": existing_job.data[0] if existing_job.data else job_result.data[0],
                "pack_record": pack_result.data[0]
            }
        else:
            return {"error": "Failed to insert pack into Supabase", "pack_result": pack_result}
            
    except Exception as e:
        return {"error": f"Manual migration failed: {str(e)}"}

@app.get("/api/migrate-r2-to-supabase")
async def migrate_r2_to_supabase():
    """Migrate existing R2 data to Supabase - TEMPORARY MIGRATION ENDPOINT"""
    try:
        if not supabase:
            return {"error": "Supabase not configured"}
        
        # Manually create pack records for the known job
        job_id = "a2a6249-81d2-44ba-bd90-3414c6516fb5"
        user_id = "0b39c68a-46b3-4d99-b5bb-0c8525fdc4cc"  # From the R2 path
        
        # Try to download the summary.json file directly
        summary_path = f"user_{user_id}/{job_id}/summary.json"
        print(f"Attempting to download: {summary_path}")
        
        try:
            summary_content = download_from_r2(summary_path)
            if summary_content:
                summary = json.loads(summary_content)
                print(f"Successfully downloaded summary: {summary}")
                
                # Create pack record in Supabase
                pack_data = {
                    "user_id": user_id,
                    "job_id": job_id,
                    "pack_name": f"UCP Pack {job_id[:8]}",
                    "r2_pack_path": f"user_{user_id}/{job_id}/",
                    "extraction_stats": {
                        "total_chunks": summary.get("total_chunks", 0),
                        "processed_chunks": summary.get("processed_chunks", 0),
                        "failed_chunks": summary.get("failed_chunks", 0)
                    },
                    "analysis_stats": {
                        "total_input_tokens": summary.get("total_input_tokens", 0),
                        "total_output_tokens": summary.get("total_output_tokens", 0),
                        "total_cost": summary.get("total_cost", 0),
                        "completed_at": summary.get("completed_at")
                    }
                }
                
                result = supabase.table("packs").insert(pack_data).execute()
                
                if result.data:
                    return {
                        "success": True,
                        "message": "Successfully migrated job to Supabase",
                        "job_id": job_id,
                        "pack_record": result.data[0]
                    }
                else:
                    return {"error": "Failed to insert into Supabase", "supabase_result": result}
                    
            else:
                return {"error": f"Could not download summary file from: {summary_path}"}
                
        except Exception as e:
            return {"error": f"Error processing summary: {str(e)}"}
            
    except Exception as e:
        return {"error": f"Migration failed: {str(e)}"}

@app.get("/api/test-jobs")
async def test_list_jobs():
    """Test endpoint to list jobs without authentication - TEMPORARY"""
    try:
        # First, let's try to list ALL objects to see what's in R2
        print("Listing all R2 objects...")
        all_objects = list_r2_objects("")
        print(f"Found {len(all_objects)} total objects in R2")
        
        # Look for any objects containing the job ID we see in the screenshot
        job_id = "a2a6249-81d2-44ba-bd90-3414c6516fb5"
        matching_objects = [obj for obj in all_objects if job_id in obj]
        print(f"Objects containing job ID {job_id}: {matching_objects}")
        
        # Look for any user directory objects
        user_objects = [obj for obj in all_objects if "user_" in obj]
        print(f"User directory objects: {user_objects[:10]}")  # Show first 10
        
        # Now try with the specific user directory
        test_user_directory = "user_0b39c68a-46b3-4d99-b5bb-0c8525fdc4cc"
        print(f"Attempting to list R2 objects for directory: {test_user_directory}")
        
        jobs = []
        
        # List all objects in the test user's R2 directory
        user_keys = list_r2_objects(f"{test_user_directory}/")
        print(f"Found {len(user_keys)} objects in user directory")
        
        # List all summary files in the test user's R2 directory
        summary_keys = [key for key in user_keys if key.endswith("/summary.json")]
        print(f"Found {len(summary_keys)} summary files: {summary_keys}")
        
        for summary_key in summary_keys:
            try:
                print(f"Processing summary: {summary_key}")
                summary_content = download_from_r2(summary_key)
                if summary_content:
                    summary = json.loads(summary_content)
                    jobs.append({
                        "job_id": summary["job_id"],
                        "status": "completed",
                        "created_at": summary["completed_at"],
                        "stats": {
                            "total_chunks": summary["total_chunks"],
                            "total_input_tokens": summary["total_input_tokens"],
                            "total_output_tokens": summary["total_output_tokens"],
                            "total_cost": summary["total_cost"]
                        }
                    })
                    print(f"Successfully processed job: {summary['job_id']}")
                else:
                    print(f"Failed to download content for: {summary_key}")
            except Exception as e:
                print(f"Error processing summary {summary_key}: {e}")
                continue
        
        print(f"Returning {len(jobs)} jobs")
        return {
            "debug": {
                "total_r2_objects": len(all_objects), 
                "matching_job_objects": len(matching_objects),
                "user_objects_sample": user_objects[:5],
                "user_directory_objects": len(user_keys),
                "summary_files": len(summary_keys)
            }, 
            "jobs": jobs
        }
    except Exception as e:
        print(f"Error in test_list_jobs: {e}")
        return {"error": str(e), "jobs": []}

@app.get("/api/jobs")
async def list_jobs(user: AuthenticatedUser = Depends(get_current_user)):
    """List all completed jobs from R2 for the authenticated user."""
    try:
        jobs = []
        
        # List all summary files in user's R2 directory
        summary_keys = [key for key in list_r2_objects(f"{user.r2_directory}/") if key.endswith("/summary.json")]
        
        for summary_key in summary_keys:
            try:
                summary_content = download_from_r2(summary_key)
                if summary_content:
                    summary = json.loads(summary_content)
                    jobs.append({
                        "job_id": summary["job_id"],
                        "status": "completed",
                        "created_at": summary["completed_at"],
                        "stats": {
                            "total_chunks": summary["total_chunks"],
                            "total_input_tokens": summary["total_input_tokens"],
                            "total_output_tokens": summary["total_output_tokens"],
                            "total_cost": summary["total_cost"]
                        }
                    })
            except Exception as e:
                print(f"Error processing summary {summary_key}: {e}")
                continue
        
        # Sort jobs by created_at date, most recent first
        jobs.sort(key=lambda x: x["created_at"], reverse=True)
        
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")

# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

@app.get("/api/profile/quick")
async def get_user_profile_quick(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Ultra-fast profile endpoint for auth checks during analysis - minimal data only"""
    try:
        return {
            "profile": {
                "user_id": current_user.user_id,
                "email": current_user.email,
                "r2_user_directory": current_user.r2_directory,
                "authenticated": True,
                "analysis_in_progress": len(job_progress) > 0
            },
            "timestamp": time.time()
        }
    except Exception as e:
        print(f"❌ Quick profile endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Quick profile check failed")

@app.get("/api/profile")
async def get_user_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Get the current user's profile information including payment status and packs - with timeout protection and analysis-aware optimizations"""
    try:
        # Add timeout protection to prevent hanging
        profile_start_time = time.time()
        
        if not supabase:
            # Legacy mode - return basic info quickly
            return {
                "profile": {
                    "user_id": current_user.user_id,
                    "email": current_user.email,
                    "r2_user_directory": current_user.r2_directory,
                    "plan": "legacy",
                    "chunks_used": 0,
                    "chunks_allowed": 999,
                    "can_process": True
                },
                "packs": [],
                "jobs": []
            }
        
        # During heavy analysis periods, return a lighter profile response
        is_analysis_period = len(job_progress) > 0  # Check if any analysis is running
        
        # Get user profile with shorter timeout during analysis
        profile_timeout = 5 if is_analysis_period else 15
        try:
            profile_result = supabase.table('user_profiles').select('*').eq('id', current_user.user_id).limit(1).execute()
            
            if not profile_result.data:
                # Create profile if it doesn't exist - but keep it simple
                profile_data = {
                    "user_id": current_user.user_id,
                    "email": current_user.email,
                    "r2_user_directory": current_user.r2_directory,
                    "plan": "free",
                    "chunks_used": 0,
                    "chunks_allowed": get_new_user_credits(),
                    "can_process": True
                }
            else:
                profile_data = profile_result.data[0]
        except Exception as e:
            print(f"⚠️ Profile query timeout or error: {e}")
            # Return basic data instead of failing
            profile_data = {
                "user_id": current_user.user_id,
                "email": current_user.email,
                "r2_user_directory": current_user.r2_directory,
                "plan": "free",
                "chunks_used": 0,
                "chunks_allowed": get_new_user_credits(),
                "can_process": True,
                "warning": "Profile loaded with fallback data"
            }
        
        # Get payment status quickly
        try:
            payment_status = await get_user_payment_status(current_user.user_id)
        except Exception as e:
            print(f"⚠️ Payment status query timeout: {e}")
            payment_status = {"plan": "free", "chunks_used": 0, "chunks_allowed": get_new_user_credits(), "can_process": True}
        
        # During analysis, skip or limit the heavy queries
        packs = []
        jobs = []
        
        if not is_analysis_period:
            # Get packs with timeout and limit (only when not analyzing)
            try:
                # Use a quick query with limit to prevent hanging
                packs_result = supabase.table('packs').select('*').eq('user_id', current_user.user_id).order('created_at', desc=True).limit(5).execute()
                packs = packs_result.data if packs_result.data else []
            except Exception as e:
                print(f"⚠️ Packs query timeout: {e}")
                packs = []
            
            # Get recent jobs with timeout and limit (only when not analyzing)
            try:
                jobs_result = supabase.table('jobs').select('*').eq('user_id', current_user.user_id).order('created_at', desc=True).limit(5).execute()
                jobs = jobs_result.data if jobs_result.data else []
            except Exception as e:
                print(f"⚠️ Jobs query timeout: {e}")
                jobs = []
        else:
            # During analysis, just return empty arrays to speed up response
            print(f"🔄 Analysis in progress, returning minimal profile data")
        
        profile_load_time = time.time() - profile_start_time
        print(f"✅ Profile loaded in {profile_load_time:.2f}s (analysis_mode: {is_analysis_period})")
        
        return {
            "profile": {
                **profile_data,
                **payment_status,
                "analysis_in_progress": is_analysis_period
            },
            "packs": packs,
            "jobs": jobs,
            "load_time": round(profile_load_time, 2)
        }
            
    except Exception as e:
        print(f"❌ Profile endpoint error: {e}")
        # Always return something instead of failing
        return {
            "profile": {
                "user_id": current_user.user_id,
                "email": current_user.email,
                "r2_user_directory": current_user.r2_directory,
                "plan": "free",
                "chunks_used": 0,
                "chunks_allowed": get_new_user_credits(),
                "can_process": True,
                "error": f"Profile load error: {str(e)}"
            },
            "packs": [],
            "jobs": []
        }

# ================================
# STRIPE PAYMENT ENDPOINTS
# ================================

@app.post("/api/create-payment-intent")
async def create_payment_intent(
    request: StripePaymentIntentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a Stripe PaymentIntent for credit purchase"""
    
    try:
        # Rate limiting: max 5 payment intents per hour per user
        can_proceed, attempt_count = check_rate_limit(user.user_id, "payment", max_attempts=5, window_hours=1)
        
        if not can_proceed:
            raise HTTPException(
                status_code=429, 
                detail=f"Too many payment attempts. You can create up to 5 payment intents per hour. Try again later."
            )
        
        # Validate the amount matches our pricing
        expected_amount = calculate_credit_price(request.credits)
        
        if abs(request.amount - expected_amount) > 0.01:  # Allow for small rounding differences
            raise HTTPException(
                status_code=400, 
                detail=f"Amount mismatch. Expected ${expected_amount}, got ${request.amount}"
            )
        
        print(f"✅ Amount validation passed")
        
        # Create payment intent with Stripe
        print(f"📡 Creating Stripe payment intent...")
        intent = stripe.PaymentIntent.create(
            amount=int(request.amount * 100),  # Stripe uses cents
            currency='usd',
            payment_method_types=['card'],  # Specify payment method types
            metadata={
                'user_id': user.user_id,
                'credits': request.credits,
                'email': user.email
            },
            description=f"Purchase {request.credits} credits for Universal Context Pack"
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create payment intent")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create payment intent")

@app.post("/api/create-checkout-session")
async def create_checkout_session(
    request: StripePaymentIntentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a Stripe Checkout Session for credit purchase (hosted payment page)"""
    
    try:
        # Rate limiting: max 5 checkout sessions per hour per user
        can_proceed, attempt_count = check_rate_limit(user.user_id, "checkout", max_attempts=5, window_hours=1)
        
        if not can_proceed:
            raise HTTPException(
                status_code=429, 
                detail=f"Too many checkout attempts. You can create up to 5 checkout sessions per hour. Try again later."
            )
        
        # Validate the amount matches our pricing
        if request.unlimited:
            expected_amount = 4.99  # Updated to match frontend pricing
            if abs(request.amount - expected_amount) > 0.01:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Amount mismatch for unlimited plan. Expected $4.99, got ${request.amount}"
                )
        else:
            expected_amount = calculate_credit_price(request.credits)
            if abs(request.amount - expected_amount) > 0.01:  # Allow for small rounding differences
                raise HTTPException(
                    status_code=400, 
                    detail=f"Amount mismatch. Expected ${expected_amount}, got ${request.amount}"
                )
        
        # Get the frontend URL for success/cancel redirects
        frontend_url = os.getenv("FRONTEND_URL", "https://www.context-pack.com")
        
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Unlimited Access' if request.unlimited else f'{request.credits} Analysis Credits',
                        'description': 'Lifetime unlimited access to Universal Context Pack analysis' if request.unlimited else f'Credits for Universal Context Pack analysis (1 credit = 1 conversation chunk ~150k tokens)',
                    },
                    'unit_amount': int(request.amount * 100),  # Convert to cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/process?payment_success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/process?payment_cancelled=true",
            metadata={
                'user_id': user.user_id,
                'credits': request.credits,
                'email': user.email,
                'unlimited': str(request.unlimited)
            },
            payment_intent_data={
                'metadata': {
                    'user_id': user.user_id,
                    'credits': request.credits,
                    'email': user.email,
                    'unlimited': str(request.unlimited)
                }
            },
            customer_email=user.email,
            # Add automatic tax calculation if needed
            # automatic_tax={'enabled': True},
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

class PaymentValidationRequest(BaseModel):
    credits: int
    amount: float

@app.post("/api/payment/validate-amount")
async def validate_payment_amount(request: PaymentValidationRequest):
    """Validate payment amount matches expected price"""
    try:
        if request.credits <= 0:
            raise HTTPException(status_code=400, detail="Credits must be greater than 0")
        
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        
        expected_amount = calculate_credit_price(request.credits)
        
        # Allow 1 cent difference for rounding
        if abs(request.amount - expected_amount) > 0.01:
            raise HTTPException(
                status_code=400, 
                detail=f"Payment amount mismatch. Expected: ${expected_amount}, Received: ${request.amount}"
            )
        
        return {
            "valid": True, 
            "expected_amount": expected_amount,
            "client_amount": request.amount,
            "credits": request.credits
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

class ManualCreditRequest(BaseModel):
    credits: int
    amount: float
    paymentIntentId: str

class StripeSessionRequest(BaseModel):
    session_id: str

@app.post("/api/process-stripe-session")
async def process_stripe_session(
    request: StripeSessionRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Manually process a Stripe session for credit addition (fallback for webhook issues)"""
    try:
        print(f"🔄 Manual Stripe session processing for user {user.email}")
        print(f"Session ID: {request.session_id}")
        
        # Retrieve the session from Stripe
        session = stripe.checkout.Session.retrieve(request.session_id)
        
        print(f"📊 Session status: {session.status}")
        print(f"📊 Payment status: {session.payment_status}")
        print(f"📊 Session metadata: {session.metadata}")
        
        # Verify this session belongs to the current user
        if session.metadata.get('user_id') != user.user_id:
            raise HTTPException(status_code=403, detail="Session does not belong to current user")
        
        # Check if payment was successful
        if session.payment_status != 'paid':
            raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {session.payment_status}")
        
        # Extract metadata
        credits = int(session.metadata.get('credits', 0))
        unlimited = session.metadata.get('unlimited', 'False').lower() == 'true'
        amount = session.amount_total / 100 if session.amount_total else 0
        
        # Check if this session was already processed
        existing = supabase.table("credit_transactions").select("id").eq("stripe_payment_id", session.id).execute()
        if existing.data:
            return {
                "success": True,
                "message": "Credits already added for this payment",
                "already_processed": True
            }
        
        # Process the payment
        if unlimited:
            await grant_unlimited_access(user.user_id, amount, session.id)
            print(f"✅ Manually granted unlimited access to user {user.email}")
            return {
                "success": True,
                "message": "Unlimited access granted to your account"
            }
        elif credits > 0:
            await add_credits_to_user(user.user_id, credits, amount, session.id)
            print(f"✅ Manually added {credits} credits to user {user.email}")
            return {
                "success": True,
                "message": f"Added {credits} credits to your account"
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid session data")
        
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error in manual session processing: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        print(f"❌ Error in manual session processing: {e}")
        raise HTTPException(status_code=500, detail="Failed to process session")

@app.post("/api/add-credits-manual")
async def add_credits_manual(
    request: ManualCreditRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Manually add credits after successful payment (fallback for webhook issues)"""
    try:
        print(f"🔄 Manual credit addition for user {user.email}")
        print(f"Credits: {request.credits}, Amount: ${request.amount}")
        
        # Add credits to user account
        await add_credits_to_user(
            user.user_id, 
            request.credits, 
            request.amount, 
            request.paymentIntentId
        )
        
        print(f"✅ Manually added {request.credits} credits to user {user.email}")
        
        return {
            "success": True,
            "message": f"Added {request.credits} credits to your account"
        }
        
    except Exception as e:
        print(f"❌ Error in manual credit addition: {e}")
        raise HTTPException(status_code=500, detail="Failed to add credits manually")

@app.post("/api/stripe-webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for successful payments"""
    print("🎯 WEBHOOK CALLED! Received Stripe webhook request")
    webhook_id = str(uuid.uuid4())[:8]  # Short ID for tracking this webhook
    print(f"🆔 Webhook ID: {webhook_id}")
    
    try:
        # Get the raw body and signature
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        print(f"📋 [{webhook_id}] Webhook payload length: {len(payload)} bytes")
        print(f"📋 [{webhook_id}] Signature header present: {'✅' if sig_header else '❌'}")
        
        # Log webhook attempt to database for audit trail
        if supabase:
            try:
                supabase.table("webhook_logs").insert({
                    "webhook_id": webhook_id,
                    "event_type": "stripe_webhook",
                    "payload_size": len(payload),
                    "signature_present": bool(sig_header),
                    "status": "processing",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            except Exception as log_error:
                print(f"⚠️ [{webhook_id}] Failed to log webhook: {log_error}")
        
        if not STRIPE_WEBHOOK_SECRET:
            print(f"❌ [{webhook_id}] Webhook secret not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        
        # Verify webhook signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            print(f"❌ [{webhook_id}] Invalid payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            print(f"❌ [{webhook_id}] Invalid signature: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Log the event details for debugging
        event_type = event.get('type')
        event_id = event.get('id')
        print(f"🎯 [{webhook_id}] Event Type: {event_type}")
        print(f"🆔 [{webhook_id}] Event ID: {event_id}")
        
        # Handle different Stripe events
        # payment_intent.succeeded handler moved to enhanced version below
        
        if event['type'] == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            error_message = payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')
            user_id = payment_intent['metadata'].get('user_id') if payment_intent.get('metadata') else None
            
            print(f"❌ Payment failed: {payment_intent['id']} - {error_message}")
            
            # Log payment failure to database for investigation
            if supabase and user_id:
                try:
                    supabase.table("payment_attempts").insert({
                        "user_id": user_id,
                        "attempt_type": "payment_intent",
                        "credits_requested": int(payment_intent['metadata'].get('credits', 0)) if payment_intent.get('metadata') else 0,
                        "amount_requested": payment_intent['amount'] / 100,
                        "status": "failed",
                        "error_message": error_message,
                        "created_at": datetime.utcnow().isoformat()
                    }).execute()
                    print(f"📝 Logged payment failure for user {user_id}")
                except Exception as log_error:
                    print(f"⚠️ Failed to log payment failure: {log_error}")
            
        elif event['type'] == 'checkout.session.async_payment_failed':
            session = event['data']['object']
            error_message = session.get('last_payment_error', {}).get('message', 'Async payment failed')
            user_id = session['metadata'].get('user_id') if session.get('metadata') else None
            
            print(f"❌ Checkout session async payment failed: {session['id']} - {error_message}")
            
            # Log payment failure to database
            if supabase and user_id:
                try:
                    supabase.table("payment_attempts").insert({
                        "user_id": user_id,
                        "attempt_type": "checkout_session",
                        "credits_requested": int(session['metadata'].get('credits', 0)) if session.get('metadata') else 0,
                        "amount_requested": session['amount_total'] / 100 if session.get('amount_total') else 0,
                        "status": "failed",
                        "error_message": error_message,
                        "created_at": datetime.utcnow().isoformat()
                    }).execute()
                    print(f"📝 Logged checkout failure for user {user_id}")
                except Exception as log_error:
                    print(f"⚠️ Failed to log checkout failure: {log_error}")
            
        elif event['type'] == 'checkout.session.expired':
            session = event['data']['object']
            user_id = session['metadata'].get('user_id') if session.get('metadata') else None
            
            print(f"⏰ Checkout session expired: {session['id']}")
            
            # Log session expiry to database
            if supabase and user_id:
                try:
                    supabase.table("payment_attempts").insert({
                        "user_id": user_id,
                        "attempt_type": "checkout_session",
                        "credits_requested": int(session['metadata'].get('credits', 0)) if session.get('metadata') else 0,
                        "amount_requested": session['amount_total'] / 100 if session.get('amount_total') else 0,
                        "status": "expired",
                        "error_message": "Checkout session expired",
                        "created_at": datetime.utcnow().isoformat()
                    }).execute()
                    print(f"📝 Logged session expiry for user {user_id}")
                except Exception as log_error:
                    print(f"⚠️ Failed to log session expiry: {log_error}")
            
            
        elif event['type'] == 'charge.dispute.created':
            dispute = event['data']['object']
            charge_id = dispute['charge']
            print(f"⚠️ Dispute created for charge: {charge_id}")
            # TODO: Handle dispute - maybe freeze credits pending investigation
            
        elif event['type'] == 'payment_intent.requires_action':
            payment_intent = event['data']['object']
            print(f"🔐 Payment requires action: {payment_intent['id']}")
            # This is normal for 3D Secure, just log it
            
        elif event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            
            print(f"🛒 [{webhook_id}] Checkout session completed: {session['id']}")
            print(f"🛒 [{webhook_id}] Payment status: {session.get('payment_status', 'unknown')}")
            print(f"🛒 [{webhook_id}] Session status: {session.get('status', 'unknown')}")
            print(f"🛒 [{webhook_id}] Amount total: {session.get('amount_total', 0)}")
            print(f"🛒 [{webhook_id}] Session mode: {session.get('mode', 'unknown')}")
            print(f"🛒 [{webhook_id}] Customer email: {session.get('customer_email', 'none')}")
            
            # Extract metadata from the checkout session
            metadata = session.get('metadata', {})
            user_id = metadata.get('user_id')
            credits = int(metadata.get('credits', 0)) if metadata.get('credits') else 0
            unlimited = metadata.get('unlimited', 'False').lower() == 'true'
            amount = session['amount_total'] / 100 if session.get('amount_total') else 0  # Convert cents to dollars
            
            print(f"🛒 [{webhook_id}] Raw metadata: {metadata}")
            print(f"🛒 [{webhook_id}] Parsed - user_id: {user_id}, credits: {credits}, unlimited: {unlimited}, amount: ${amount}")
            
            # Check all possible payment statuses
            payment_status = session.get('payment_status', 'unknown')
            print(f"🛒 [{webhook_id}] Checking payment status: '{payment_status}'")
            
            # Process if payment was successful OR if it's a specific status that indicates completion
            if payment_status in ['paid', 'complete']:
                if user_id:
                    if unlimited:
                        print(f"🌟 [{webhook_id}] Processing UNLIMITED purchase for user {user_id}")
                        # Grant unlimited access
                        await grant_unlimited_access(user_id, amount, session['id'])
                        print(f"✅ [{webhook_id}] Granted unlimited access to user {user_id}")
                    elif credits > 0:
                        print(f"💳 [{webhook_id}] Processing CREDITS purchase: {credits} credits for user {user_id}")
                        # Add credits to user account
                        await add_credits_to_user(user_id, credits, amount, session['id'])
                        print(f"✅ [{webhook_id}] Added {credits} credits to user {user_id}")
                    else:
                        print(f"❌ [{webhook_id}] Invalid purchase: user_id={user_id}, credits={credits}, unlimited={unlimited}")
                        print(f"❌ [{webhook_id}] Amount was ${amount} - this suggests a configuration issue")
                else:
                    print(f"❌ [{webhook_id}] Missing user_id in metadata")
                    print(f"❌ [{webhook_id}] Available metadata keys: {list(metadata.keys())}")
            else:
                print(f"⚠️ [{webhook_id}] Session completed but payment status is '{payment_status}' (expected 'paid')")
                print(f"⚠️ [{webhook_id}] Will wait for payment to complete via other webhook events")
                print(f"⚠️ [{webhook_id}] Session object keys: {list(session.keys())}")
                
        elif event['type'] == 'checkout.session.async_payment_succeeded':
            session = event['data']['object']
            
            print(f"🛒 [Webhook] Checkout session async payment succeeded: {session['id']}")
            
            # Extract metadata from the checkout session
            user_id = session['metadata'].get('user_id')
            credits = int(session['metadata'].get('credits', 0))
            unlimited = session['metadata'].get('unlimited', 'False').lower() == 'true'
            amount = session['amount_total'] / 100 if session.get('amount_total') else 0
            
            if user_id:
                if unlimited:
                    # Grant unlimited access
                    await grant_unlimited_access(user_id, amount, session['id'])
                    print(f"✅ [Async Payment] Granted unlimited access to user {user_id}")
                elif credits > 0:
                    # Add credits to user account
                    await add_credits_to_user(user_id, credits, amount, session['id'])
                    print(f"✅ [Async Payment] Added {credits} credits to user {user_id}")
                else:
                    print(f"❌ [Async Payment] Invalid purchase: user_id={user_id}, credits={credits}, unlimited={unlimited}")
            else:
                print(f"❌ [Async Payment] Missing metadata: user_id={user_id}, credits={credits}, unlimited={unlimited}")
        
        # payment_intent.succeeded handler removed - using enhanced version below
            
        elif event['type'] == 'payment_intent.created':
            payment_intent = event['data']['object']
            print(f"[{webhook_id}] Payment intent created: {payment_intent['id']}")
            print(f"[{webhook_id}] Amount: ${payment_intent['amount'] / 100}")
            
            # This is normal - payment intent is created when checkout session starts
            # The actual processing happens in checkout.session.completed
            if payment_intent.get('metadata'):
                user_id = payment_intent['metadata'].get('user_id')
                credits = payment_intent['metadata'].get('credits', 0)
                unlimited = payment_intent['metadata'].get('unlimited', 'False').lower() == 'true'
                print(f"{webhook_id}] Payment intent metadata: user_id={user_id}, credits={credits}, unlimited={unlimited}")

        elif event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            pi_id = payment_intent['id']
            amount = payment_intent['amount'] / 100
            print(f"✅ [{webhook_id}] Payment intent succeeded: {pi_id}")
            print(f"✅ [{webhook_id}] Amount: ${amount}")
            print(f"✅ [{webhook_id}] Metadata: {payment_intent.get('metadata', {})}")
            
            # First try to process using payment intent metadata directly
            pi_metadata = payment_intent.get('metadata', {})
            user_id = pi_metadata.get('user_id')
            credits = int(pi_metadata.get('credits', 0)) if pi_metadata.get('credits') else 0
            unlimited = pi_metadata.get('unlimited', 'False').lower() == 'true'
            
            print(f"🔍 [{webhook_id}] Direct processing - user_id: {user_id}, unlimited: {unlimited}, credits: {credits}")
            
            if user_id and (unlimited or credits > 0):
                # Process directly from payment intent metadata
                if unlimited:
                    print(f"🌟 [{webhook_id}] Processing UNLIMITED via payment_intent.succeeded (direct)")
                    await grant_unlimited_access(user_id, amount, pi_id)
                    print(f"✅ [{webhook_id}] Granted unlimited access via payment intent (direct)")
                elif credits > 0:
                    print(f"💳 [{webhook_id}] Processing CREDITS via payment_intent.succeeded (direct)")
                    await add_credits_to_user(user_id, credits, amount, pi_id)
                    print(f"✅ [{webhook_id}] Added credits via payment intent (direct)")
            else:
                # Fallback: Try to find the associated checkout session
                print(f"🔄 [{webhook_id}] No valid metadata in payment intent, looking up checkout session...")
                try:
                    sessions = stripe.checkout.Session.list(
                        payment_intent=pi_id,
                        limit=1
                    )
                    if sessions.data:
                        session = sessions.data[0]
                        print(f"🔗 [{webhook_id}] Found associated checkout session: {session.id}")
                        print(f"🔗 [{webhook_id}] Session metadata: {session.metadata}")
                        
                        # Process the payment using session metadata
                        metadata = session.metadata
                        user_id = metadata.get('user_id')
                        credits = int(metadata.get('credits', 0)) if metadata.get('credits') else 0
                        unlimited = metadata.get('unlimited', 'False').lower() == 'true'
                        
                        if user_id:
                            if unlimited:
                                print(f"🌟 [{webhook_id}] Processing UNLIMITED via payment_intent.succeeded (session)")
                                await grant_unlimited_access(user_id, amount, session.id)
                                print(f"✅ [{webhook_id}] Granted unlimited access via payment intent (session)")
                            elif credits > 0:
                                print(f"💳 [{webhook_id}] Processing CREDITS via payment_intent.succeeded (session)")
                                await add_credits_to_user(user_id, credits, amount, session.id)
                                print(f"✅ [{webhook_id}] Added credits via payment intent (session)")
                        else:
                            print(f"❌ [{webhook_id}] No user_id in session metadata")
                    else:
                        print(f"❌ [{webhook_id}] No checkout session found for payment intent {pi_id}")
                except Exception as e:
                    print(f"❌ [{webhook_id}] Error retrieving checkout session: {e}")

        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            print(f"🧾 [{webhook_id}] Invoice payment succeeded: {invoice['id']}")
            print(f"🧾 [{webhook_id}] Amount paid: ${invoice['amount_paid'] / 100}")
            print(f"🧾 [{webhook_id}] Subscription: {invoice.get('subscription', 'none')}")
            # Note: This usually handles subscription payments, not one-time purchases
            
        else:
            print(f"📝 [{webhook_id}] Unhandled webhook event: {event['type']}")
            print(f"📝 [{webhook_id}] Event data keys: {list(event.get('data', {}).get('object', {}).keys())}")
            
        # Update webhook log with final status
        if supabase:
            try:
                supabase.table("webhook_logs").update({
                    "status": "success",
                    "stripe_event_type": event['type'],
                    "processed_data": {
                        "event_type": event['type'],
                        "processed_at": datetime.utcnow().isoformat()
                    },
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("webhook_id", webhook_id).execute()
            except Exception as log_error:
                print(f"⚠️ [{webhook_id}] Failed to update webhook log: {log_error}")
            
        return {"status": "success"}
        
    except Exception as e:
        print(f"Webhook error: {e}")
        
        # Update webhook log with error status
        if supabase:
            try:
                supabase.table("webhook_logs").update({
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("webhook_id", webhook_id).execute()
            except Exception as log_error:
                print(f"⚠️ [{webhook_id}] Failed to update webhook error log: {log_error}")
        
        raise HTTPException(status_code=500, detail="Webhook processing failed")

def calculate_credit_price(credits: int) -> float:
    """Calculate price for credits with volume discounts"""
    # Special case: unlimited plan
    if credits == -1:
        return 4.99
    
    # Special pricing for 25 credits
    if credits == 25:
        return 1.50
    
    base_price = 0.10  # $0.10 per credit
    
    if credits >= 250:
        # 20% off for 250+ credits
        return round(credits * base_price * 0.8, 2)
    elif credits >= 100:
        # 15% off for 100+ credits  
        return round(credits * base_price * 0.85, 2)
    elif credits >= 50:
        # 10% off for 50+ credits
        return round(credits * base_price * 0.9, 2)
    else:
        return round(credits * base_price, 2)

async def add_credits_to_user(user_id: str, credits: int, amount: float, stripe_payment_id: str):
    """Add credits to user account after successful payment"""
    try:
        if not supabase:
            print("Warning: Supabase not available")
            return
        
        print(f"🔄 Adding {credits} credits to user {user_id}")
        print(f"💰 Amount: ${amount}, Stripe ID: {stripe_payment_id}")
        
        # Check if this payment was already processed (duplicate protection)
        existing_payment = supabase.table("credit_transactions").select("id").eq("stripe_payment_id", stripe_payment_id).execute()
        
        if existing_payment.data:
            print(f"⚠️ Payment {stripe_payment_id} already processed, skipping duplicate")
            return
        
        # Use the database function to add credits (handles both transaction and balance update)
        result = supabase.rpc("add_credits_to_user", {
            "user_uuid": user_id,
            "credits_to_add": credits,
            "transaction_description": f"Stripe payment - ${amount} for {credits} credits (Payment ID: {stripe_payment_id})"
        }).execute()
        
        print(f"📊 Supabase RPC result: {result}")
        
        if result.data and result.data != -1:
            print(f"✅ Successfully added {credits} credits to user {user_id}. New balance: {result.data}")
        else:
            print(f"❌ Failed to add credits to user {user_id}. Error: {result}")
            
    except Exception as e:
        print(f"❌ Error adding credits to user {user_id}: {e}")
        # Try to log more details about the error
        if hasattr(e, '__dict__'):
            print(f"❌ Error details: {e.__dict__}")

async def grant_unlimited_access(user_id: str, amount: float, stripe_payment_id: str):
    """Grant unlimited access to user after successful payment"""
    try:
        if not supabase:
            print("❌ Supabase not available - cannot grant unlimited access")
            return
        
        print(f"🌟 Granting unlimited access to user {user_id}")
        print(f"💰 Amount: ${amount}, Stripe ID: {stripe_payment_id}")
        
        # Check if this payment was already processed (duplicate protection)
        existing_payment = supabase.table("credit_transactions").select("id").eq("stripe_payment_id", stripe_payment_id).execute()
        
        if existing_payment.data:
            print(f"⚠️ Payment {stripe_payment_id} already processed, skipping duplicate")
            return
        
        # First, try using the database function
        try:
            result = supabase.rpc("grant_unlimited_access", {
                "user_uuid": user_id,
                "amount_paid": amount,
                "stripe_payment_id": stripe_payment_id
            }).execute()
            
            print(f"📊 Database function result: {result}")
            
            if result.data and result.data != -1:
                print(f"✅ Successfully granted unlimited access to user {user_id} using database function")
                return
            else:
                print(f"⚠️ Database function returned error code: {result.data}")
                print("🔄 Falling back to manual database updates...")
                
        except Exception as db_func_error:
            print(f"❌ Database function failed: {db_func_error}")
            print("🔄 Falling back to manual database updates...")
        
        # Fallback: manually update the database if the function fails
        print(f"🔧 Manually updating user {user_id} to unlimited plan...")
        
        # Update user profile
        update_result = supabase.table("user_profiles").update({
            "payment_plan": "unlimited",
            "credits_balance": 999999,
            "subscription_status": "active",
            "plan_start_date": "now()",
            "updated_at": "now()"
        }).eq("id", user_id).execute()
        
        print(f"📊 Profile update result: {update_result}")
        
        if update_result.data:
            print(f"✅ Successfully updated user profile to unlimited")
            
            # Log the transaction
            transaction_result = supabase.table("credit_transactions").insert({
                "user_id": user_id,
                "transaction_type": "purchase",
                "credits": 999999,
                "amount": amount,
                "stripe_payment_id": stripe_payment_id,
                "description": "Unlimited access purchase - no credit limits (manual fallback)"
            }).execute()
            
            print(f"📊 Transaction log result: {transaction_result}")
            
            if transaction_result.data:
                print(f"✅ Successfully logged unlimited access transaction for user {user_id}")
            else:
                print(f"⚠️ Failed to log transaction but user was updated to unlimited")
                
        else:
            print(f"❌ Failed to update user profile manually. Update result: {update_result}")
            
    except Exception as e:
        print(f"❌ Critical error granting unlimited access to user {user_id}: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        if hasattr(e, '__dict__'):
            print(f"❌ Error details: {e.__dict__}")
        
        # Last resort: try to at least log the payment attempt
        try:
            supabase.table("webhook_logs").insert({
                "webhook_id": f"failed_unlimited_{user_id}_{stripe_payment_id[:8]}",
                "event_type": "unlimited_grant_failed", 
                "status": "failed",
                "error_message": str(e),
                "processed_data": {
                    "user_id": user_id,
                    "amount": amount,
                    "stripe_payment_id": stripe_payment_id
                }
            }).execute()
            print(f"📝 Logged failed unlimited grant attempt for investigation")
        except:
            print(f"❌ Could not even log the failure - critical database issue")

@app.post("/api/debug/grant-unlimited")
async def debug_grant_unlimited(request: dict, user: AuthenticatedUser = Depends(get_current_user)):
    """Debug endpoint to manually grant unlimited access"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        target_email = request.get("email")
        if not target_email:
            raise HTTPException(status_code=400, detail="Email required")
        
        # Find user by email
        user_result = supabase.table("user_profiles").select("id, email, credits_balance, payment_plan").eq("email", target_email).execute()
        
        if not user_result.data:
            raise HTTPException(status_code=404, detail=f"User not found: {target_email}")
        
        target_user = user_result.data[0]
        print(f"🔍 Found user: {target_user}")
        
        # Grant unlimited access
        await grant_unlimited_access(target_user["id"], 4.99, "manual_debug_grant")
        
        # Check the result
        updated_user = supabase.table("user_profiles").select("id, email, credits_balance, payment_plan, subscription_status").eq("id", target_user["id"]).execute()
        
        return {
            "success": True,
            "message": f"Unlimited access granted to {target_email}",
            "user_before": target_user,
            "user_after": updated_user.data[0] if updated_user.data else None
        }
        
    except Exception as e:
        print(f"❌ Error in debug grant unlimited: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/check-user/{email}")
async def debug_check_user(email: str):
    """Debug endpoint to check user status - BYPASS AUTH FOR DEBUGGING"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        print(f"🔍 Checking user: {email}")
        
        # Find user by email
        user_result = supabase.table("user_profiles").select("*").eq("email", email).execute()
        
        if not user_result.data:
            return {"found": False, "email": email}
        
        user_data = user_result.data[0]
        print(f"👤 Found user: {user_data}")
        
        # Also check recent transactions
        transactions = supabase.table("credit_transactions").select("*").eq("user_id", user_data["id"]).order("created_at", desc=True).limit(5).execute()
        
        return {
            "found": True,
            "user": user_data,
            "recent_transactions": transactions.data
        }
        
    except Exception as e:
        print(f"❌ Error checking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/debug/grant-unlimited/{email}")
async def debug_grant_unlimited_by_email(email: str):
    """Debug endpoint to manually grant unlimited access by email - BYPASS AUTH FOR DEBUGGING"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        print(f"🌟 Granting unlimited access to: {email}")
        
        # Find user by email
        user_result = supabase.table("user_profiles").select("id, email, credits_balance, payment_plan").eq("email", email).execute()
        
        if not user_result.data:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")
        
        target_user = user_result.data[0]
        print(f"🔍 Found user: {target_user}")
        
        # Grant unlimited access using the existing function
        await grant_unlimited_access(target_user["id"], 4.99, "manual_debug_grant_" + target_user["id"][:8])
        
        # Check the result
        updated_user = supabase.table("user_profiles").select("id, email, credits_balance, payment_plan, subscription_status").eq("id", target_user["id"]).execute()
        
        return {
            "success": True,
            "message": f"Unlimited access granted to {email}",
            "user_before": target_user,
            "user_after": updated_user.data[0] if updated_user.data else None
        }
        
    except Exception as e:
        print(f"❌ Error in debug grant unlimited: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cache-performance/{job_id}")
async def get_cache_performance(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get caching performance metrics for a job"""
    try:
        # Download summary to check cache performance
        summary_content = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json")
        if not summary_content:
            raise HTTPException(status_code=404, detail="Job summary not found")
        
        summary = json.loads(summary_content)
        
        cache_metrics = {
            "job_id": job_id,
            "total_input_tokens": summary.get("total_input_tokens", 0),
            "total_cached_tokens": summary.get("total_cached_tokens", 0),
            "cache_hit_rate": summary.get("cache_hit_rate", 0),
            "cost_savings_from_cache": summary.get("cost_savings_from_cache", 0),
            "total_cost": summary.get("total_cost", 0),
            "processed_chunks": summary.get("processed_chunks", 0)
        }
        
        return cache_metrics
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid summary data")
    except Exception as e:
        print(f"Error fetching cache performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch cache performance")

@app.get("/api/payment-attempts")
async def get_payment_attempts(user: AuthenticatedUser = Depends(get_current_user)):
    """Get recent payment attempts for debugging payment issues"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Get recent payment attempts for this user
        result = supabase.table("payment_attempts").select("*").eq("user_id", user.user_id).order("created_at", desc=True).limit(10).execute()
        
        attempts = []
        if result.data:
            for attempt in result.data:
                attempts.append({
                    "attempt_type": attempt.get("attempt_type"),
                    "status": attempt.get("status"),
                    "error_message": attempt.get("error_message"),
                    "credits_requested": attempt.get("credits_requested"),
                    "amount_requested": attempt.get("amount_requested"),
                    "created_at": attempt.get("created_at")
                })
        
        return {
            "recent_attempts": attempts,
            "total_attempts": len(attempts),
            "failed_attempts": len([a for a in attempts if a["status"] == "failed"])
        }
        
    except Exception as e:
        print(f"Error fetching payment attempts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch payment attempts")

@app.post("/stripe/webhook")
async def stripe_webhook_alias(request: Request):
    """Alias endpoint for Stripe webhooks (matches Stripe dashboard configuration)"""
    return await stripe_webhook(request)

@app.post("/api/debug/test-unlimited-webhook")
async def test_unlimited_webhook(request: dict, user: AuthenticatedUser = Depends(get_current_user)):
    """Test endpoint to simulate unlimited purchase webhook for debugging"""
    try:
        user_id = request.get("user_id") or user.user_id
        amount = request.get("amount", 4.99)
        session_id = request.get("session_id", f"test_session_{user_id}_{int(time.time())}")
        
        print(f"🧪 Testing unlimited access grant for user {user_id}")
        
        # Simulate the webhook call
        await grant_unlimited_access(user_id, amount, session_id)
        
        # Check the result
        if supabase:
            user_check = supabase.table("user_profiles").select("*").eq("id", user_id).execute()
            if user_check.data:
                user_data = user_check.data[0]
                return {
                    "success": True,
                    "message": "Test unlimited access grant completed",
                    "user_before": {
                        "payment_plan": user_data.get("payment_plan"),
                        "credits_balance": user_data.get("credits_balance"),
                        "subscription_status": user_data.get("subscription_status")
                    },
                    "user_after": user_data,
                    "test_session_id": session_id
                }
        
        return {"success": True, "message": "Test completed (no database verification)"}
        
    except Exception as e:
        print(f"❌ Test unlimited webhook error: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@app.post("/api/debug/simulate-checkout")
async def simulate_checkout_webhook(request: dict, user: AuthenticatedUser = Depends(get_current_user)):
    """Simulate a complete checkout.session.completed webhook event"""
    try:
        user_id = request.get("user_id") or user.user_id
        unlimited = request.get("unlimited", True)
        credits = request.get("credits", 0)
        
        print(f"🧪 [Simulate] Simulating checkout for user: {user_id}, unlimited: {unlimited}, credits: {credits}")
        
        # Create a mock checkout session event
        mock_session = {
            'id': f'cs_test_simulation_{user_id}_{int(time.time())}',
            'payment_status': 'paid',
            'status': 'complete',
            'amount_total': 499 if unlimited else credits * 100,  # $4.99 for unlimited, $1 per credit
            'mode': 'payment',
            'customer_email': f'{user_id}@test.com',
            'metadata': {
                'user_id': user_id,
                'unlimited': str(unlimited).lower(),
                'credits': str(credits)
            }
        }
        
        # Process it like a real webhook
        if unlimited:
            amount = mock_session['amount_total'] / 100
            result = await grant_unlimited_access(user_id, amount, mock_session['id'])
            message = f"Simulated unlimited purchase for {user_id}"
        elif credits > 0:
            amount = credits  # $1 per credit for simulation
            result = await add_credits_to_user(user_id, credits, amount, mock_session['id'])
            message = f"Simulated {credits} credits purchase for {user_id}"
        else:
            raise HTTPException(status_code=400, detail="Must specify either unlimited=true or credits>0")
        
        # Verify the result
        if supabase:
            verification = supabase.table("user_profiles").select("*").eq("id", user_id).execute()
            user_data = verification.data[0] if verification.data else None
        else:
            user_data = None
            
        return {
            "success": True,
            "message": message,
            "simulation": {
                "session": mock_session,
                "user_after": user_data
            }
        }
            
    except Exception as e:
        print(f"❌ [Simulate] Error simulating checkout: {e}")
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

@app.get("/api/debug/webhook-events")
async def get_recent_webhook_events(user: AuthenticatedUser = Depends(get_current_user)):
    """Get recent webhook events from our logs"""
    try:
        print(f"🔍 [Debug] Fetching recent webhook events for user {user.user_id}")
        
        # Get webhook logs from the database if we have them
        if supabase:
            try:
                # Query webhook_logs table if it exists
                webhook_logs = supabase.table("webhook_logs").select("*").order("created_at", desc=True).limit(20).execute()
                logs = webhook_logs.data if webhook_logs.data else []
                
                # Also get recent payment-related events from user_payment_status
                payment_logs = supabase.table("user_payment_status").select("*").order("updated_at", desc=True).limit(10).execute()
                payments = payment_logs.data if payment_logs.data else []
                
                return {
                    "success": True,
                    "webhook_logs": logs,
                    "recent_payments": payments,
                    "message": f"Found {len(logs)} webhook logs and {len(payments)} payment records"
                }
                
            except Exception as db_e:
                print(f"⚠️ [Debug] Database query failed: {db_e}")
                # Fall back to Stripe API
                
        # Fallback: Query Stripe directly for recent events
        try:
            from datetime import datetime, timedelta
            
            yesterday = datetime.now() - timedelta(days=1)
            events = stripe.Event.list(
                created={'gte': int(yesterday.timestamp())},
                limit=50
            )
            
            # Filter for relevant events
            relevant_events = []
            for event in events.data:
                if any(keyword in event.type for keyword in ['checkout', 'payment', 'invoice']):
                    event_data = {
                        'id': event.id,
                        'type': event.type,
                        'created': datetime.fromtimestamp(event.created).isoformat(),
                        'livemode': event.livemode
                    }
                    
                    # Add object details
                    obj = event.data.object
                    if hasattr(obj, 'metadata') and obj.metadata:
                        event_data['metadata'] = dict(obj.metadata)
                    if hasattr(obj, 'amount_total'):
                        event_data['amount'] = obj.amount_total / 100 if obj.amount_total else 0
                    if hasattr(obj, 'payment_status'):
                        event_data['payment_status'] = obj.payment_status
                    if hasattr(obj, 'status'):
                        event_data['status'] = obj.status
                        
                    relevant_events.append(event_data)
            
            return {
                "success": True,
                "stripe_events": relevant_events,
                "message": f"Found {len(relevant_events)} relevant Stripe events from last 24h",
                "note": "This is from Stripe API directly since webhook logs aren't available"
            }
            
        except Exception as stripe_e:
            print(f"❌ [Debug] Stripe API query failed: {stripe_e}")
            return {
                "success": False,
                "error": f"Could not fetch events: {str(stripe_e)}",
                "message": "Both database and Stripe API queries failed"
            }
        
    except Exception as e:
        print(f"❌ [Debug] Error fetching webhook events: {e}")
        raise HTTPException(status_code=500, detail=f"Debug failed: {str(e)}")

@app.post("/api/migrate-missing-packs")
async def migrate_missing_packs(user: AuthenticatedUser = Depends(get_current_user)):
    """Migration endpoint to create pack records for completed jobs that don't have them"""
    try:
        migrated_jobs = []
        failed_jobs = []
        
        # Check for completed jobs in R2 that have analysis_results.json or summary.json
        try:
            # Use R2 API to list objects in the user's directory
            import boto3
            from botocore.config import Config
            
            # Initialize R2 client
            session = boto3.Session()
            r2_client = session.client(
                's3',
                endpoint_url=R2_ENDPOINT,
                aws_access_key_id=R2_ACCESS_KEY,
                aws_secret_access_key=R2_SECRET_KEY,
                config=Config(signature_version='s3v4')
            )
            
            # List objects with user's directory prefix
            prefix = f"{user.r2_directory.lstrip('/')}/"
            response = r2_client.list_objects_v2(
                Bucket=R2_BUCKET,
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                return {"message": "No objects found in user directory", "migrated": [], "failed": []}
            
            # Group files by job_id
            jobs = {}
            for obj in response['Contents']:
                key = obj['Key']
                # Extract job_id from path: user_xxx/job_id/file.json
                path_parts = key.split('/')
                if len(path_parts) >= 3:
                    job_id = path_parts[-2]  # Second to last part is job_id
                    filename = path_parts[-1]  # Last part is filename
                    
                    if job_id not in jobs:
                        jobs[job_id] = []
                    jobs[job_id].append(filename)
            
            # Check each job for completion and missing pack record
            for job_id, files in jobs.items():
                # Skip if not a completed job (must have analysis_results.json or summary.json)
                if not ('analysis_results.json' in files or 'summary.json' in files):
                    continue
                
                try:
                    # Check if pack record already exists in Supabase
                    if supabase:
                        existing_pack = supabase.table("packs").select("*").eq("pack_job_id", job_id).execute()
                        if existing_pack.data:
                            continue  # Pack record already exists, skip
                    
                    # Try to get analysis data
                    analysis_stats = {}
                    extraction_stats = {}
                    
                    # Try to load analysis results or summary
                    analysis_content = download_from_r2(f"{user.r2_directory}/{job_id}/analysis_results.json", silent_404=True)
                    if not analysis_content:
                        analysis_content = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json", silent_404=True)
                    
                    if analysis_content:
                        try:
                            analysis_data = json.loads(analysis_content)
                            performance_metrics = analysis_data.get("performance_metrics", {})
                            analysis_stats = {
                                "total_input_tokens": performance_metrics.get("total_input_tokens", 0),
                                "total_output_tokens": performance_metrics.get("total_output_tokens", 0),
                                "total_cost": performance_metrics.get("total_cost", 0),
                                "processed_chunks": len(analysis_data.get("results", [])),
                                "cache_hit_rate": performance_metrics.get("cache_hit_rate", 0)
                            }
                        except:
                            pass
                    
                    # Try to load chunk metadata
                    chunks_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json", silent_404=True)
                    if chunks_content:
                        try:
                            chunks_data = json.loads(chunks_content)
                            extraction_stats = {
                                "total_chunks": chunks_data.get("total_chunks", 0),
                                "processed_chunks": len(chunks_data.get("chunks", []))
                            }
                        except:
                            pass
                    
                    # Create pack record
                    pack_name = f"UCP-{job_id[:8]}"
                    pack_record = await create_pack_in_db(
                        user=user,
                        job_id=job_id,
                        pack_name=pack_name,
                        r2_pack_path=f"{user.r2_directory}/{job_id}/",
                        extraction_stats=extraction_stats,
                        analysis_stats=analysis_stats
                    )
                    
                    if pack_record:
                        migrated_jobs.append(job_id)
                        print(f"✅ Created pack record for job {job_id}")
                    
                except Exception as e:
                    failed_jobs.append({"job_id": job_id, "error": str(e)})
                    print(f"❌ Failed to create pack record for job {job_id}: {e}")
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list R2 objects: {str(e)}")
        
        return {
            "message": f"Pack migration completed. {len(migrated_jobs)} pack records created, {len(failed_jobs)} failed.",
            "migrated": migrated_jobs,
            "failed": failed_jobs
        }
        
    except Exception as e:
        print(f"Pack migration error: {e}")
        raise HTTPException(status_code=500, detail=f"Pack migration failed: {str(e)}")

@app.post("/api/migrate-missing-summaries")
async def migrate_missing_summaries(user: AuthenticatedUser = Depends(get_current_user)):
    """Migration endpoint to fix jobs that have analysis_results.json but missing summary.json"""
    try:
        migrated_jobs = []
        failed_jobs = []
        
        # List all files in user's R2 directory
        try:
            # Use R2 API to list objects in the user's directory
            import boto3
            from botocore.config import Config
            
            # Initialize R2 client
            session = boto3.Session()
            r2_client = session.client(
                's3',
                endpoint_url=R2_ENDPOINT,
                aws_access_key_id=R2_ACCESS_KEY,
                aws_secret_access_key=R2_SECRET_KEY,
                config=Config(signature_version='s3v4')
            )
            
            # List objects with user's directory prefix
            prefix = f"{user.r2_directory.lstrip('/')}/"
            response = r2_client.list_objects_v2(
                Bucket=R2_BUCKET,
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                return {"message": "No objects found in user directory", "migrated": [], "failed": []}
            
            # Group files by job_id
            jobs = {}
            for obj in response['Contents']:
                key = obj['Key']
                # Extract job_id from path: user_xxx/job_id/file.json
                path_parts = key.split('/')
                if len(path_parts) >= 3:
                    job_id = path_parts[-2]  # Second to last part is job_id
                    filename = path_parts[-1]  # Last part is filename
                    
                    if job_id not in jobs:
                        jobs[job_id] = []
                    jobs[job_id].append(filename)
            
            # Check each job for analysis_results.json but missing summary.json
            for job_id, files in jobs.items():
                if 'analysis_results.json' in files and 'summary.json' not in files:
                    try:
                        # Download analysis_results.json
                        analysis_content = download_from_r2(f"{user.r2_directory}/{job_id}/analysis_results.json", silent_404=True)
                        if analysis_content:
                            # Upload as summary.json
                            upload_to_r2(f"{user.r2_directory}/{job_id}/summary.json", analysis_content)
                            migrated_jobs.append(job_id)
                            print(f"✅ Migrated job {job_id}: Created summary.json from analysis_results.json")
                    except Exception as e:
                        failed_jobs.append({"job_id": job_id, "error": str(e)})
                        print(f"❌ Failed to migrate job {job_id}: {e}")
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list R2 objects: {str(e)}")
        
        return {
            "message": f"Migration completed. {len(migrated_jobs)} jobs migrated, {len(failed_jobs)} failed.",
            "migrated": migrated_jobs,
            "failed": failed_jobs
        }
        
    except Exception as e:
        print(f"Migration error: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

if __name__ == "__main__":
    import sys
    # Force unbuffered output
    
    print("🚀 Starting Simple UCP Backend with R2 Storage - 3 Step Process...", flush=True)
    print(f"📦 Using R2 bucket: {R2_BUCKET}", flush=True)
    print("📋 Steps: 1) Extract → 2) Chunk → 3) Analyze", flush=True)
    uvicorn.run("simple_backend:app", host="0.0.0.0", port=8000, reload=False, log_level="info")

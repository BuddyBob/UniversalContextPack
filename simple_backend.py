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

# Import Memory Tree module (if enabled)
try:
    from memory_tree import (
        get_scope_for_source,
        apply_chunk_to_memory_tree,
        export_pack_from_tree
    )
    MEMORY_TREE_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Memory Tree module not available: {e}")
    MEMORY_TREE_AVAILABLE = False

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

# Memory Tree feature flag
MEMORY_TREE_ENABLED = os.getenv("MEMORY_TREE_ENABLED", "false").lower() == "true"

# Concurrent processing configuration
MAX_CONCURRENT_CHUNKS = int(os.getenv("OPENAI_MAX_CONCURRENT_REQUESTS", "5"))

if MEMORY_TREE_ENABLED and MEMORY_TREE_AVAILABLE:
    print("🌳 Memory Tree ENABLED - will populate knowledge graph during analysis")
elif MEMORY_TREE_ENABLED:
    print("⚠️ Memory Tree ENABLED but module not available - check imports")
else:
    print("📝 Memory Tree DISABLED - using text-only mode")

print(f"⚡ Concurrent chunk processing: {MAX_CONCURRENT_CHUNKS} chunks at a time")

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

class AddMemoryRequest(BaseModel):
    text: str
    source: str = "MCP Tool"

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
# File references: UUIDs with extensions, random file IDs, screenshot filenames
_FILE_REFERENCE_PATTERN = re.compile(r'^([a-f0-9\-]{30,}|file-[a-zA-Z0-9]{15,}|screenshot\s+\d{4}-\d{2}-\d{2}\s+at\s+[\d\.\s:]+\s*(am|pm)?)\.(jpe?g|png|pdf|gif|webp|mp4|mov)$', re.IGNORECASE)

# Pre-define technical patterns set for faster lookup
_TECHNICAL_PATTERNS = {
    'http://', 'https://', '.com', '.org', '.net', '.json', '.txt', '.py', '.edu', '.gov',
    'client-created', 'message_type', 'model_slug', 'gpt-', 'claude-',
    'request_id', 'timestamp_', 'content_type', 'conversation_id',
    'finished_successfully', 'absolute', 'metadata', 'system',
    'user_editable_context', 'is_visually_hidden', 'role:', 'author:',
    'create_time', 'update_time', 'parent_id', 'children', 'mapping',
    'finish_details', 'stop_tokens', 'citations', 'content_references', 'file-service://',
    '-lhr', '-iad', '-syd', '-fra',  # Common ChatGPT server suffixes
    '[pdf]', 'citeturn', 'common data set', 'self service', 'catalog',
    'annual report', 'financial report', 'mediafiles', 'eventreg'
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
        _LINE_NUMBER_PATTERN.match(text) or _FILE_REFERENCE_PATTERN.match(text)):
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
    """OPTIMIZED: Extract meaningful text from plain text content with better context preservation"""
    extracted_texts = []
    text_set = set()  # For exact duplicate checking
    semantic_set = set()  # For semantic duplicate detection
    
    try:
        # Try to detect if it's actually structured data in text format
        content_stripped = file_content.strip()
        if content_stripped.startswith(('{', '[')):
            try:
                data = json.loads(file_content)
                return extract_text_from_structure(data)
            except:
                pass  # Continue with text processing
        
        # Filter patterns for metadata and navigation elements
        metadata_patterns = [
            r'^\[PDF\].*',  # PDF metadata
            r'^https?://.*',  # URLs
            r'^www\..*',  # WWW URLs
            r'^\d+\s*-\s*\d+$',  # Page numbers like "1 - 2"
            r'^(Common Data Set|Self Service|Annual Report|Catalog|Financial Report).*',  # Navigation items
            r'^citeturn\d+.*',  # Citation metadata
            r'^mediafiles\..*',  # Media file references
            r'^eventreg\..*',  # Event registration URLs
            r'\.edu$',  # Domain endings
            r'\.com$',
            r'\.org$',
            r'^(assistant|user|sent|attachment omitted|powered by openai).*',  # Chat metadata
            r'.*:\s*$',  # Lines ending with colon (speaker tags)
        ]
        
        # Compile metadata patterns
        metadata_regex = re.compile('|'.join(metadata_patterns), re.IGNORECASE)
        
        # Patterns for quoted replies and chat artifacts
        quote_pattern = re.compile(r'^>\s*')  # Email-style quotes
        speaker_pattern = re.compile(r'^(assistant|user|chatgpt|human|ai):\s*', re.IGNORECASE)
        
        # Split into paragraphs and process with better context preservation
        paragraphs = re.split(r'\n\s*\n|\r\n\s*\r\n', file_content)
        
        for para in paragraphs:
            # Clean up the paragraph
            para = para.strip()
            
            # Skip if too short
            if len(para) < 10:
                continue
            
            # Skip metadata and navigation
            if metadata_regex.match(para):
                continue
            
            # Skip if it's mostly punctuation or numbers (but be less strict)
            alphanumeric_count = sum(c.isalnum() for c in para)
            if alphanumeric_count < len(para) * 0.3:  # Reduced from 0.5 to 0.3
                continue
            
            # Try to preserve multi-line content as paragraphs
            lines = para.split('\n')
            current_paragraph = []
            
            for line in lines:
                cleaned_line = line.strip()
                
                # Skip empty or very short lines
                if len(cleaned_line) < 5:
                    continue
                
                # Remove quoted reply markers
                cleaned_line = quote_pattern.sub('', cleaned_line)
                
                # Remove speaker tags at start of line
                cleaned_line = speaker_pattern.sub('', cleaned_line)
                
                # Remove timestamps and username prefixes
                cleaned_line = _TIMESTAMP_PATTERN.sub('', cleaned_line)
                cleaned_line = _TIME_PATTERN.sub('', cleaned_line)
                cleaned_line = _USERNAME_PATTERN.sub('', cleaned_line)
                cleaned_line = cleaned_line.strip()
                
                # Skip metadata lines
                if metadata_regex.match(cleaned_line):
                    continue
                
                # Check if this line is meaningful
                if is_meaningful_text(cleaned_line):
                    current_paragraph.append(cleaned_line)
            
            # Join lines into a cohesive paragraph
            if current_paragraph:
                # Combine lines that seem to be part of the same thought
                combined = ' '.join(current_paragraph)
                
                # Detect conversation roles and tag content
                # Check first few words for role indicators
                first_words = combined[:100].lower()
                role_prefix = ""
                
                # User/Human indicators
                if any(marker in first_words for marker in ['you said', 'you asked', 'i said', 'i asked', 'question:', 'user:']):
                    role_prefix = "<user> "
                # Assistant/AI indicators  
                elif any(marker in first_words for marker in ['i can help', 'here is', "here's", 'assistant:', 'chatgpt:', 'let me']):
                    role_prefix = "<assistant> "
                
                # Apply role prefix if detected
                if role_prefix:
                    combined = role_prefix + combined
                
                # Semantic duplicate detection: normalize for comparison
                # Only collapse whitespace and lowercase - preserve numbers and meaningful punctuation
                semantic_hash = ' '.join(combined.lower().split())[:250]
                
                # Only add if not duplicate (exact or semantic) and has substance
                if combined not in text_set and semantic_hash not in semantic_set and len(combined) > 20:
                    extracted_texts.append(combined)
                    text_set.add(combined)
                    semantic_set.add(semantic_hash)
    
    except Exception as e:
        print(f"Error processing text content: {e}")
    
    return extracted_texts

from fastapi.responses import StreamingResponse
import asyncio
from typing import AsyncGenerator

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

class FeedbackRequest(BaseModel):
    feedback: str

@app.post("/api/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Anonymous feedback submission endpoint"""
    try:
        feedback_text = request.feedback.strip()
        
        if not feedback_text:
            raise HTTPException(status_code=400, detail="Feedback cannot be empty")
        
        if len(feedback_text) > 1000:
            raise HTTPException(status_code=400, detail="Feedback is too long (max 1000 characters)")
        
        # Send email to admin
        RESEND_API_KEY = os.getenv("RESEND_API_KEY")
        admin_email = "thavasantonio@gmail.com"
        
        if RESEND_API_KEY:
            try:
                import requests
                from datetime import datetime
                
                # Use verified domain for from address (same as notification emails)
                from_email = "noreply@context-pack.com"
                
                response = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": f"Context Pack Feedback <{from_email}>",
                        "to": [admin_email],
                        "subject": f"💡 New Feedback/Feature Request - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                        "text": f"""New anonymous feedback received:
                        {feedback_text}

                        ---
                        Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
                        Source: Context Pack Website Feedback Banner
                        """
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    print(f"✅ Feedback email sent successfully to {admin_email}")
                    return {"success": True, "message": "Thank you for your feedback!"}
                else:
                    print(f"❌ Failed to send feedback email: {response.status_code} - {response.text}")
                    raise HTTPException(status_code=500, detail="Failed to send feedback")
                    
            except Exception as email_error:
                print(f"❌ Error sending feedback email: {email_error}")
                raise HTTPException(status_code=500, detail="Failed to send feedback")
        else:
            # Fallback: just log it if no email service configured
            print(f"💡 FEEDBACK (no email service): {feedback_text}")
            return {"success": True, "message": "Thank you for your feedback!"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error processing feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to process feedback")

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
        # Target: 100k tokens per chunk - maximize efficiency, minimize API calls
        # 128k context window - 2k prompt - 3k output = 123k available
        # Using 100k = plenty of headroom, half the API calls = half the cost
        max_tokens_per_chunk = 100000
        initial_chunk_size = 400000  # Start with ~100k tokens (4 chars/token average)
        overlap = 20000  # Overlap for context continuity
        
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
        failed_chunks_count = 0  # Track chunks that failed due to content policy
        
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
        
        # Determine scope for memory tree (before chunk loop)
        if MEMORY_TREE_ENABLED and MEMORY_TREE_AVAILABLE:
            scope = get_scope_for_source(source_id, filename, "")
            print(f"🎯 Memory tree scope: {scope}")
        else:
            scope = None  # Not using memory tree
        
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
                redacted_chunk = apply_redaction_filters(chunk)
                # Scenario A: Single Chunk - Extract all details (no summarization)
                if len(chunks) == 1:
                    prompt = f"""
You are an expert extraction system. Your job is to extract all unique, meaningful information from the document with maximum precision.

PRIMARY RULES:
1. Do NOT summarize.
2. Do NOT omit meaningful details.
3. Do NOT restate the same information twice. 
4. Do NOT include filler text, greetings, conversational fluff, or irrelevant lines.
5. Preserve exact values whenever they appear:
   (names, dates, values, terminology, labels, instructions, or precise descriptions).
6. If a detail seems important or specific, include it.

STEP 1 — Document Identification (1–2 sentences ONLY)
Identify what type of document this is (technical, design, business, personal, research, chat, etc.).

STEP 2 — Unique, Comprehensive Extraction
Extract every meaningful piece of information without changing its specificity.
Group related ideas together only for organization. Do NOT compress or combine ideas.

**Complete Unique Information Extract**
List all meaningful details found in the document. Include:
- Specific facts, values, descriptions, instructions
- Stated preferences, rules, constraints, or workflows
- Examples, scenarios, references
- Any other concrete, meaningful information

Ensure:
- No duplicates
- No summaries
- No omission of important details

**Context & Relationships**
Describe how extracted items relate to each other (if relationships exist).

Use only the information explicitly present in the document.

Document content:
{redacted_chunk}
"""
                # Scenario B: Conversations File - Text output for tree building
                elif "conversations" in filename.lower() or filename.lower().endswith('.json'):
                    prompt = f"""
Analyze this conversation segment and extract only persistent, high-level information about the user.

Focus on information that remains true across time, such as:
- User background (roles, interests, skills, identity, general profile)
- Long-term goals, ongoing activities, or recurring topics
- Preferences, habits, constraints, or stable patterns of behavior
- Any systems, tools, or environments the user consistently relies on
- Important facts that would help future conversations remain personalized and consistent

Ignore:
- Temporary actions or one-time tasks
- Small talk or conversational filler
- Emotional expressions tied only to the moment
- Anything not explicitly stated in the conversation

Output format:
1. High-level summary of the user
2. Stable facts and patterns
3. Long-term goals, activities, or responsibilities
4. Useful context for future conversations

Conversation content:
{redacted_chunk}
"""


                
                # Scenario C: Large Document (5+ chunks) - Broad analysis
                elif len(chunks) >= 5:
                    # Text-based analysis (legacy)
                    prompt = f"""
                    Analyze this section of a large document.

                    Your goal is to capture the high-level picture, not granular details.

                    Extract:
                    - Main themes and topics covered in this section
                    - Major concepts, arguments, or components
                    - How this section fits into the likely overall document
                    - Structural patterns (e.g., chapters, phases, modules, workflows)

                    Focus on clarity and breadth.  
                    Do not dive into micro-details—this is just one piece of a much larger whole.

                    Document content:
                    {redacted_chunk}
                    """

                else:
                    # Text-based analysis (legacy)
                    prompt = f"""
                    Analyze this document section with high precision. 
                    This is a small document, so details matter.

                    First figure out what this document could be about. Why would a user be interested in storing this document?
                    
                    Based on that reasoning extract information that would be relevent to that
                    Extract all key factual information:
                    - Important claims, data points, definitions, and steps
                    - Specific arguments or evidence presented
                    - Entities, roles, timelines, processes, or instructions
                    - Any meaningful detail that contributes to understanding

                    Do NOT summarize.
                    Do NOT generalize.
                    Preserve nuance and specificity.

                    Document content:
                    {redacted_chunk}
                    """

                # Build messages array
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
                
                print(f"DEBUG: Final messages count: {len(messages)}")
                
                response = await openai_call_with_retry(
                    openai_client,
                    max_retries=3,
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.3,
                    max_completion_tokens=3000  # Increased for richer analysis
                )
                
                analysis = response.choices[0].message.content
                
                
                # Check if OpenAI refused to analyze due to content policy
                if analysis and ("cannot assist" in analysis.lower() or "i'm sorry" in analysis.lower()[:50]):
                    raise Exception(f"Content policy refusal: OpenAI declined to analyze this content. This may occur with documents containing sensitive personal information.")
                
                # NEW: Parse JSON and apply to memory tree (if enabled)
                print(f"🔍 [DEBUG] Memory Tree Status: ENABLED={MEMORY_TREE_ENABLED}, AVAILABLE={MEMORY_TREE_AVAILABLE}")
                if MEMORY_TREE_ENABLED and MEMORY_TREE_AVAILABLE:
                    print(f"🌳 [TREE] Attempting to parse and apply chunk {idx+1} to memory tree (scope: {scope})")
                    try:
                        # Clean potential markdown wrapping
                        cleaned = analysis.strip()
                        if cleaned.startswith("```json"):
                            cleaned = cleaned[7:]
                        if cleaned.startswith("```"):
                            cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()
                        
                        # Try to parse as JSON
                        structured = json.loads(cleaned)
                        
                        # Apply to tree
                        from memory_tree import apply_chunk_to_memory_tree
                        apply_chunk_to_memory_tree(
                            structured_facts=structured,
                            scope=scope,
                            user=user,
                            pack_id=pack_id,
                            source_id=source_id,
                            chunk_index=idx
                        )
                        print(f"✅ [TREE] Successfully applied chunk {idx+1} to memory tree")
                        
                    except json.JSONDecodeError as e:
                        print(f"⚠️ [TREE] Failed to parse JSON from chunk {idx}: {e}")
                        # Continue with text-only storage
                    except Exception as e:
                        print(f"❌ [TREE] Failed to apply to tree for chunk {idx}: {e}")
                        import traceback
                        print(f"   Traceback: {traceback.format_exc()}")
                        # Continue with text-only storage
                else:
                    print(f"⚠️ [TREE] Memory tree is disabled or unavailable, skipping tree population")
                
                # Track tokens and cost
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                total_cost += (input_tokens * 0.00015 / 1000) + (output_tokens * 0.0006 / 1000)
                
                print(f"✅ Chunk {idx+1}/{len(chunks)} analyzed: {output_tokens} tokens out, {input_tokens} tokens in")
                
                # Convert JSON to human-readable text for pack download (if memory tree is enabled)
                display_analysis = analysis
                if MEMORY_TREE_ENABLED and MEMORY_TREE_AVAILABLE:
                    try:
                        # Try to parse as JSON and convert to readable format
                        cleaned = analysis.strip()
                        if cleaned.startswith("```json"):
                            cleaned = cleaned[7:]
                        if cleaned.startswith("```"):
                            cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()
                        
                        parsed_json = json.loads(cleaned)
                        
                        # Convert JSON to human-readable format
                        readable_parts = []
                        
                        # Handle different JSON structures based on scope
                        if "sections" in parsed_json and parsed_json["sections"]:
                            readable_parts.append("## Key Sections")
                            for section in parsed_json["sections"]:
                                readable_parts.append(f"\n### {section.get('title', 'Untitled')}")
                                if section.get('summary'):
                                    readable_parts.append(section['summary'])
                                if section.get('topics'):
                                    readable_parts.append(f"Topics: {', '.join(section['topics'])}")
                        
                        if "concepts" in parsed_json and parsed_json["concepts"]:
                            readable_parts.append("\n## Key Concepts")
                            for concept in parsed_json["concepts"]:
                                name = concept.get('name', 'Unknown')
                                definition = concept.get('definition', '')
                                category = concept.get('category', '')
                                readable_parts.append(f"\n**{name}**{f' ({category})' if category else ''}: {definition}")
                        
                        if "entities" in parsed_json and parsed_json["entities"]:
                            readable_parts.append("\n## Entities")
                            for entity in parsed_json["entities"]:
                                name = entity.get('name', 'Unknown')
                                entity_type = entity.get('type', '')
                                summary = entity.get('summary', '')
                                readable_parts.append(f"\n- **{name}**{f' ({entity_type})' if entity_type else ''}: {summary}")
                        
                        if "facts" in parsed_json and parsed_json["facts"]:
                            readable_parts.append("\n## Key Facts")
                            for fact in parsed_json["facts"]:
                                if isinstance(fact, dict):
                                    statement = fact.get('statement', str(fact))
                                    category = fact.get('category', '')
                                    readable_parts.append(f"- {statement}{f' [{category}]' if category else ''}")
                                else:
                                    readable_parts.append(f"- {fact}")
                        
                        # Handle user profile structure
                        if "identity" in parsed_json:
                            identity = parsed_json["identity"]
                            if identity.get('name') or identity.get('roles') or identity.get('background'):
                                readable_parts.append("## Identity")
                                if identity.get('name'):
                                    readable_parts.append(f"Name: {identity['name']}")
                                if identity.get('roles'):
                                    readable_parts.append(f"Roles: {', '.join(identity['roles'])}")
                                if identity.get('background'):
                                    readable_parts.append(f"Background: {', '.join(identity['background'])}")
                        
                        if "preferences" in parsed_json and parsed_json["preferences"]:
                            readable_parts.append("\n## Preferences")
                            for pref in parsed_json["preferences"]:
                                readable_parts.append(f"- {pref}")
                        
                        if "projects" in parsed_json and parsed_json["projects"]:
                            readable_parts.append("\n## Projects")
                            for project in parsed_json["projects"]:
                                name = project.get('name', 'Unnamed Project')
                                desc = project.get('description', '')
                                status = project.get('status', '')
                                readable_parts.append(f"\n**{name}**{f' ({status})' if status else ''}")
                                if desc:
                                    readable_parts.append(desc)
                        
                        if "skills" in parsed_json and parsed_json["skills"]:
                            readable_parts.append("\n## Skills")
                            readable_parts.append(", ".join(parsed_json["skills"]))
                        
                        if "goals" in parsed_json and parsed_json["goals"]:
                            readable_parts.append("\n## Goals")
                            for goal in parsed_json["goals"]:
                                readable_parts.append(f"- {goal}")
                        
                        if "constraints" in parsed_json and parsed_json["constraints"]:
                            readable_parts.append("\n## Constraints")
                            for constraint in parsed_json["constraints"]:
                                readable_parts.append(f"- {constraint}")
                        
                        # If we successfully converted, use the readable version
                        if readable_parts:
                            display_analysis = "\n".join(readable_parts)
                            print(f"📝 [TREE] Converted JSON to readable format ({len(display_analysis)} chars)")
                        else:
                            # Fallback: keep original if no content was extracted
                            print(f"⚠️ [TREE] JSON parsed but no content extracted, using original")
                    
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        # If JSON parsing fails, use original analysis text
                        print(f"⚠️ [TREE] Could not convert to readable format: {e}, using original")
                        pass
                
                # Append this chunk's analysis to files
                chunk_sep = f"\n\n--- Chunk {idx+1}/{len(chunks)} ---\n\n" if len(chunks) > 1 else "\n\n"
                
                # Append to pack file (use display_analysis which is human-readable)
                if idx == 0:
                    # First chunk - add source header
                    upload_to_r2(pack_analyzed_path, existing_pack_content + source_header + display_analysis)
                else:
                    current = download_from_r2(pack_analyzed_path) or ""
                    upload_to_r2(pack_analyzed_path, current + chunk_sep + display_analysis)
                
                # Append to individual source file (also use display_analysis)
                current_source = download_from_r2(analyzed_path, silent_404=True) or ""
                upload_to_r2(analyzed_path, current_source + chunk_sep + display_analysis)
                
                
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
                    failed_chunks_count += 1
                    # Save a placeholder for this chunk
                    error_analysis = f"[Chunk {idx+1} could not be analyzed due to content policy restrictions. This may occur with documents containing sensitive personal information like receipts, invoices, or official records.]"
                    current_source = download_from_r2(analyzed_path, silent_404=True) or ""
                    upload_to_r2(analyzed_path, current_source + f"\n\n--- Chunk {idx+1}/{len(chunks)} ---\n\n" + error_analysis)
                
                continue
        
        # Update source status to completed (whether full or partial analysis)
        # If user had limited credits, they successfully completed what they could afford
        # Add warning if some chunks failed due to content policy
        warning_message = None
        if failed_chunks_count > 0:
            warning_message = f"⚠️ {failed_chunks_count} chunk(s) could not be analyzed due to content policy restrictions. This may occur with documents containing sensitive personal information like receipts, invoices, or official records."
        
        supabase.rpc("update_source_status", {
            "user_uuid": user.user_id,
            "target_source_id": source_id,
            "status_param": "completed",
            "progress_param": 100,
            "total_chunks_param": len(all_chunks),  # Total chunks available in source
            "processed_chunks_param": len(chunks),   # Chunks actually analyzed
            "total_input_tokens_param": total_input_tokens,
            "total_output_tokens_param": total_output_tokens,
            "total_cost_param": total_cost,
            "error_message_param": warning_message  # Use error_message field for warning
        }).execute()
        
        if max_chunks is not None and len(chunks) < len(all_chunks):
            print(f"✅ Source {source_id} analyzed: {len(chunks)} of {len(all_chunks)} chunks (limited by available credits)")
        else:
            print(f"✅ Source {source_id} analyzed successfully")
        
        if failed_chunks_count > 0:
            print(f"⚠️  WARNING: {failed_chunks_count} chunk(s) failed due to content policy restrictions")
        
        # NEW: Build Memory Tree from analysis (if enabled)
        print(f"\n🔍 [DEBUG] Post-analysis tree building check: ENABLED={MEMORY_TREE_ENABLED}, AVAILABLE={MEMORY_TREE_AVAILABLE}")
        if MEMORY_TREE_ENABLED and MEMORY_TREE_AVAILABLE:
            try:
                # Update status to show tree is building
                supabase.rpc("update_source_status", {
                    "user_uuid": user.user_id,
                    "target_source_id": source_id,
                    "status_param": "building_tree",
                    "progress_param": 95
                }).execute()
                
                print(f"\n🌳 [MEMORY TREE] Starting second-pass tree extraction...")
                print(f"   Pack ID: {pack_id}")
                print(f"   Source ID: {source_id}")
                print(f"   Filename: {filename}")
                await build_tree_from_analysis(
                    pack_id=pack_id,
                    source_id=source_id,
                    filename=filename,
                    user=user,
                    max_tree_chunks=None  # Process all chunks by default
                )
                
                # Mark as fully completed after tree building
                supabase.rpc("update_source_status", {
                    "user_uuid": user.user_id,
                    "target_source_id": source_id,
                    "status_param": "completed",
                    "progress_param": 100
                }).execute()
                print(f"✅ [TREE] Second-pass tree extraction completed successfully")
                
            except Exception as tree_error:
                print(f"❌ [TREE] Tree building failed (non-fatal): {tree_error}")
                import traceback
                print(f"   Traceback: {traceback.format_exc()}")
                # Still mark as completed even if tree building fails
                supabase.rpc("update_source_status", {
                    "user_uuid": user.user_id,
                    "target_source_id": source_id,
                    "status_param": "completed",
                    "progress_param": 100
                }).execute()
        else:
            print(f"⚠️ [TREE] Skipping second-pass tree extraction (feature disabled or unavailable)")
        
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

# Second-pass tree building from analysis text

async def build_tree_from_analysis(
    pack_id: str,
    source_id: str,
    filename: str,
    user: AuthenticatedUser,
    max_tree_chunks: int | None = None
):
    """
    Second-pass Memory Tree extraction from completed analysis text.
   
    This runs AFTER analyze_source_chunks completes. It reads the
    high-quality narrative analysis and extracts structured facts into the tree.
   
    Args:
        pack_id: Pack identifier
        source_id: Source identifier
        filename: Original filename (for scope detection)
        user: Authenticated user
        max_tree_chunks: Optional limit on how many chunks to process (None = all)
    """
    print(f"\n🌳 [TREE EXTRACTION] Starting tree build for source {source_id}")
   
    # Load the analyzed text from R2
    analyzed_path = f"{user.r2_directory}/{pack_id}/{source_id}/analyzed.txt"
    try:
        analysis_text = download_from_r2(analyzed_path, silent_404=False)
    except Exception as e:
        print(f"❌ Failed to load analyzed text: {e}")
        return
   
    # Split into chunk sections
    # Format: "--- Chunk X/Y ---\n\nanalysis text"
    blocks = analysis_text.split("\n\n--- Chunk ")
   
    chunk_analyses = []
    for i, block in enumerate(blocks):
        if i == 0:
            # First block might not have separator if only 1 chunk
            if block.strip():
                chunk_analyses.append({"index": 0, "text": block.strip()})
        else:
           # Parse "X/Y ---\n\nanalysis"
            parts = block.split(" ---\n\n", 1)
            if len(parts) == 2:
                chunk_number_str = parts[0].split("/")[0]
                try:
                    chunk_num = int(chunk_number_str) - 1  #0-indexed
                    chunk_analyses.append({"index": chunk_num, "text": parts[1].strip()})
                except ValueError:
                    continue
   
    print(f"📦 Found {len(chunk_analyses)} chunk analyses to process")
   
    # Apply max_tree_chunks limit if specified
    if max_tree_chunks and len(chunk_analyses) > max_tree_chunks:
        chunk_analyses = chunk_analyses[:max_tree_chunks]
        print(f"   📏 Limited to {max_tree_chunks} chunks")
   
    # Determine scope for this source (filename passed from caller)
    scope = get_scope_for_source(source_id, filename, "")
   
    print(f"🎯 Scope: {scope}")
    
    # Get user_id for status updates
    user_id = user.user_id
   
    # Process each chunk analysis
    total_nodes = 0
    for chunk_idx, chunk_analysis in enumerate(chunk_analyses):
        idx = chunk_analysis["index"]
        text = chunk_analysis["text"]
       
        # Update progress
        tree_progress = 95 + int((chunk_idx / len(chunk_analyses)) * 4)  # 95-99%
        try:
            supabase.rpc("update_source_status", {
                "user_uuid": user_id,
                "target_source_id": source_id,
                "status_param": "building_tree",
                "progress_param": tree_progress
            }).execute()
        except:
            pass  # Don't fail if status update fails
       
        print(f"\n📝 Processing chunk {idx + 1}/{len(chunk_analyses)} (tree progress: {tree_progress}%)...")
       
        # Build tree extraction prompt
        if scope.startswith("knowledge:"):
            tree_prompt = f"""
You are turning a chunk of analysis into a structured "memory tree" representation.

The input is a human-readable analysis of a document. Based on this analysis, extract:

- sections: high-level topics or subtopics discussed
- events: concrete events mentioned (with dates or periods if present)
- entities: important people, organizations, or places
- concepts: key ideas, themes, or issues

Return STRICT JSON:

{{
  "sections": [
    {{
      "title": "string",
      "period": null,
      "summary": "string"
    }}
  ],
  "events": [
    {{
      "name": "string",
      "date_or_period": null,
      "summary": "string"
    }}
  ],
  "entities": [
    {{
      "name": "string",
      "type": "person | organization | place | other",
      "summary": "string"
    }}
  ],
  "concepts": ["string"]
}}

Rules:
- Extract as many useful sections/events/entities/concepts as the analysis supports.
- Be specific and detailed.
- Do NOT add commentary outside the JSON.
- Do NOT wrap in backticks or code blocks.
- Return ONLY valid JSON.

Analysis text:
{text}
"""
        else:  # user_profile scope
            tree_prompt = f"""
You are turning a conversation analysis into a structured "memory tree" representation.

The input is a human-readable analysis of conversations. Extract persistent information about the USER:

- identity: name, roles, background facts
- preferences: lasting preferences and constraints
- projects: ongoing projects and efforts
- skills: technical skills and expertise
- goals: stated goals or aspirations
- constraints: limitations or requirements
- facts: other persistent facts about the user

Return STRICT JSON:

{{
  "identity": {{
    "name": null,
    "roles": [],
    "background": []
  }},
  "preferences": ["string"],
  "projects": [
    {{
      "name": "string",
      "description": null,
      "status": null
    }}
  ],
  "skills": ["string"],
  "goals": ["string"],
  "constraints": ["string"],
  "facts": ["string"]
}}

Rules:
- Only include persistent, long-term information.
- Ignore temporary or one-off details.
- Do NOT add commentary.
- Do NOT wrap in backticks.
- Return ONLY valid JSON.

Analysis text:
{text}
"""
       
        # Call OpenAI for tree extraction
        try:
            response = await openai_call_with_retry(
                default_openai_client,
                max_retries=3,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You extract structured knowledge from analysis text."},
                    {"role": "user", "content": tree_prompt}
                ],
                temperature=0.2,
                max_completion_tokens=1500
            )
           
            tree_json_str = response.choices[0].message.content
           
            # Parse JSON
            try:
                # Clean up potential markdown formatting
                cleaned = tree_json_str.strip()
                if cleaned.startswith('```'):
                    lines = cleaned.split('\n')
                    cleaned = '\n'.join(lines[1:-1] if len(lines) > 2 else lines)
               
                structured = json.loads(cleaned)
                print(f"   ✅ Parsed JSON tree structure")
               
                # Apply to memory tree
                apply_chunk_to_memory_tree(
                    structured_facts=structured,
                    scope=scope,
                    user=user,
                    pack_id=pack_id,
                    source_id=source_id,
                    chunk_index=idx
                )
               
                # Count nodes (rough estimate)
                node_count = sum(len(v) if isinstance(v, list) else 1 for v in structured.values() if v)
                total_nodes += node_count
               
            except json.JSONDecodeError as e:
                print(f"   ⚠️ JSON parse error: {e}")
                print(f"   First 200 chars: {tree_json_str[:200]}")
               
        except Exception as e:
            print(f"   ❌ Tree extraction failed: {e}")
            continue
   
    print(f"\n🎉 Tree building complete: ~{total_nodes} nodes created from {len(chunk_analyses)} chunks")


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
    """Get user's profile including credit balance and actual usage statistics"""
    try:
        if not supabase:
            # Legacy mode - return default values
            return {
                "credits_balance": get_new_user_credits(),
                "can_process": True,
                "email": user.email if hasattr(user, 'email') else "unknown@example.com",
                "payment_plan": "legacy",
                "chunks_analyzed": 0
            }
        
        # Get user profile using database function
        result = supabase.rpc("get_user_profile_for_backend", {"user_uuid": user.user_id}).execute()
        
        if result.data:
            profile = result.data
            
            # Calculate actual chunks analyzed from credit transactions
            usage_result = supabase.from_("credit_transactions").select("credits").eq(
                "user_id", str(user.user_id)
            ).eq("transaction_type", "usage").execute()
            
            chunks_analyzed = 0
            if usage_result.data:
                # Sum up all usage transactions (they're negative, so we negate them)
                chunks_analyzed = abs(sum(t.get("credits", 0) for t in usage_result.data))
            
            return {
                "id": profile.get("id"),
                "credits_balance": profile.get("credits_balance", 0),
                "can_process": profile.get("payment_plan") == "unlimited" or profile.get("credits_balance", 0) > 0,
                "email": profile.get("email", "unknown@example.com"),
                "payment_plan": profile.get("payment_plan", "credits"),
                "chunks_analyzed": chunks_analyzed,
                "subscription_status": profile.get("subscription_status"),
                "plan_start_date": profile.get("plan_start_date"),
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
                    "id": profile.get("id"),
                    "credits_balance": profile.get("credits_balance", get_new_user_credits()),
                    "can_process": True,
                    "email": profile.get("email", "unknown@example.com"),
                    "payment_plan": profile.get("payment_plan", "credits"),
                    "chunks_analyzed": 0,
                    "subscription_status": profile.get("subscription_status"),
                    "plan_start_date": profile.get("plan_start_date"),
                    "created_at": profile.get("created_at"),
                    "updated_at": profile.get("updated_at")
                }
            else:
                # Fallback default
                return {
                    "credits_balance": get_new_user_credits(),
                    "can_process": True,
                    "email": getattr(user, 'email', "unknown@example.com"),
                    "payment_plan": "credits",
                    "chunks_analyzed": 0
                }
        
    except Exception as e:
        print(f"Error getting user profile: {e}")
        # Return safe defaults on error
        return {
            "credits_balance": 0,
            "can_process": False,
            "email": getattr(user, 'email', "unknown@example.com"),
            "payment_plan": "credits",
            "chunks_analyzed": 0,
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
    """List all v2 packs for user with aggregated statistics"""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Use RPC function with aggregated stats (bypasses RLS with SECURITY DEFINER)
        result = supabase.rpc("get_user_packs_v2_with_stats", {
            "user_uuid": user.user_id
        }).execute()
        
        if not result.data:
            return []
        
        # Transform the data to match expected format
        packs = []
        for pack in result.data:
            pack_data = {
                "pack_id": pack["pack_id"],
                "pack_name": pack["pack_name"],
                "description": pack.get("description"),
                "custom_system_prompt": pack.get("custom_system_prompt"),
                "total_sources": pack.get("total_sources", 0),
                "total_chunks": pack.get("total_chunks", 0),
                "processed_chunks": pack.get("processed_chunks", 0),
                "total_input_tokens": pack.get("total_input_tokens", 0),
                "total_output_tokens": pack.get("total_output_tokens", 0),
                "total_cost": float(pack.get("total_cost", 0)),
                "created_at": pack["created_at"],
                "last_updated": pack.get("updated_at"),
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
    text_content: Optional[str] = None

@app.post("/api/memory/add")
async def add_memory(request: AddMemoryRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Add a memory to the user's pack."""
    try:
        memory_text = request.text.strip()
        if not memory_text:
            raise HTTPException(status_code=400, detail="Memory text cannot be empty")
        
        # Define the path for the memories file
        memories_path = f"{user.r2_directory}/memories.txt"
        
        # Download existing memories (if any)
        existing_content = download_from_r2(memories_path, silent_404=True) or ""
        
        # Format the new memory entry
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        new_entry = f"\n\n--- Memory added via {request.source} on {timestamp} ---\n{memory_text}"
        
        # Append and upload
        updated_content = existing_content + new_entry
        success = upload_to_r2(memories_path, updated_content)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save memory to storage")
            
        return {
            "status": "success",
            "message": "Memory added successfully",
            "size": len(updated_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding memory: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add memory: {str(e)}")

@app.post("/api/v2/packs/{pack_id}/sources")
async def add_source_to_pack(
    pack_id: str, 
    file: UploadFile = File(None),  # Optional - either file OR url must be provided
    url: Optional[str] = Form(None),  # Optional - for shared conversation URLs
    text_content: Optional[str] = Form(None),  # Optional - for pasted text
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
            if not text_content and payload.text_content:
                text_content = payload.text_content
        
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
        
        elif text_content:
            # Handle pasted text
            print(f"DEBUG: Received pasted text content (length: {len(text_content)})")
            source_id = str(uuid.uuid4())
            source_type = "text"
            source_name = source_name or f"Pasted Text ({datetime.now().strftime('%I:%M:%S %p')})"
            
            # Create source record
            result = supabase.rpc("add_pack_source", {
                "user_uuid": user.user_id,
                "target_pack_id": pack_id,
                "target_source_id": source_id,
                "source_name_param": source_name,
                "source_type_param": source_type,
                "file_name_param": "pasted_text.txt",
                "file_size_param": len(text_content)
            }).execute()
            
            if not result.data or len(result.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create source record")
            
            # Start background extraction
            asyncio.create_task(extract_and_chunk_source(
                pack_id=pack_id,
                source_id=source_id,
                file_content=text_content,
                filename="pasted_text.txt",
                user=user
            ))
            
            return {
                "pack_id": pack_id,
                "source_id": source_id,
                "source_name": source_name,
                "status": "extracting",
                "message": "Pasted text added, processing started"
            }

        # Handle file-based sources 
        elif file:
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
        
        else:
            raise HTTPException(status_code=400, detail="Must provide file, url, or text_content")
        
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


@app.get("/api/v2/packs/{pack_id}/export/{export_type}")
async def download_pack_export_v2(
    pack_id: str, 
    export_type: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Download a pack export (compact/standard/complete/tree)"""
    try:
        if export_type not in ['compact', 'standard', 'complete', 'tree']:
            raise HTTPException(status_code=400, detail="Invalid export type")
        
        # Handle tree export (new Memory Tree-based export)
        if export_type == 'tree':
            if not MEMORY_TREE_ENABLED or not MEMORY_TREE_AVAILABLE:
                raise HTTPException(
                    status_code=400, 
                    detail="Memory Tree export is not available (MEMORY_TREE_ENABLED=false or module not loaded)"
                )
            
            try:
                # Generate pack from memory tree
                export_content = export_pack_from_tree(user.user_id, pack_id)
                
                return StreamingResponse(
                    iter([export_content.encode('utf-8')]),
                    media_type="text/plain",
                    headers={
                        "Content-Disposition": f"attachment; filename=tree_pack_{pack_id}.txt"
                    }
                )
            except Exception as tree_error:
                print(f"Error exporting from tree: {tree_error}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to export from memory tree: {str(tree_error)}"
                )
        
        # Original export logic for compact/standard/complete
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
                if not analyzed_path:
                    source_id = source.get("source_id")
                    analyzed_path = f"{user.r2_directory}/{pack_id}/{source_id}/analyzed.txt"
                
                print(f"Downloading analyzed content from: {analyzed_path}")
                if analyzed_path: # Still check in case source_id was also missing or path construction failed
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


"""
New API endpoint for Memory Tree Viewer
"""

@app.get("/api/v2/packs/{pack_id}/tree/nodes")
async def get_pack_tree_nodes(
    pack_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get all memory tree nodes for a pack, organized by scope and type.
    Returns structured data for the tree viewer UI.
    """
    try:
        # Query memory_nodes with evidence counts
        result = supabase.table("memory_nodes") \
            .select("*, memory_evidence(count)") \
            .eq("user_id", user.user_id) \
            .eq("pack_id", pack_id) \
            .order("scope", desc=False) \
            .order("node_type", desc=False) \
            .order("created_at", desc=False) \
            .execute()
        
        if not result.data:
            # No nodes found - tree might be disabled or not yet built
            return {
                "pack_id": pack_id,
                "pack_name": None,
                "scopes": {},
                "total_nodes": 0,
                "tree_available": False
            }
        
        # Get pack name using RPC function (bypasses RLS)
        pack_result = supabase.rpc("get_pack_details_v2", {
            "user_uuid": user.user_id,
            "target_pack_id": pack_id
        }).execute()
        
        # RPC returns a dict with pack details
        pack_name = "Unknown Pack"
        if pack_result.data:
            if isinstance(pack_result.data, dict):
                pack_name = pack_result.data.get("pack_name", "Unknown Pack")
            elif isinstance(pack_result.data, list) and len(pack_result.data) > 0:
                pack_name = pack_result.data[0].get("pack_name", "Unknown Pack")
        
        # Organize nodes by scope and type
        scopes = {}
        for node in result.data:
            scope = node["scope"]
            node_type = node["node_type"]
            
            if scope not in scopes:
                scopes[scope] = {}
            
            if node_type not in scopes[scope]:
                scopes[scope][node_type] = []
            
            # Format node data
            formatted_node = {
                "id": node["id"],
                "label": node.get("label"),
                "node_type": node_type,
                "data": node.get("data", {}),
                "created_at": node.get("created_at"),
                "updated_at": node.get("updated_at"),
                "evidence_count": len(node.get("memory_evidence", []))
            }
            
            scopes[scope][node_type].append(formatted_node)
        
        return {
            "pack_id": pack_id,
            "pack_name": pack_name,
            "scopes": scopes,
            "total_nodes": len(result.data),
            "tree_available": True
        }
        
    except Exception as e:
        print(f"Error fetching tree nodes for pack {pack_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tree nodes: {str(e)}")




@app.patch("/api/v2/nodes/{node_id}")
async def update_node(
    node_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Update node label and/or data fields.
    """
    try:
        body = await request.json()
        label = body.get("label")
        data = body.get("data")
        
        print(f"Updating node {node_id} for user {user.user_id}")
        print(f"Label: {label}")
        print(f"Data: {data}")
        
        # Build update dict
        update_dict = {}
        if label is not None:
            update_dict["label"] = label
        if data is not None:
            update_dict["data"] = data
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update node
        result = supabase.table("memory_nodes") \
            .update(update_dict) \
            .eq("id", node_id) \
            .eq("user_id", user.user_id) \
            .execute()
        
        print(f"Update result: {result.data}")
        
        if not result.data:
            # Try to check if node exists at all
            check_result = supabase.table("memory_nodes") \
                .select("id, user_id") \
                .eq("id", node_id) \
                .execute()
            
            if not check_result.data:
                raise HTTPException(status_code=404, detail="Node not found")
            else:
                raise HTTPException(status_code=403, detail="Node belongs to different user")
        
        return {"success": True, "node": result.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating node {node_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update node: {str(e)}")


@app.post("/api/v2/packs/{pack_id}/tree/nodes")
async def create_node(
    pack_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Create a new node manually in the memory tree.
    """
    try:
        body = await request.json()
        node_type = body.get("node_type")
        label = body.get("label")
        scope = body.get("scope", "user_profile")
        data = body.get("data", {})
        
        # Validate required fields
        if not node_type:
            raise HTTPException(status_code=400, detail="node_type is required")
        if not label:
            raise HTTPException(status_code=400, detail="label is required")
        
        # Validate node_type against allowed types
        allowed_types = [
            "Identity", "Preference", "Project", "Skill", "Goal", "Constraint", "Fact",
            "Section", "Event", "Entity", "Concept", "CodePattern"
        ]
        if node_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid node_type. Must be one of: {', '.join(allowed_types)}"
            )
        
        print(f"Creating node for pack {pack_id}, user {user.user_id}")
        print(f"Type: {node_type}, Label: {label}, Scope: {scope}")
        
        # Create node
        new_node = {
            "user_id": user.user_id,
            "pack_id": pack_id,
            "scope": scope,
            "node_type": node_type,
            "label": label,
            "data": data
        }
        
        result = supabase.table("memory_nodes").insert(new_node).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create node")
        
        print(f"Created node: {result.data[0]['id']}")
        
        return {"success": True, "node": result.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating node: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create node: {str(e)}")





@app.delete("/api/v2/nodes/{node_id}")
async def delete_node(
    node_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Delete a node and its associated evidence.
    """
    try:
        print(f"Deleting node {node_id} for user {user.user_id}")
        
        # First, delete associated evidence
        evidence_result = supabase.table("memory_evidence") \
            .delete() \
            .eq("node_id", node_id) \
            .eq("user_id", user.user_id) \
            .execute()
        
        print(f"Deleted {len(evidence_result.data or [])} evidence items")
        
        # Then delete the node
        result = supabase.table("memory_nodes") \
            .delete() \
            .eq("id", node_id) \
            .eq("user_id", user.user_id) \
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        
        print(f"Successfully deleted node {node_id}")
        return {"success": True, "deleted_node_id": node_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting node {node_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete node: {str(e)}")


@app.get("/api/v2/nodes/{node_id}/evidence")
async def get_node_evidence(
    node_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get evidence (source snippets) for a specific node.
    """
    try:
        result = supabase.table("memory_evidence") \
            .select("id, source_id, chunk_index, snippet, created_at") \
            .eq("user_id", user.user_id) \
            .eq("node_id", node_id) \
            .order("created_at", desc=False) \
            .execute()
        
        # Get source names separately
        evidence_list = []
        for ev in result.data or []:
            # Try to get source name
            source_name = None
            try:
                source_result = supabase.table("pack_sources") \
                    .select("file_name") \
                    .eq("source_id", ev["source_id"]) \
                    .single() \
                    .execute()
                source_name = source_result.data.get("file_name") if source_result.data else None
            except:
                # If permission denied or other error, just use None
                pass
            
            evidence_list.append({
                "id": ev["id"],
                "source_id": ev.get("source_id"),
                "source_name": source_name,
                "chunk_index": ev.get("chunk_index"),
                "snippet": ev.get("snippet"),
                "created_at": ev.get("created_at")
            })
        
        return {
            "node_id": node_id,
            "evidence": evidence_list,
            "count": len(evidence_list)
        }
        
    except Exception as e:
        print(f"Error fetching evidence for node {node_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch evidence: {str(e)}")

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
            'amount_total': 399 if unlimited else credits * 100,  # $4.99 for unlimited, $1 per credit
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

if __name__ == "__main__":
    import sys
    # Force unbuffered output
    
    print("🚀 Starting Simple UCP Backend with R2 Storage - 3 Step Process...", flush=True)
    print(f"📦 Using R2 bucket: {R2_BUCKET}", flush=True)
    print("📋 Steps: 1) Extract → 2) Chunk → 3) Analyze", flush=True)
    uvicorn.run("simple_backend:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
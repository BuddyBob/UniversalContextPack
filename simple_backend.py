from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
from datetime import datetime
import time
import warnings
from typing import List, Dict, Any, Optional

# Suppress SSL warnings for R2 storage
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from pathlib import Path
import tiktoken
from openai import OpenAI
import boto3
from botocore.config import Config
import jwt
import hashlib
import hmac
import unicodedata
import re
import requests
import traceback
from supabase import create_client, Client
from dotenv import load_dotenv
import stripe
from collections import defaultdict
from datetime import timedelta
import stripe

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



# Initialize Supabase client
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("Warning: Supabase credentials not found. Running in legacy mode.")
    supabase = None

app = FastAPI(title="Simple UCP Backend", version="1.0.0")

# CORS middleware - Configure allowed origins from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
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

# Request models
class AnalyzeRequest(BaseModel):
    selected_chunks: List[int] = None  # List of chunk numbers selected by user

class CreditPurchaseRequest(BaseModel):
    credits: int
    amount: float
    package_id: str = None

class StripePaymentIntentRequest(BaseModel):
    credits: int
    amount: float
    amount: float
    package_id: str = None

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
                
            return {"plan": "free", "chunks_used": 0, "chunks_allowed": 5, "can_process": True}
        
    except Exception as e:
        print(f"Error getting payment status: {e}")
        # Default to free plan
        return {"plan": "free", "chunks_used": 0, "chunks_allowed": 5, "can_process": True}

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
    """Update job status in Supabase"""
    
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
        
        # Extract processed_chunks from metadata for the enhanced function
        processed_chunks = None
        if metadata and status == "analyzed":
            processed_chunks = metadata.get("processed_chunks", 0)
        
        # Use enhanced backend function to update job status (with processed_chunks)
        result = supabase.rpc("update_job_status_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id,
            "status_param": status,
            "progress_param": progress,
            "error_message_param": error_message,
            "processed_chunks_param": processed_chunks
        }).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        else:
            return None
            
    except Exception as e:
        return None

async def create_pack_in_db(user: AuthenticatedUser, job_id: str, pack_name: str, r2_pack_path: str, extraction_stats: dict = None, chunk_stats: dict = None, analysis_stats: dict = None, file_size: int = None):
    """Create a pack record in Supabase"""
    
    if not supabase:
        print(f"❌ Supabase client not available for pack creation")
        return None
    
    try:
        print(f"🔄 Creating pack in database for job {job_id}...")
        
        # First check if the job exists using backend function
        job_check_result = supabase.rpc("check_job_exists_for_backend", {
            "user_uuid": user.user_id,
            "target_job_id": job_id
        }).execute()
        
        if not job_check_result.data or not job_check_result.data[0]["job_exists"]:
            print(f"❌ Job {job_id} does not exist in database - cannot create pack")
            return None
        else:
            job_status = job_check_result.data[0]["current_status"]
            print(f"✅ Job {job_id} exists with status: {job_status}")
        
        # Create pack using backend function
        print(f"🔄 Calling create_pack_for_backend with pack_name: {pack_name}")
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
            pack_data = result.data[0]
            print(f"✅ Pack successfully created in database:")
            print(f"   Pack ID: {pack_data.get('pack_id')}")
            print(f"   Pack Name: {pack_data.get('pack_name_out')}")
            print(f"   Job ID: {pack_data.get('pack_job_id')}")
            return pack_data
        else:
            print(f"❌ Pack creation returned no data: {result}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating pack in database: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return None
        import traceback
        print(f"Full error traceback: {traceback.format_exc()}")
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
    """Upload directly to R2 using requests with proper S3 auth"""
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
        
        # Make the request with HTTP and better Unicode handling
        try:
            # Clean the content of any surrogate characters before encoding
            import codecs
            # First, encode to bytes handling surrogates
            content_bytes = content.encode('utf-8', errors='ignore')
            # Then decode back to clean string
            clean_content = content_bytes.decode('utf-8')
            response = requests.put(url, data=clean_content.encode('utf-8'), headers=headers, verify=False, timeout=30)
        except UnicodeEncodeError as ue:
            print(f"Unicode encoding error: {ue}")
            # More aggressive cleaning for surrogate pairs
            import unicodedata
            clean_content = ''.join(char for char in content if unicodedata.category(char) != 'Cs')
            response = requests.put(url, data=clean_content.encode('utf-8'), headers=headers, verify=False, timeout=30)
        
        if response.status_code in [200, 201]:

            return True
        else:
            print(f"R2 upload failed: {response.status_code} - {response.text}")
            # Fallback to local storage
            local_path = f"local_storage/{key}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(content)
            return True
        
    except Exception as e:
        # Fallback to local storage
        try:
            local_path = f"local_storage/{key}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(content)
            return True
        except Exception as fallback_error:
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
    """Download content from R2 bucket."""
    try:
        # Try R2 first
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        

        
        # Prepare headers for GET request
        headers = {
            'Host': urlparse(R2_ENDPOINT).netloc
        }
        
        # Sign the request
        headers = sign_aws_request('GET', url, headers, '', R2_ACCESS_KEY, R2_SECRET_KEY)
        
        # Make the request with HTTP
        response = requests.get(url, headers=headers, verify=False, timeout=30)
        
        print(f"R2 response status: {response.status_code}")
        if response.status_code == 200:
            print(f"Successfully downloaded from R2: {key} ({len(response.text)} chars)")
            return response.text
        elif response.status_code == 404 and silent_404:
            # Silently return None for expected 404s (like new process.log files)
            return None
        else:
            if not silent_404:
                print(f"R2 download failed ({response.status_code}): {response.text}")
                print(f"R2 download failed ({response.status_code}), trying local storage...")
                # Fall back to local storage only if not silent
                local_path = f"local_storage/{key}"
                with open(local_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
                return content
            else:
                # Silent mode - don't fall back to local storage
                return None
            
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
                print(f"Error downloading from local storage: {local_error}")
                return None
        else:
            # Silent mode - don't fall back to local storage
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

def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    try:
        return len(encoder.encode(text))
    except Exception:
        return len(text) // 4

import re

def is_meaningful_text(text: str) -> bool:
    """Check if text is meaningful conversation content - enhanced version from universal_text_extractor.py"""
    if not isinstance(text, str):
        return False
    
    # Clean and normalize
    text = text.strip()
    
    # Skip if too short or empty
    if len(text) < 3:
        return False
    
    # Skip if it's mostly/all numbers, UUIDs, timestamps, or technical strings
    if re.match(r'^[\d\-\s\.]+$', text):  # Just numbers, dashes, spaces, dots
        return False
    
    if re.match(r'^[a-f0-9\-]{8,}$', text, re.IGNORECASE):  # UUIDs or hex
        return False
    
    # Skip URLs, file paths, technical identifiers
    technical_patterns = [
        'http://', 'https://', '.com', '.org', '.net', '.json', '.txt', '.py',
        'client-created', 'message_type', 'model_slug', 'gpt-', 'claude-',
        'request_id', 'timestamp_', 'content_type', 'conversation_id',
        'finished_successfully', 'absolute', 'metadata', 'system',
        'user_editable_context', 'is_visually_hidden', 'role:', 'author:',
        'create_time', 'update_time', 'parent_id', 'children', 'mapping',
        'finish_details', 'stop_tokens', 'citations', 'content_references', 'file-service://'
    ]
    
    if any(pattern in text.lower() for pattern in technical_patterns):
        return False
    
    # Must contain some actual letters (not just symbols/numbers)
    if not re.search(r'[a-zA-Z]', text):
        return False
    
    # Skip very short single words unless they're meaningful
    if len(text.split()) == 1 and len(text) < 8:
        return False
    
    # Skip common JSON structural elements
    if text.lower() in ['true', 'false', 'null', 'user', 'assistant', 'system', 'all']:
        return False
    
    return True

def extract_text_from_structure(obj: Any, extracted_texts=None, depth=0, progress_callback=None, total_items=None, current_item=None, seen_objects=None) -> List[str]:
    """Recursively extract meaningful text from any data structure - enhanced version from universal_text_extractor.py"""
    if extracted_texts is None:
        extracted_texts = []
    
    if seen_objects is None:
        seen_objects = set()
    
    # Prevent infinite recursion - more aggressive limit
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
            # Look for common text-containing keys first
            text_keys = ['parts', 'content', 'text', 'message', 'body', 'data', 'value', 'title', 'response']
            for key in text_keys:
                if key in obj:
                    extract_text_from_structure(obj[key], extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects)
            
            # Then check all other keys (increased limit for comprehensive extraction)
            processed = 0
            for key, value in obj.items():
                if key not in text_keys and processed < 500:  # Increased from 100 to 500
                    extract_text_from_structure(value, extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects)
                    processed += 1
                    
        elif isinstance(obj, list):
            # Increased list processing for comprehensive extraction
            for i, item in enumerate(obj[:5000]):  # Increased from 1000 to 5000 items
                if progress_callback and len(obj) > 100:  # Report progress for any large list, not just depth 0
                    # Update progress for large list items
                    progress = (i + 1) / min(len(obj), 5000) * 100
                    progress_callback(f"Processing item {i+1}/{min(len(obj), 5000)} ({progress:.1f}%)")
                extract_text_from_structure(item, extracted_texts, depth + 1, progress_callback, total_items, current_item, seen_objects)
                
        elif isinstance(obj, str):
            if is_meaningful_text(obj):
                # Handle unicode escapes and surrogates more safely
                cleaned_text = obj
                try:
                    # Only decode if it actually contains unicode escape sequences
                    if '\\u' in obj:
                        cleaned_text = obj.encode('utf-8').decode('unicode_escape')
                except:
                    # If unicode decoding fails, just use the original text
                    cleaned_text = obj
                
                # Clean up whitespace and handle encoding issues more aggressively
                try:
                    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
                    # Remove surrogate characters that cause encoding issues
                    import unicodedata
                    cleaned_text = ''.join(char for char in cleaned_text if unicodedata.category(char) != 'Cs')
                    # Test if we can encode this text safely
                    cleaned_text.encode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    # If there are encoding issues, clean the text more aggressively
                    cleaned_text = ''.join(char for char in cleaned_text if ord(char) < 65536 and ord(char) not in range(0xD800, 0xE000))
                    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
                
                if cleaned_text not in extracted_texts and is_meaningful_text(cleaned_text):
                    extracted_texts.append(cleaned_text)
    
    finally:
        # Remove from seen objects when done (for dict/list only)
        if isinstance(obj, (dict, list)) and obj_id in seen_objects:
            seen_objects.discard(obj_id)
    
    return extracted_texts

def extract_from_text_content(file_content: str) -> List[str]:
    """Extract meaningful text from plain text content - enhanced version from universal_text_extractor.py"""
    extracted_texts = []
    
    try:
        # Try to detect if it's actually structured data in text format
        if file_content.strip().startswith('{') or file_content.strip().startswith('['):
            try:
                data = json.loads(file_content)
                return extract_text_from_structure(data)
            except:
                pass  # Continue with text processing
        
        # Split by common delimiters and patterns
        chunks = re.split(r'\n\s*\n|\r\n\s*\r\n|\.{3,}|---+|\*{3,}', file_content)
        
        for chunk in chunks:
            lines = chunk.strip().split('\n')
            for line in lines:
                cleaned_line = line.strip()
                # Remove common prefixes like timestamps, usernames, etc.
                cleaned_line = re.sub(r'^\[\d{4}-\d{2}-\d{2}.*?\]', '', cleaned_line)
                cleaned_line = re.sub(r'^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?', '', cleaned_line, re.IGNORECASE)
                cleaned_line = re.sub(r'^[A-Za-z]+:', '', cleaned_line)  # Remove "User:", "Assistant:", etc.
                cleaned_line = cleaned_line.strip()
                
                if is_meaningful_text(cleaned_line):
                    if cleaned_line not in extracted_texts:
                        extracted_texts.append(cleaned_line)
    
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

@app.post("/api/extract")
async def extract_text(file: UploadFile = File(...), current_user: AuthenticatedUser = Depends(get_current_user)):
    """Step 1: Extract meaningful text from file - returns job_id immediately and processes in background."""
    try:
        job_id = str(uuid.uuid4())
        
        print(f"Starting text extraction for job {job_id} (user: {current_user.email})")
        print(f"Extracting text from {file.filename}")
        
        # Create job in database
        await create_job_in_db(
            current_user, 
            job_id, 
            file.filename, 
            len(await file.read()),  # Get file size
            "extracting"
        )
        
        # Reset file pointer after reading for size
        await file.seek(0)
        
        # Initialize progress
        update_job_progress(job_id, "extracting", 0, "Starting text extraction...")
        
        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')
        
        # Start background processing with user context
        asyncio.create_task(process_extraction_background(job_id, file_content, file.filename, current_user))
        
        # Return immediately so frontend can start polling
        return {
            "job_id": job_id,
            "status": "processing",
            "message": "Text extraction started. Use the job_id to poll for progress."
        }
        
    except Exception as e:
        print(f"Error starting text extraction: {e}")
        # Update job status as failed if created
        try:
            await update_job_status_in_db(current_user, job_id, "failed", error_message=str(e))
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to start extraction: {str(e)}")

async def process_extraction_background(job_id: str, file_content: str, filename: str, user: AuthenticatedUser):
    """Background task for processing text extraction with progress updates and timing."""
    extraction_start_time = time.time()
    extracted_texts = []
    conversations_count = 0
    messages_count = 0
    
    try:
        await update_job_status_in_db(user, job_id, "processing", 10, metadata={"step": "parsing_content"})
        
        file_size_bytes = len(file_content.encode('utf-8'))
        print(f"Starting extraction timing for {filename} ({file_size_bytes} bytes)")
        
        try:
            # Try parsing as JSON first
            json_data = json.loads(file_content)
            print("Processing JSON data structure...")
            update_job_progress(job_id, "extracting", 20, "Processing JSON data structure...")
            
            def progress_callback(message):
                print(f"Progress callback called: {message}")
                # Parse progress from message like "Processing item 500/1000 (50.0%)"
                if "Processing item" in message and "%" in message:
                    try:
                        percent_part = message.split("(")[1].split("%")[0]
                        percent = float(percent_part)
                        # Get current item number for batch updates
                        item_part = message.split("Processing item ")[1].split("/")[0]
                        item_num = int(item_part)
                        
                        # Send update every 25 items OR every 1% progress OR at major milestones
                        if (item_num % 25 == 0 or 
                            int(percent) != int(getattr(progress_callback, 'last_percent', 0)) or 
                            percent >= 99.0 or 
                            item_num == 1):
                            # Scale from 20% to 80% (extraction phase)
                            scaled_progress = 20 + (percent * 0.6)
                            print(f"Updating progress: {scaled_progress}% - {message}")
                            update_job_progress(job_id, "extracting", scaled_progress, message)
                            progress_callback.last_percent = percent
                    except Exception as e:
                        print(f"Progress parsing error: {e}")
                        # Fallback for any parsing errors
                        update_job_progress(job_id, "extracting", 50, message)
                else:
                    print(f"Non-item progress message: {message}")
                    update_job_progress(job_id, "extracting", 50, message)
            
            extracted_texts = extract_text_from_structure(json_data, progress_callback=progress_callback)
            
            # Count conversations and messages if this is WhatsApp/Telegram data
            if isinstance(json_data, dict):
                if 'messages' in json_data:
                    messages_count = len(json_data.get('messages', []))
                    conversations_count = 1
                elif 'chats' in json_data:
                    conversations_count = len(json_data.get('chats', []))
                    for chat in json_data.get('chats', []):
                        if isinstance(chat, dict) and 'messages' in chat:
                            messages_count += len(chat.get('messages', []))
            elif isinstance(json_data, list):
                # Handle array of conversations
                conversations_count = len(json_data)
                for item in json_data:
                    if isinstance(item, dict) and 'messages' in item:
                        messages_count += len(item.get('messages', []))
                        
        except json.JSONDecodeError:
            # Fallback to text processing using enhanced function
            print("Processing as text content...")
            update_job_progress(job_id, "extracting", 30, "Processing as text content...")
            extracted_texts = extract_from_text_content(file_content)
            # For text files, estimate conversations and messages
            conversations_count = len(extracted_texts) // 10  # Rough estimate
            messages_count = len(extracted_texts)

        # Calculate extraction timing
        extraction_end_time = time.time()
        extraction_duration = extraction_end_time - extraction_start_time
        
        if not extracted_texts:
            update_job_progress(job_id, "extracting", 0, "Error: No meaningful text found in file")
            return

        print(f"Extracted {len(extracted_texts)} meaningful text entries in {extraction_duration:.2f} seconds")
        
        # Create and log extraction timing
        extraction_metrics = calculate_extraction_metrics(
            file_size_bytes, extraction_duration, conversations_count, messages_count
        )
        
        extraction_timing = ExtractionTiming(
            file_name=filename,
            file_size_bytes=file_size_bytes,
            file_size_mb=extraction_metrics['file_size_mb'],
            extraction_start_time=extraction_start_time,
            extraction_end_time=extraction_end_time,
            extraction_duration_seconds=extraction_duration,
            conversations_extracted=conversations_count,
            messages_extracted=messages_count,
            extraction_rate_mb_per_second=extraction_metrics['extraction_rate_mb_per_second'],
            extraction_rate_conversations_per_second=extraction_metrics['extraction_rate_conversations_per_second'],
            timestamp=datetime.now().isoformat()
        )
        
        performance_timer.log_extraction_timing(extraction_timing)
        
        update_job_progress(job_id, "extracting", 80, f"Extracted {len(extracted_texts)} meaningful text entries")

        # Save extracted text to R2
        print("Saving extracted text to storage...")
        print(f"First few texts: {[text[:50] + '...' if len(text) > 50 else text for text in extracted_texts[:3]]}")
        update_job_progress(job_id, "extracting", 85, "Saving extracted text to storage...")
        
        # Limit the content size to prevent memory issues - increased limits for comprehensive extraction
        max_texts = 100000  # Increased from 50,000
        limited_texts = extracted_texts[:max_texts]
        
        # Create content with larger size limits for comprehensive extraction
        extracted_content_parts = []
        total_size = 0
        max_size = 200 * 1024 * 1024  # Increased to 200MB limit
        
        for i, text in enumerate(limited_texts):
            part = f"{i+1}. {text[:8000]}"  # Increased from 2000 to 8000 chars per text
            if total_size + len(part) > max_size:
                break
            extracted_content_parts.append(part)
            total_size += len(part)
        
        extracted_content = '\n\n'.join(extracted_content_parts)
        print(f"Created content of {len(extracted_content)} characters from {len(extracted_content_parts)} texts")
        
        print("=== CALLING UPLOAD FUNCTION ===")
        update_job_progress(job_id, "extracting", 90, "Uploading to R2 storage...")
        upload_success = upload_to_r2(f"{user.r2_directory}/{job_id}/extracted.txt", extracted_content)
        
        if not upload_success:
            print("Upload failed, setting error status")
            update_job_progress(job_id, "extracting", 0, "Error: Failed to save extracted text to storage")
            return
        
        print("Upload successful, proceeding...")
        update_job_progress(job_id, "extracted", 100, "Text extraction completed successfully")
        
        # Create job summary for better organization - include timing data
        job_summary = {
            "job_id": job_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "extracted",
            "extracted_count": len(extracted_texts),
            "content_size": len(extracted_content),
            "preview": extracted_texts[:3] if len(extracted_texts) > 3 else extracted_texts,
            "extraction_timing": {
                "duration_seconds": extraction_duration,
                "file_size_mb": extraction_metrics['file_size_mb'],
                "extraction_rate_mb_per_second": extraction_metrics['extraction_rate_mb_per_second'],
                "conversations_extracted": conversations_count,
                "messages_extracted": messages_count
            }
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/job_summary.json", json.dumps(job_summary, indent=2))
        
        
    except Exception as e:
        print(f"Error in background extraction for job {job_id}: {e}")
        update_job_progress(job_id, "extracting", 0, f"Error: {str(e)}")

# Legacy endpoint response format - add a status endpoint to get final results
@app.get("/api/results/{job_id}")
async def get_extraction_results(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get final extraction results after background processing completes."""
    try:
        # Check if extracted
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
            return {
                "status": "completed",
                "extracted": True,
                "chunked": True,
                "analyzed": True,
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

@app.post("/api/estimate-time")
async def estimate_processing_time(
    file: UploadFile = File(...),
    chunks_to_analyze: Optional[int] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Estimate processing time for a file upload based on file size and historical data."""
    try:
        # Read file size without processing the entire file
        content = await file.read()
        file_size_bytes = len(content)
        
        # Get comprehensive time estimates
        estimates = get_time_estimates(file_size_bytes, chunks_to_analyze)
        
        return {
            "file_name": file.filename,
            "file_size_bytes": file_size_bytes,
            "file_size_mb": estimates["file_info"]["size_mb"],
            "estimated_total_chunks": estimates["file_info"]["estimated_total_chunks"],
            "chunks_to_analyze": estimates["file_info"]["chunks_to_analyze"],
            "time_estimates": {
                "extraction": {
                    "seconds": round(estimates["extraction"]["seconds"], 1),
                    "formatted": estimates["extraction"]["formatted"],
                    "description": "Time to extract and process text from file"
                },
                "analysis": {
                    "seconds": round(estimates["analysis"]["seconds"], 1),
                    "formatted": estimates["analysis"]["formatted"],
                    "description": f"Time to analyze {estimates['file_info']['chunks_to_analyze']} chunks with AI"
                },
                "total": {
                    "seconds": round(estimates["total"]["seconds"], 1),
                    "formatted": estimates["total"]["formatted"],
                    "description": "Total estimated processing time"
                }
            },
            "note": "Estimates based on historical performance data. Actual times may vary depending on file complexity and server load."
        }
        
    except Exception as e:
        print(f"Error estimating processing time: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to estimate time: {str(e)}")

@app.get("/api/estimate-time/{job_id}")
async def estimate_job_processing_time(
    job_id: str, 
    chunks_to_analyze: Optional[int] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Estimate remaining processing time for an existing job."""
    try:
        # Get chunks metadata to determine file size and chunk count
        chunks_metadata = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        if not chunks_metadata:
            raise HTTPException(status_code=404, detail="Job chunks metadata not found")
            
        metadata = json.loads(chunks_metadata)
        total_chunks_available = metadata.get("total_chunks", 0)
        
        # If no specific chunk count provided, estimate for all chunks
        if chunks_to_analyze is None:
            chunks_to_analyze = total_chunks_available
            
        # Get analysis time estimate (extraction already done)
        from time_estimator import time_estimator
        analysis_estimates = time_estimator.estimate_analysis_time(chunks_to_analyze)
        
        return {
            "job_id": job_id,
            "total_chunks_available": total_chunks_available,
            "chunks_to_analyze": chunks_to_analyze,
            "time_estimates": {
                "analysis": {
                    "seconds": round(analysis_estimates["seconds"], 1),
                    "formatted": analysis_estimates["formatted"],
                    "description": f"Time to analyze {chunks_to_analyze} chunks with AI"
                }
            },
            "note": "Extraction already completed. Estimate is for analysis phase only."
        }
        
    except Exception as e:
        print(f"Error estimating job processing time: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to estimate time: {str(e)}")

@app.post("/api/estimate-chunking-time")
async def estimate_chunking_time(
    request_data: dict,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Estimate chunking time based on extracted text length."""
    try:
        text_length = request_data.get("text_length", 0)
        job_id = request_data.get("job_id")
        
        if text_length <= 0:
            raise HTTPException(status_code=400, detail="Valid text_length required")
            
        from time_estimator import time_estimator
        chunking_estimates = time_estimator.estimate_chunking_time(text_length)
        
        return {
            "job_id": job_id,
            "text_length": text_length,
            "chunking_time": {
                "seconds": round(chunking_estimates["seconds"], 1),
                "formatted": chunking_estimates["formatted"],
                "description": f"Time to chunk {chunking_estimates['text_size_mb']:.1f}MB of text"
            },
            "estimated_chunks": chunking_estimates["estimated_chunks"],
            "note": "Estimate based on text processing speed. Actual chunking may vary."
        }
        
    except Exception as e:
        print(f"Error estimating chunking time: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to estimate chunking time: {str(e)}")

@app.get("/api/job-summary/{job_id}")
async def get_job_summary(
    job_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get job summary with extraction details including text length."""
    try:
        # Get job summary from R2
        job_summary_data = download_from_r2(f"{user.r2_directory}/{job_id}/job_summary.json")
        if not job_summary_data:
            raise HTTPException(status_code=404, detail="Job summary not found")
            
        summary = json.loads(job_summary_data)
        return summary
        
    except Exception as e:
        print(f"Error getting job summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get job summary: {str(e)}")

@app.post("/api/chunk/{job_id}")
async def chunk_text(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Step 2: Create chunks from extracted text."""
    try:
        print(f"Starting chunking for job {job_id} for user {user.user_id}")
        # Remove redundant update_progress calls - use only update_job_progress
        update_job_progress(job_id, "chunking", 0, "Creating semantic chunks...")
        
        # Download extracted text from R2 using user directory
        extracted_content = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt")
        if not extracted_content:
            raise HTTPException(status_code=404, detail="Extracted text not found")
        
        # Chunk the text with reduced token limit to stay under OpenAI rate limits
        max_tokens = 150000  # Reduced from 200,000 to 150,000 to stay well under 200k limit
        chunks = []
        
        # Split by conversation entries
        conversations = extracted_content.split('\n\n')
        
        current_chunk = []
        current_tokens = 0
        total_conversations = len(conversations)
        
        # Update progress less frequently for better performance
        update_job_progress(job_id, "chunking", 20, f"Processing {total_conversations} conversations...")
        
        # Update progress only every 500 conversations or at end (reduce frequency)
        for i, conv in enumerate(conversations):
            # Update progress less frequently for performance
            print(f"Chunking conversation {i+1}/{total_conversations}...")
            if i % 500 == 0 or i == total_conversations - 1:
                progress_percent = 20 + (i / total_conversations * 60)  # 20% to 80%
                update_job_progress(job_id, "chunking", progress_percent, f"Processing conversation {i+1}/{total_conversations}")
            
            conv = conv.strip()
            if not conv:
                continue
                
            conv_tokens = count_tokens(conv)
            
            if conv_tokens > max_tokens:
                # Save current chunk
                if current_chunk:
                    chunks.append('\n\n'.join(current_chunk))
                    current_chunk = []
                    current_tokens = 0
                
                # Split large conversation
                words = conv.split(' ')
                temp_chunk = []
                temp_tokens = 0
                
                for word in words:
                    word_tokens = count_tokens(word)
                    if temp_tokens + word_tokens > max_tokens:
                        if temp_chunk:
                            chunks.append(' '.join(temp_chunk))
                        temp_chunk = [word]
                        temp_tokens = word_tokens
                    else:
                        temp_chunk.append(word)
                        temp_tokens += word_tokens
                
                if temp_chunk:
                    chunks.append(' '.join(temp_chunk))
            
            elif current_tokens + conv_tokens > max_tokens:
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = [conv]
                current_tokens = conv_tokens
            else:
                current_chunk.append(conv)
                current_tokens += conv_tokens
        
        # Add final chunk
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        update_job_progress(job_id, "chunking", 80, f"Created {len(chunks)} chunks, saving to storage...")
        
        # Save chunks to R2 - reduce progress update frequency
        chunk_info = []
        for i, chunk in enumerate(chunks):
            # Update progress only every 10 chunks or last chunk for better performance
            if i % 10 == 0 or i == len(chunks) - 1:
                progress_percent = 80 + ((i + 1) / len(chunks) * 15)  # 80% to 95%
                update_job_progress(job_id, "chunking", progress_percent, f"Uploading chunk {i+1}/{len(chunks)}")
            
            upload_to_r2(f"{user.r2_directory}/{job_id}/chunk_{i+1:03d}.txt", chunk)
            chunk_info.append({
                "chunk_number": i + 1,
                "token_count": count_tokens(chunk),
                "preview": chunk[:200] + "..." if len(chunk) > 200 else chunk
            })
        
        update_job_progress(job_id, "chunking", 95, "Saving chunk metadata...")
        
        # Save chunk metadata
        chunk_metadata = {
            "job_id": job_id,
            "total_chunks": len(chunks),
            "chunks": chunk_info,
            "chunked_at": datetime.utcnow().isoformat(),
            "max_tokens_per_chunk": max_tokens
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json", json.dumps(chunk_metadata, indent=2))
        
        # Update job summary - combine into single operation for efficiency
        job_summary = {
            "job_id": job_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "chunked",
            "total_chunks": len(chunks),
            "chunked_at": datetime.utcnow().isoformat()
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/job_summary.json", json.dumps(job_summary, indent=2))
        
        update_job_progress(job_id, "chunked", 100, f"Chunking complete! Created {len(chunks)} chunks ready for analysis", total_chunks=len(chunks))
        
        # Add time estimates for different chunk selections
        time_estimates = {}
        common_selections = [1, 3, 5, 10, len(chunks)]  # Common chunk selections
        for chunk_count in common_selections:
            if chunk_count <= len(chunks):
                estimates = time_estimator.estimate_analysis_time(chunk_count)
                time_estimates[f"{chunk_count}_chunks"] = {
                    "chunks": chunk_count,
                    "seconds": round(estimates["seconds"], 1),
                    "formatted": estimates["formatted"]
                }
        
        return {
            "job_id": job_id,
            "status": "chunked",
            "total_chunks": len(chunks),
            "chunks": chunk_info,
            "time_estimates": time_estimates
        }
        
    except Exception as e:
        print(f" Error chunking text: {e}")
        raise HTTPException(status_code=500, detail=f"Chunking failed: {str(e)}")

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
                "credits_balance": 5,
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
                "can_process": profile.get("credits_balance", 0) > 0,
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
                    "credits_balance": profile.get("credits_balance", 5),
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
                    "credits_balance": 5,
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

@app.post("/api/analyze/{job_id}")
async def analyze_chunks(job_id: str, request: AnalyzeRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Step 3: Analyze chunks with AI - with payment limits and timing."""
    try:
        
        # Check payment status and limits FIRST
        payment_status = await get_user_payment_status(user.user_id)
        
        # Get chunk metadata to see how many chunks we have
        chunk_metadata_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        print(chunk_metadata_content)
        if not chunk_metadata_content:
            raise HTTPException(status_code=404, detail="Chunk metadata not found")
        
        chunk_metadata = json.loads(chunk_metadata_content)
        total_chunks = chunk_metadata["total_chunks"]
        
        # Credit-based system only: check available credits
        available_credits = payment_status.get("credits_balance", 0)
        
        # Get user's selection from the request
        selected_chunks = request.selected_chunks if request.selected_chunks else []
        
        # Determine chunks to process based on user selection and credits
        if selected_chunks:
            # User selected specific chunks (convert from 0-based to 1-based indexing)
            selected_chunks_1_based = [chunk + 1 for chunk in selected_chunks]
            requested_chunks = len(selected_chunks_1_based)
            chunks_to_process = min(available_credits, requested_chunks)
            actual_chunks_to_process = selected_chunks_1_based[:chunks_to_process]
        else:
            # No selection - process as many as credits allow
            chunks_to_process = min(available_credits, total_chunks)
            actual_chunks_to_process = list(range(1, chunks_to_process + 1))
        
        print(f"🔍 ANALYSIS DEBUG:")
        print(f"   Available credits: {available_credits}")
        print(f"   Total chunks found: {total_chunks}")
        print(f"   User selected chunks (0-based): {selected_chunks}")
        print(f"   Chunks to process: {chunks_to_process}")
        print(f"   Actual chunks to process (1-based): {actual_chunks_to_process}")
        print(f"   Job ID: {job_id}")
        
        if chunks_to_process <= 0:
            return {
                "job_id": job_id,
                "status": "limit_reached", 
                "message": "No credits available. Purchase credits to analyze chunks.",
                "credits_balance": available_credits,
                "total_chunks": total_chunks,
                "upgrade_required": True
            }
        
        # Start background analysis with timing
        asyncio.create_task(process_analysis_background(job_id, chunks_to_process, total_chunks, user, payment_status, actual_chunks_to_process))
        
        return {
            "job_id": job_id,
            "status": "processing",
            "message": "Analysis started. Use the job_id to poll for progress.",
            "chunks_to_process": chunks_to_process,
            "selected_chunks": actual_chunks_to_process,
            "total_chunks": total_chunks
        }
        
    except Exception as e:
        print(f"Error starting analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")

async def process_analysis_background(job_id: str, chunks_to_process: int, total_chunks: int, user: AuthenticatedUser, payment_status: dict, selected_chunk_numbers: List[int]):
    """Background task for processing chunk analysis with comprehensive timing."""
    analysis_start_time = time.time()
    chunk_timings = []
    
    print(f"🚀 STARTING BACKGROUND ANALYSIS:")
    print(f"   Job ID: {job_id}")
    print(f"   Chunks to process: {chunks_to_process}")
    print(f"   Selected chunk numbers: {selected_chunk_numbers}")
    print(f"   Total chunks available: {total_chunks}")
    print(f"   User: {user.email}")
    
    try:
        # Get OpenAI client (will automatically use current server API key)
        openai_client = get_openai_client()
        
        ucp_prompt = """Analyze this conversation data and extract ALL unique facts to build a Universal Context Pack (UCP). Provide extremely detailed analysis in these categories:

1. PERSONAL PROFILE - Demographics, preferences, lifestyle, goals, values
2. BEHAVIORAL PATTERNS - Communication style, problem-solving, learning patterns  
3. KNOWLEDGE DOMAINS - Technical skills, expertise areas, proficiency levels
4. PROJECT PATTERNS - Workflow preferences, tools, methodologies
5. TIMELINE EVOLUTION - Development over time, milestones, growth
6. INTERACTION INSIGHTS - Communication preferences, response styles

Be extremely detailed with direct quotes and examples. Extract every unique fact, preference, skill, and behavioral pattern.

Conversation data:

"""
        
        results = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_cost = 0.0
        failed_chunks = []
        
        # Process only the selected chunks
        print(f"📊 PROCESSING SELECTED CHUNKS: {selected_chunk_numbers}")
        for i, chunk_number in enumerate(selected_chunk_numbers):
            chunk_start_time = time.time()
            
            print(f"   📝 Processing chunk {chunk_number} ({i+1}/{chunks_to_process})")
            
            try:
                chunk_key = f"{user.r2_directory}/{job_id}/chunk_{chunk_number:03d}.txt"
                print(f"   📁 Downloading: {chunk_key}")
                
                chunk_content = download_from_r2(chunk_key)
                
                if not chunk_content:
                    print(f"   ❌ Failed to download chunk {chunk_number}")
                    failed_chunks.append(chunk_number)
                    continue
                
                print(f"   ✅ Downloaded chunk {chunk_number}: {len(chunk_content)} characters")
                
                # Update progress less frequently for better performance (every 5 chunks or important milestones)
                if i % 5 == 0 or i == chunks_to_process - 1:
                    update_job_progress(job_id, "analyzing", 
                                      int((i / chunks_to_process) * 100), 
                                      f"Analyzing chunk {chunk_number} ({i+1}/{chunks_to_process})...", 
                                      current_chunk=i+1, total_chunks=chunks_to_process)
                
                # Process with OpenAI
                print(f"   🤖 Sending chunk {chunk_number} to OpenAI...")
                ai_response = openai_client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",
                    messages=[{"role": "user", "content": ucp_prompt + chunk_content}],
                    max_completion_tokens=15000,
                    timeout=120  # 2 minute timeout per chunk
                )
                print(f"   ✅ OpenAI response received for chunk {chunk_number}")
                
                chunk_end_time = time.time()
                chunk_duration = chunk_end_time - chunk_start_time
                
                input_tokens = count_tokens(chunk_content)
                output_tokens = ai_response.usage.completion_tokens
                
                # Calculate cost for this chunk
                input_cost = (input_tokens / 1_000_000) * 0.050
                output_cost = (output_tokens / 1_000_000) * 0.400
                chunk_cost = input_cost + output_cost
                
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                total_cost += chunk_cost
                
                # Create chunk timing record
                chunk_timing = ChunkTiming(
                    chunk_id=chunk_number,
                    chunk_size_tokens=input_tokens,
                    analysis_start_time=chunk_start_time,
                    analysis_end_time=chunk_end_time,
                    analysis_duration_seconds=chunk_duration,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    cost_usd=chunk_cost,
                    tokens_per_second=(input_tokens + output_tokens) / chunk_duration if chunk_duration > 0 else 0,
                    timestamp=datetime.now().isoformat()
                )
                
                chunk_timings.append(chunk_timing)
                performance_timer.log_chunk_timing(chunk_timing)
                
                result = {
                    "chunk_index": chunk_number,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost": chunk_cost,
                    "duration_seconds": chunk_duration,
                    "tokens_per_second": chunk_timing.tokens_per_second,
                    "content": ai_response.choices[0].message.content,
                    "processed_at": datetime.utcnow().isoformat()
                }
                
                results.append(result)
                upload_to_r2(f"{user.r2_directory}/{job_id}/result_{chunk_number:03d}.json", json.dumps(result, indent=2))
                print(f"   💾 Saved result for chunk {chunk_number}")
                
            except Exception as chunk_error:
                print(f"   ❌ Error processing chunk {chunk_number}: {chunk_error}")
                failed_chunks.append(chunk_number)
                continue
        
        analysis_end_time = time.time()
        total_analysis_duration = analysis_end_time - analysis_start_time
        
        print(f"🏁 ANALYSIS COMPLETE:")
        print(f"   Requested chunks: {chunks_to_process}")
        print(f"   Successfully processed: {len(results)}")
        print(f"   Failed chunks: {failed_chunks}")
        print(f"   Total duration: {total_analysis_duration:.1f} seconds")
        
        if not results:
            # Rollback credits for completely failed job
            try:
                refund_result = supabase.rpc("add_credits_to_user", {
                    "user_uuid": user.user_id,
                    "credits_to_add": chunks_to_process,
                    "transaction_description": f"Credit refund for failed job {job_id} - {chunks_to_process} credits refunded"
                }).execute()
                print(f"✅ Refunded {chunks_to_process} credits for completely failed job {job_id}")
                
                # Also log as separate refund transaction for audit trail
                supabase.table("credit_transactions").insert({
                    "user_id": user.user_id,
                    "transaction_type": "refund",
                    "credits": chunks_to_process,
                    "job_id": job_id,
                    "description": f"Job failure refund - {chunks_to_process} credits (Job ID: {job_id})"
                }).execute()
                
                update_job_progress(job_id, "failed", 0, f"All chunks failed to process. {chunks_to_process} credits have been refunded to your account.")
                return
                
            except Exception as refund_error:
                print(f"❌ Critical: Failed to refund credits for failed job: {refund_error}")
                update_job_progress(job_id, "failed", 0, f"Job failed AND credit refund failed. Please contact support with job ID: {job_id}")
                return
        
        # Update user's chunks used count
        await update_user_chunks_used(user.user_id, len(results))
        
        # Create comprehensive job timing record
        average_chunk_duration = total_analysis_duration / len(results) if results else 0
        average_tokens_per_second = (total_input_tokens + total_output_tokens) / total_analysis_duration if total_analysis_duration > 0 else 0
        
        job_timing = JobTiming(
            job_id=job_id,
            total_chunks=len(results),
            total_start_time=analysis_start_time,
            total_end_time=analysis_end_time,
            total_duration_seconds=total_analysis_duration,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            total_cost_usd=total_cost,
            average_chunk_duration=average_chunk_duration,
            average_tokens_per_second=average_tokens_per_second,
            extraction_timing=None,  # Will be added if available
            chunk_timings=chunk_timings,
            timestamp=datetime.now().isoformat()
        )
        
        # Log comprehensive timing data
        performance_timer.log_job_summary(job_timing)
        performance_timer.export_json_data(job_timing, f"timing_data_{job_id}.json")

        update_job_progress(job_id, "completed", 100, f"All chunks analyzed - Universal Context Pack complete! Processed {len(results)}/{chunks_to_process} chunks (Duration: {total_analysis_duration:.1f}s)")
        if failed_chunks:
            print(f" Failed chunks: {failed_chunks}")
        
        
        # Create complete UCP from processed chunks only
        aggregated_content = "\n\n" + "="*100 + "\n\n".join([
            f"# CHUNK {r['chunk_index']} ANALYSIS\n\n{r['content']}"
            for r in results if r.get('content')
        ])
        
        # Add note about upgrade if not all chunks were processed
        if chunks_to_process < total_chunks:
            upgrade_note = f"""

{"="*100}
# UPGRADE TO ANALYZE REMAINING CHUNKS

You have {total_chunks - chunks_to_process} more chunks that can be analyzed with a Pro plan upgrade.

Processed: {chunks_to_process}/{total_chunks} chunks
Remaining: {total_chunks - chunks_to_process} chunks

Upgrade to Pro plan ($4.99) to unlock your complete Universal Context Pack!
{"="*100}
"""
            aggregated_content += upgrade_note
        
        upload_to_r2(f"{user.r2_directory}/{job_id}/complete_ucp.txt", aggregated_content)

        
        # Save summary to R2 - include timing data
        summary = {
            "job_id": job_id,
            "total_chunks": total_chunks,
            "processed_chunks": len(results),
            "chunks_to_process": chunks_to_process,
            "payment_plan": payment_status["plan"],
            "upgrade_required": chunks_to_process < total_chunks,
            "failed_chunks": failed_chunks,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cost": total_cost,
            "analysis_timing": {
                "total_duration_seconds": total_analysis_duration,
                "total_duration_minutes": total_analysis_duration / 60,
                "average_chunk_duration": average_chunk_duration,
                "average_tokens_per_second": average_tokens_per_second,
                "fastest_chunk_duration": min([ct.analysis_duration_seconds for ct in chunk_timings]) if chunk_timings else 0,
                "slowest_chunk_duration": max([ct.analysis_duration_seconds for ct in chunk_timings]) if chunk_timings else 0
            },
            "completed_at": datetime.utcnow().isoformat()
        }
        
        upload_to_r2(f"{user.r2_directory}/{job_id}/summary.json", json.dumps(summary, indent=2))
        
        # Update job status to analyzed (triggers chunk count update)
        try:
            await update_job_status_in_db(
                user, 
                job_id, 
                "analyzed", 
                progress=100,
                metadata={
                    "analysis_completed": True,
                    "total_chunks": total_chunks,
                    "processed_chunks": len(results),
                    "total_cost": total_cost,
                    "payment_plan": payment_status["plan"],
                    "analysis_timing": summary["analysis_timing"]
                }
            )
            print(f"Job {job_id} marked as completed in database")
        except Exception as e:
            print(f"Error updating job status to completed: {e}")

        # Create pack record in database
        print(f"🔄 ATTEMPTING TO CREATE PACK FOR JOB: {job_id}")
        try:
            # Verify job exists using backend function (bypasses RLS)
            job_check_result = supabase.rpc("check_job_exists_for_backend", {
                "user_uuid": user.user_id,
                "target_job_id": job_id
            }).execute()
            
            if not job_check_result.data or not job_check_result.data[0]["job_exists"]:
                print(f"❌ Job {job_id} does not exist in database - cannot create pack")
                return
            
            # Create a generic pack name (since we can't get file name due to RLS)
            pack_name = f"UCP Analysis - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            print(f"🔄 Pack details:")
            print(f"   Pack name: {pack_name}")
            print(f"   R2 path: {user.r2_directory}/{job_id}")
            print(f"   Chunks processed: {len(results)}/{total_chunks}")
            
            pack_record = await create_pack_in_db(
                user=user,
                job_id=job_id,
                pack_name=pack_name,
                r2_pack_path=f"{user.r2_directory}/{job_id}",
                extraction_stats=None,  # Will be added later if needed
                chunk_stats={
                    "total_chunks_available": total_chunks,  # Total chunks created from file
                    "chunks_selected_by_user": chunks_to_process,  # Chunks user wanted to process 
                    "processed_chunks": len(results),  # Chunks actually processed successfully
                    "failed_chunks": len(failed_chunks) if failed_chunks else 0
                },
                analysis_stats={
                    "total_input_tokens": total_input_tokens,
                    "total_output_tokens": total_output_tokens,
                    "total_cost": total_cost,
                    "duration_seconds": total_analysis_duration,
                    "average_chunk_duration": average_chunk_duration
                },
                file_size=None  # Can't get file size due to RLS permissions
            )
            
            if pack_record:
                print(f"✅ SUCCESS: Pack created in database with ID: {pack_record.get('pack_id')}")
            else:
                print(f"❌ FAILED: Pack creation returned None")
                
        except Exception as e:
            print(f"❌ EXCEPTION: Error creating pack in database: {e}")
            import traceback
            print(f"   Full traceback: {traceback.format_exc()}")
            # Don't fail the whole job if pack creation fails
        
    except Exception as e:
        print(f"Error in background analysis for job {job_id}: {e}")
        update_job_progress(job_id, "failed", 0, f"Error: {str(e)}")

@app.get("/api/performance-dashboard")
async def performance_dashboard(user: AuthenticatedUser = Depends(get_current_user)):
    """Get performance dashboard with detailed timing statistics."""
    try:
        dashboard_data = {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "performance_summary": {},
            "recent_jobs": [],
            "system_estimates": {}
        }
        
        # Read timing data if available
        if os.path.exists("performance_timing.txt"):
            with open("performance_timing.txt", 'r') as f:
                content = f.read()
            
            # Parse timing data
            lines = content.split('\n')
            extraction_data = []
            job_summaries = []
            chunk_data = []
            
            for i, line in enumerate(lines):
                # Parse extraction data
                if '[EXTRACTION]' in line:
                    extraction_info = {}
                    for j in range(i, min(i+10, len(lines))):
                        if 'Size:' in lines[j]:
                            try:
                                size_mb = float(lines[j].split('Size: ')[1].split(' MB')[0])
                                extraction_info['size_mb'] = size_mb
                            except: pass
                        if 'Duration:' in lines[j]:
                            try:
                                duration = float(lines[j].split('Duration: ')[1].split(' seconds')[0])
                                extraction_info['duration'] = duration
                            except: pass
                        if 'Rate:' in lines[j] and 'MB/s' in lines[j]:
                            try:
                                rate = float(lines[j].split('Rate: ')[1].split(' MB/s')[0])
                                extraction_info['rate_mb_per_s'] = rate
                            except: pass
                        if 'Conversations:' in lines[j]:
                            try:
                                convs = int(lines[j].split('Conversations: ')[1].replace(',', ''))
                                extraction_info['conversations'] = convs
                            except: pass
                    
                    if 'size_mb' in extraction_info and 'duration' in extraction_info:
                        extraction_data.append(extraction_info)
                
                # Parse job summaries
                if '[JOB SUMMARY]' in line:
                    job_info = {}
                    for j in range(i, min(i+15, len(lines))):
                        if 'Job ID:' in lines[j]:
                            job_info['job_id'] = lines[j].split('Job ID: ')[1].strip()
                        if 'Total Duration:' in lines[j]:
                            try:
                                duration_match = lines[j].split('Total Duration: ')[1]
                                duration = float(duration_match.split(' seconds')[0])
                                job_info['duration_seconds'] = duration
                                job_info['duration_minutes'] = duration / 60
                            except: pass
                        if 'Total Chunks:' in lines[j]:
                            try:
                                chunks = int(lines[j].split('Total Chunks: ')[1])
                                job_info['total_chunks'] = chunks
                            except: pass
                        if 'Total Cost:' in lines[j]:
                            try:
                                cost = float(lines[j].split('Total Cost: $')[1])
                                job_info['cost'] = cost
                            except: pass
                        if 'Average Processing Rate:' in lines[j]:
                            try:
                                rate = float(lines[j].split('Rate: ')[1].split(' tokens/s')[0])
                                job_info['tokens_per_second'] = rate
                            except: pass
                    
                    if 'job_id' in job_info:
                        job_summaries.append(job_info)
            
            # Calculate performance summary
            if extraction_data:
                avg_extraction_rate = sum(e['rate_mb_per_s'] for e in extraction_data if 'rate_mb_per_s' in e) / len([e for e in extraction_data if 'rate_mb_per_s' in e])
                total_files_processed = len(extraction_data)
                total_size_processed = sum(e['size_mb'] for e in extraction_data if 'size_mb' in e)
                
                dashboard_data["performance_summary"]["extraction"] = {
                    "average_rate_mb_per_second": round(avg_extraction_rate, 3),
                    "total_files_processed": total_files_processed,
                    "total_size_processed_mb": round(total_size_processed, 2),
                    "efficiency_rating": "Excellent" if avg_extraction_rate > 3 else "Good" if avg_extraction_rate > 2 else "Fair"
                }
            
            if job_summaries:
                total_chunks = sum(j['total_chunks'] for j in job_summaries if 'total_chunks' in j)
                total_cost = sum(j['cost'] for j in job_summaries if 'cost' in j)
                avg_tokens_per_second = sum(j['tokens_per_second'] for j in job_summaries if 'tokens_per_second' in j) / len([j for j in job_summaries if 'tokens_per_second' in j])
                
                dashboard_data["performance_summary"]["analysis"] = {
                    "total_chunks_processed": total_chunks,
                    "total_cost_usd": round(total_cost, 4),
                    "average_tokens_per_second": round(avg_tokens_per_second, 1),
                    "jobs_completed": len(job_summaries),
                    "efficiency_rating": "Excellent" if avg_tokens_per_second > 2000 else "Good" if avg_tokens_per_second > 1500 else "Fair"
                }
            
            # Recent jobs (last 5)
            dashboard_data["recent_jobs"] = job_summaries[-5:] if job_summaries else []
            
            # System estimates based on real data
            if extraction_data and job_summaries:
                dashboard_data["system_estimates"] = {
                    "extraction_estimates": {
                        "1MB_file_seconds": round(1 / avg_extraction_rate, 1),
                        "5MB_file_seconds": round(5 / avg_extraction_rate, 1),
                        "10MB_file_seconds": round(10 / avg_extraction_rate, 1),
                        "50MB_file_seconds": round(50 / avg_extraction_rate, 1)
                    },
                    "analysis_estimates": {
                        "30_chunks_minutes": round((30 * 50000) / avg_tokens_per_second / 60, 1),
                        "50_chunks_minutes": round((50 * 50000) / avg_tokens_per_second / 60, 1),
                        "100_chunks_minutes": round((100 * 50000) / avg_tokens_per_second / 60, 1)
                    },
                    "confidence": "High - based on real usage data"
                }
        else:
            # No timing data available
            dashboard_data["performance_summary"] = {
                "message": "No performance data available yet. Complete some jobs to see timing statistics.",
                "status": "waiting_for_data"
            }
            dashboard_data["system_estimates"] = {
                "extraction_estimates": {
                    "1MB_file_seconds": 0.4,
                    "5MB_file_seconds": 2.0,
                    "10MB_file_seconds": 4.0,
                    "50MB_file_seconds": 20.0
                },
                "analysis_estimates": {
                    "30_chunks_minutes": 16.7,
                    "50_chunks_minutes": 27.8,
                    "100_chunks_minutes": 55.6
                },
                "confidence": "Low - estimated values, no real data yet"
            }
        
        return dashboard_data
        
    except Exception as e:
        print(f"Error generating performance dashboard: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": "Could not generate performance dashboard"
        }

@app.get("/api/timing-test")
async def run_timing_test(user: AuthenticatedUser = Depends(get_current_user)):
    """Run comprehensive timing tests and return performance estimates."""
    try:
        # Read existing timing data
        timing_estimates = {}
        
        if os.path.exists("performance_timing.txt"):
            with open("performance_timing.txt", 'r') as f:
                content = f.read()
                
            # Parse recent extraction data
            extraction_rates = []
            analysis_rates = []
            
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if '[EXTRACTION]' in line:
                    # Look for rate information in next few lines
                    for j in range(i, min(i+10, len(lines))):
                        if 'Rate:' in lines[j] and 'MB/s' in lines[j]:
                            try:
                                rate = float(lines[j].split('Rate: ')[1].split(' MB/s')[0])
                                extraction_rates.append(rate)
                            except:
                                pass
                
                if '[JOB SUMMARY]' in line:
                    # Look for processing rate in next few lines
                    for j in range(i, min(i+15, len(lines))):
                        if 'Average Processing Rate:' in lines[j]:
                            try:
                                rate = float(lines[j].split('Rate: ')[1].split(' tokens/s')[0])
                                analysis_rates.append(rate)
                            except:
                                pass
            
            # Calculate averages
            if extraction_rates:
                avg_extraction_rate = sum(extraction_rates) / len(extraction_rates)
                timing_estimates['extraction'] = {
                    'average_rate_mb_per_second': avg_extraction_rate,
                    'sample_count': len(extraction_rates),
                    'estimates': {
                        '1MB_file': 1 / avg_extraction_rate,
                        '5MB_file': 5 / avg_extraction_rate,
                        '10MB_file': 10 / avg_extraction_rate,
                        '50MB_file': 50 / avg_extraction_rate
                    }
                }
            
            if analysis_rates:
                avg_analysis_rate = sum(analysis_rates) / len(analysis_rates)
                timing_estimates['analysis'] = {
                    'average_rate_tokens_per_second': avg_analysis_rate,
                    'sample_count': len(analysis_rates),
                    'estimates': {
                        '30_chunks_analysis': (30 * 50000) / avg_analysis_rate,  # 30 chunks * ~50k tokens per chunk
                        '50_chunks_analysis': (50 * 50000) / avg_analysis_rate,
                        '100_chunks_analysis': (100 * 50000) / avg_analysis_rate
                    }
                }
        
        # Provide fallback estimates if no data available
        if not timing_estimates:
            timing_estimates = {
                'extraction': {
                    'average_rate_mb_per_second': 2.5,  # Conservative estimate
                    'sample_count': 0,
                    'estimates': {
                        '1MB_file': 0.4,
                        '5MB_file': 2.0,
                        '10MB_file': 4.0,
                        '50MB_file': 20.0
                    },
                    'note': 'Estimates based on typical performance - will improve with usage data'
                },
                'analysis': {
                    'average_rate_tokens_per_second': 1500,  # Conservative estimate
                    'sample_count': 0,
                    'estimates': {
                        '30_chunks_analysis': 1000,  # ~16 minutes
                        '50_chunks_analysis': 1667,  # ~28 minutes
                        '100_chunks_analysis': 3333  # ~56 minutes
                    },
                    'note': 'Estimates based on typical AI processing speeds - will improve with usage data'
                }
            }
        
        return {
            "status": "success",
            "timing_estimates": timing_estimates,
            "timestamp": datetime.now().isoformat(),
            "message": "Performance timing data compiled from recent jobs"
        }
        
    except Exception as e:
        print(f"Error getting timing estimates: {e}")
        return {
            "status": "error",
            "error": str(e),
            "fallback_estimates": {
                "extraction_time_per_mb": "0.4 seconds",
                "analysis_time_per_chunk": "33 seconds",
                "note": "Using fallback estimates - no timing data available"
            }
        }

@app.get("/api/status/{job_id}")
async def get_status(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get job status and progress with real-time updates."""
    try:
        # Get real-time progress first
        progress_info = get_job_progress(job_id)
        
        # Check if extracted
        extracted_exists = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt") is not None
        
        # Check if chunked
        chunks_metadata = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        chunks_exist = chunks_metadata is not None
        
        # Check if completed
        summary = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json")
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
    """Download complete UCP file from R2."""
    try:
        content = download_from_r2(f"{user.r2_directory}/{job_id}/complete_ucp.txt")
        if content is None:
            raise HTTPException(status_code=404, detail="File not found")
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type='text/plain',
            headers={"Content-Disposition": f"attachment; filename=complete_ucp_{job_id}.txt"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

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

@app.get("/api/packs")
async def list_packs(user: AuthenticatedUser = Depends(get_current_user)):
    """List all completed packs from Supabase for the authenticated user."""
    try:
        if not supabase:
            # Fallback to R2-based jobs if Supabase is not available
            return await list_jobs(user)
        
        # Fetch packs from Supabase using backend function
        result = supabase.rpc("get_user_packs_for_backend", {"user_uuid": user.user_id}).execute()
        
        packs = []
        for pack in result.data:
            # Safely extract stats with null checking
            extraction_stats = pack.get("pack_extraction_stats") or {}
            chunk_stats = pack.get("pack_chunk_stats") or {}
            analysis_stats = pack.get("pack_analysis_stats") or {}
            
            pack_data = {
                "job_id": pack["pack_job_id"],
                "pack_name": pack["pack_name_out"],
                "status": "completed",
                "created_at": pack["pack_created_at"],
                "stats": {
                    "total_chunks": chunk_stats.get("processed_chunks", 0),  # Use processed_chunks for display
                    "processed_chunks": chunk_stats.get("processed_chunks", 0),
                    "failed_chunks": extraction_stats.get("failed_chunks", 0),
                    "total_input_tokens": analysis_stats.get("total_input_tokens", 0),
                    "total_output_tokens": analysis_stats.get("total_output_tokens", 0),
                    "total_cost": analysis_stats.get("total_cost", 0)
                }
            }
            packs.append(pack_data)
        
        return packs
    except Exception as e:
        print(f"Error fetching packs from Supabase: {e}")
        # Fallback to R2-based jobs
        return await list_jobs(user)

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
                "total_chunks": 5,  # Updated to match new free plan limit
                "processed_chunks": 5,
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

@app.get("/api/download/{job_id}/pack")
async def download_complete_pack(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Download complete pack as ZIP file containing all job files."""
    try:
        import zipfile
        import tempfile
        
        # Create a temporary file for the ZIP
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                
                # List of files to include in the pack
                file_mappings = [
                    (f"{user.r2_directory}/{job_id}/extracted.txt", "extracted.txt"),
                    (f"{user.r2_directory}/{job_id}/complete_ucp.txt", "complete_ucp.txt"),
                    (f"{user.r2_directory}/{job_id}/summary.json", "summary.json"),
                    (f"{user.r2_directory}/{job_id}/job_summary.json", "job_summary.json"),
                    (f"{user.r2_directory}/{job_id}/chunks_metadata.json", "chunks_metadata.json"),
                ]
                
                # Add main files
                for r2_key, zip_name in file_mappings:
                    content = download_from_r2(r2_key)
                    if content:
                        zipf.writestr(zip_name, content)
                
                # Add all chunk files
                chunk_metadata_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
                if chunk_metadata_content:
                    chunk_metadata = json.loads(chunk_metadata_content)
                    total_chunks = chunk_metadata.get("total_chunks", 0)
                    
                    # Create chunks directory in ZIP
                    for i in range(1, total_chunks + 1):
                        chunk_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunk_{i:03d}.txt")
                        if chunk_content:
                            zipf.writestr(f"chunks/chunk_{i:03d}.txt", chunk_content)
                
                # Add all result files
                summary_content = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json")
                if summary_content:
                    summary = json.loads(summary_content)
                    processed_chunks = summary.get("processed_chunks", 0)
                    
                    # Create results directory in ZIP
                    for i in range(1, processed_chunks + 1):
                        result_content = download_from_r2(f"{user.r2_directory}/{job_id}/result_{i:03d}.json")
                        if result_content:
                            zipf.writestr(f"results/result_{i:03d}.json", result_content)
        
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

# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

@app.get("/api/profile")
async def get_user_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Get the current user's profile information"""
    try:
        
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        result = supabase.rpc("get_user_profile_for_backend", {"user_uuid": current_user.user_id}).execute()
        
        if result.data:
            # Return profile data (no need to filter API key since it's not stored anymore)
            return {"profile": result.data}
        else:
            raise HTTPException(status_code=404, detail="User profile not found")
            
    except Exception as e:
        print(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")

# ================================
# STRIPE PAYMENT ENDPOINTS
# ================================

@app.post("/api/create-payment-intent")
async def create_payment_intent(
    request: StripePaymentIntentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a Stripe PaymentIntent for credit purchase"""
    print(f"🚀 Payment intent request: {request.credits} credits for ${request.amount}")
    print(f"👤 User: {user.user_id}")
    
    try:
        # Rate limiting: max 5 payment intents per hour per user
        can_proceed, attempt_count = check_rate_limit(user.user_id, "payment", max_attempts=5, window_hours=1)
        
        if not can_proceed:
            raise HTTPException(
                status_code=429, 
                detail=f"Too many payment attempts. You can create up to 5 payment intents per hour. Try again later."
            )
        
        print(f"📊 Payment attempt {attempt_count}/5 for user {user.user_id}")
        
        # Validate the amount matches our pricing
        expected_amount = calculate_credit_price(request.credits)
        print(f"💰 Expected amount: ${expected_amount}, Received: ${request.amount}")
        
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
            metadata={
                'user_id': user.user_id,
                'credits': request.credits,
                'email': user.email
            },
            description=f"Purchase {request.credits} credits for Universal Context Pack"
        )
        
        print(f"✅ Stripe payment intent created: {intent.id}")
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
        
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        print(f"❌ Error creating payment intent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment intent")

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
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Handle different Stripe events
        if event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            
            # Extract metadata
            user_id = payment_intent['metadata'].get('user_id')
            credits = int(payment_intent['metadata'].get('credits', 0))
            amount = payment_intent['amount'] / 100  # Convert cents to dollars
            
            if user_id and credits > 0:
                # Add credits to user account
                await add_credits_to_user(user_id, credits, amount, payment_intent['id'])
                print(f"✅ Added {credits} credits to user {user_id}")
                
        elif event['type'] == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            print(f"❌ Payment failed: {payment_intent['id']} - {payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')}")
            # TODO: Log failed payment for investigation
            
        elif event['type'] == 'charge.dispute.created':
            dispute = event['data']['object']
            charge_id = dispute['charge']
            print(f"⚠️ Dispute created for charge: {charge_id}")
            # TODO: Handle dispute - maybe freeze credits pending investigation
            
        elif event['type'] == 'payment_intent.requires_action':
            payment_intent = event['data']['object']
            print(f"🔐 Payment requires action: {payment_intent['id']}")
            # This is normal for 3D Secure, just log it
            
        else:
            print(f"📝 Unhandled webhook event: {event['type']}")
            
        return {"status": "success"}
        
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

def calculate_credit_price(credits: int) -> float:
    """Calculate price for credits with volume discounts"""
    base_price = 0.10  # $0.10 per credit
    
    if credits >= 250:
        # 20% off for 250+ credits
        return round(credits * base_price * 0.8, 2)
    elif credits >= 100:
        # 10% off for 100+ credits  
        return round(credits * base_price * 0.9, 2)
    elif credits >= 50:
        # 5% off for 50+ credits
        return round(credits * base_price * 0.95, 2)
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
        
        # Note: Duplicate checking is handled by the database function itself
        # We don't need to check manually as the RPC function is idempotent
        
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

if __name__ == "__main__":
    print(" Starting Simple UCP Backend with R2 Storage - 3 Step Process...")
    print(f" Using R2 bucket: {R2_BUCKET}")
    print(" Steps: 1) Extract → 2) Chunk → 3) Analyze")
    uvicorn.run("simple_backend:app", host="0.0.0.0", port=8000, reload=False)

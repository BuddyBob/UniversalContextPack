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
from typing import List, Dict, Any, Optional
from pathlib import Path
import tiktoken
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
else:
    print("Warning: Supabase credentials not found. Running in legacy mode.")
    supabase = None

app = FastAPI(title="Simple UCP Backend", version="1.0.0")

# CORS middleware - Configure allowed origins from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "https://universal-context-pack.vercel.app").split(",")
# Add additional domains that might be accessing the API
additional_origins = [
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    selected_chunks: List[int] = []  # List of chunk indices to analyze

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
            return result.data[0]
        else:
            return None
            
    except Exception as e:
        return None
        
        if result.data:
            print(f"Successfully created pack in database: {result.data[0]}")
            return result.data[0]
        else:
            print(f"Pack insertion returned no data: {result}")
            return None
            
    except Exception as e:
        print(f"Error creating pack in database: {e}")
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
            print(f"🔒 SSL verification failed for R2 upload: {ssl_error}")
            print("📋 Falling back to local storage due to SSL issues")
            # Fallback to local storage on SSL issues
            local_path = f"local_storage/{key}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(content)
            return True
        except UnicodeEncodeError as ue:
            print(f"Unicode encoding error: {ue}")
            # More aggressive cleaning for surrogate pairs
            import unicodedata
            clean_content = ''.join(char for char in content if unicodedata.category(char) != 'Cs')
            try:
                response = r2_session.put(url, data=clean_content.encode('utf-8'), headers=headers, timeout=30)
            except requests.exceptions.SSLError as ssl_error:
                print(f"🔒 SSL verification failed on retry: {ssl_error}")
                # Fallback to local storage
                local_path = f"local_storage/{key}"
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                    f.write(clean_content)
                return True
            # More aggressive cleaning for surrogate pairs
            import unicodedata
            clean_content = ''.join(char for char in content if unicodedata.category(char) != 'Cs')
            response = r2_session.put(url, data=clean_content.encode('utf-8'), headers=headers, timeout=30)
        
        if response.status_code in [200, 201]:
            print(f"✅ R2 upload successful with SSL verification: {key}")
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
        
        print(f"R2 response status: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ Successfully downloaded from R2 with SSL verification: {key} ({len(response.text)} chars)")
            return response.text
        elif response.status_code == 404 and silent_404:
            # Silently return None for expected 404s (like new process.log files)
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

def clean_text(text: str) -> str:
    """Clean and normalize text content"""
    if not text:
        return ""
    
    # Decode HTML entities
    text = html.unescape(text)
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text

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
                    # Update progress every 50 items or at milestones to reduce logging
                    if i % 50 == 0 or i == len(obj) - 1 or i == 0:
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
    """Background task for processing text extraction with progress updates."""
    try:
        await update_job_status_in_db(user, job_id, "processing", 10, metadata={"step": "parsing_content"})
        
        extracted_texts = []
        
        # Check if it's an HTML file first
        if filename.lower().endswith('.html') or filename.lower().endswith('.htm'):
            print("Processing HTML chat export...")
            update_job_progress(job_id, "extracting", 20, "Processing HTML chat export...")
            extracted_texts = extract_from_html_content(file_content)
        else:
            try:
                # Try parsing as JSON first
                json_data = json.loads(file_content)
                print("Processing JSON data structure...")
                update_job_progress(job_id, "extracting", 20, "Processing JSON data structure...")
                
                def progress_callback(message):
                    # Parse progress from message like "Processing item 500/1000 (50.0%)"
                    if "Processing item" in message and "%" in message:
                        try:
                            percent_part = message.split("(")[1].split("%")[0]
                            percent = float(percent_part)
                            # Get current item number for batch updates
                            item_part = message.split("Processing item ")[1].split("/")[0]
                            item_num = int(item_part)
                            
                            # Send update every 100 items OR every 5% progress OR at major milestones
                            # This significantly reduces the logging frequency
                            if (item_num % 100 == 0 or 
                                int(percent) % 5 == 0 and int(percent) != int(getattr(progress_callback, 'last_percent', 0)) or 
                                percent >= 99.0 or 
                                item_num == 1):
                                # Scale from 20% to 80% (extraction phase)
                                scaled_progress = 20 + (percent * 0.6)
                                update_job_progress(job_id, "extracting", scaled_progress, message)
                                progress_callback.last_percent = percent
                        except Exception as e:
                            # Fallback for any parsing errors - no verbose logging
                            update_job_progress(job_id, "extracting", 50, message)
                    else:
                        # Non-item progress messages - only log important ones
                        if any(keyword in message.lower() for keyword in ['completed', 'finished', 'error', 'failed']):
                            update_job_progress(job_id, "extracting", 50, message)
                
                extracted_texts = extract_text_from_structure(json_data, progress_callback=progress_callback)
            except json.JSONDecodeError:
                # Fallback to text processing using enhanced function
                print("Processing as text content...")
                update_job_progress(job_id, "extracting", 30, "Processing as text content...")
                extracted_texts = extract_from_text_content(file_content)

        if not extracted_texts:
            update_job_progress(job_id, "extracting", 0, "Error: No meaningful text found in file")
            return

        print(f"Extracted {len(extracted_texts)} meaningful text entries")
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
        
        # Create job summary for better organization
        job_summary = {
            "job_id": job_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "extracted",
            "extracted_count": len(extracted_texts),
            "content_size": len(extracted_content),
            "preview": extracted_texts[:3] if len(extracted_texts) > 3 else extracted_texts
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/job_summary.json", json.dumps(job_summary, indent=2))
        
        
    except Exception as e:
        print(f"Error in background extraction for job {job_id}: {e}")
        update_job_progress(job_id, "extracting", 0, f"Error: {str(e)}")

@app.get("/api/job-summary/{job_id}")
async def get_job_summary(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get job summary information."""
    try:
        # Try to get job summary from R2
        job_summary_content = download_from_r2(f"{user.r2_directory}/{job_id}/job_summary.json")
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

# Legacy endpoint response format - add a status endpoint to get final results
@app.get("/api/results/{job_id}")
async def get_extraction_results(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get final extraction results after background processing completes."""
    try:
        # Check if extracted
        extracted_exists = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt") is not None
        
        # Check if chunked
        chunks_metadata = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        chunks_exist = chunks_metadata is not None
        
        # Check if completed (analysis done)
        summary = download_from_r2(f"{user.r2_directory}/{job_id}/summary.json")
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

@app.post("/api/chunk/{job_id}")
async def chunk_text(job_id: str, request: ChunkRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Step 2: Create chunks from extracted text."""
    try:
        print(f"Starting chunking for job {job_id} for user {user.user_id}")
        print(f"Chunk parameters: size={request.chunk_size}, overlap={request.overlap}")
        # Remove redundant update_progress calls - use only update_job_progress
        update_job_progress(job_id, "chunking", 0, "Creating semantic chunks...")
        
        # Download extracted text from R2 using user directory
        extracted_content = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt")
        if not extracted_content:
            raise HTTPException(status_code=404, detail="Extracted text not found")
        
        print(f"Extracted content length: {len(extracted_content)} characters")
        
        # Use the chunk_size from request (characters) and convert to approximate tokens
        # Rough conversion: 4 characters per token
        max_tokens = min(request.chunk_size // 4, 150000)  # Cap at 150k tokens - safe margin below GPT's 200k limit
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
        
        return {
            "job_id": job_id,
            "status": "chunked",
            "total_chunks": len(chunks),
            "chunks": chunk_info
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
    """Step 3: Analyze chunks with AI - with payment limits."""
    try:
        print(f"🚀 Starting analysis for job {job_id}, user: {user.user_id}")
        print(f"📋 Requested chunks to analyze: {request.selected_chunks}")
        
        # Check payment status and limits FIRST
        print(f"💳 Checking payment status for user {user.user_id}")
        payment_status = await get_user_payment_status(user.user_id)
        print(f"💰 Payment status: {payment_status}")
        
        # Get chunk metadata to see how many chunks we have
        print(f"📦 Loading chunk metadata for job {job_id}")
        chunk_metadata_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        if not chunk_metadata_content:
            print(f"❌ Chunk metadata not found for job {job_id}")
            raise HTTPException(status_code=404, detail="Chunk metadata not found")
        
        chunk_metadata = json.loads(chunk_metadata_content)
        total_chunks = chunk_metadata["total_chunks"]
        print(f"📊 Total chunks available: {total_chunks}")
        
        # Credit-based system only: check available credits
        available_credits = payment_status.get("credits_balance", 0)
        
        # Process only selected chunks (if specified) and within credit limits
        # Frontend sends 0-based indices, but chunk files are 1-based (chunk_001.txt, chunk_002.txt, etc.)
        if request.selected_chunks:
            selected_chunks = [chunk_idx + 1 for chunk_idx in request.selected_chunks]  # Convert 0-based to 1-based
        else:
            selected_chunks = list(range(1, total_chunks + 1))  # All chunks, 1-based
            
        chunks_to_process = min(available_credits, len(selected_chunks))
        
        # Respect user's available credits - no artificial limits for paid users
        # Only limit free users to prevent abuse
        if payment_status.get("plan") == "free":
            MAX_CHUNKS_FREE = 5  # Free users limited to 5 chunks per job
            if chunks_to_process > MAX_CHUNKS_FREE:
                chunks_to_process = MAX_CHUNKS_FREE
                print(f"⚠️  Free plan limited to {MAX_CHUNKS_FREE} chunks per job")
        else:
            # Paid users can process up to their available credits (no artificial limit)
            print(f"✅ Paid plan - processing up to {chunks_to_process} chunks based on available credits")
        
        actual_chunks_to_process = selected_chunks[:chunks_to_process]  # Take only what we can afford
        
        print(f"💳 Available credits: {available_credits}")
        print(f"📋 Frontend selected indices (0-based): {request.selected_chunks}")
        print(f"📋 Converted to chunk numbers (1-based): {selected_chunks}")
        print(f"🎯 Will process chunks: {actual_chunks_to_process}")
        
        if chunks_to_process <= 0:
            return {
                "job_id": job_id,
                "status": "limit_reached", 
                "message": "No credits available. Purchase credits to analyze chunks.",
                "credits_balance": available_credits,
                "payment_plan": payment_status["plan"]
            }
        
        # Calculate adaptive batch size for estimation
        estimation_batch_size = 2 if chunks_to_process <= 5 else (3 if chunks_to_process <= 15 else 4)
        
        # Warn about processing time for large batches (updated for parallel processing)
        # With parallel processing, time is reduced significantly
        estimated_time_minutes = max(1, (chunks_to_process / estimation_batch_size) * 1.2)  # ~0.4 minutes per chunk with parallel processing
        if chunks_to_process > 5:
            print(f"⚠️  Large batch: {chunks_to_process} chunks with parallel processing will take ~{estimated_time_minutes:.1f} minutes")
            print(f"🚀 Parallel speedup: Processing {min(estimation_batch_size, chunks_to_process)} chunks simultaneously")
            
        print(f"⏱️  Estimated processing time: {estimated_time_minutes:.1f} minutes for {chunks_to_process} chunks (parallel batches of {estimation_batch_size})")
        
        # Get OpenAI client (will automatically use current server API key)
        print(f"🤖 Initializing OpenAI client")
        openai_client = get_openai_client()
        print(f"✅ OpenAI client ready")
        
        
        # Optimized system prompt for OpenAI caching (>1024 tokens for cache eligibility)
        system_prompt = """You are an expert data analyst specializing in building Universal Context Packs (UCPs) from conversation data. Your task is to analyze conversation data and extract ALL unique facts to build a comprehensive Universal Context Pack.

ANALYSIS FRAMEWORK:
Provide extremely detailed analysis in these six primary categories, ensuring comprehensive coverage and depth:

1. PERSONAL PROFILE ANALYSIS
   - Demographics: Age indicators, location references, cultural background, family structure
   - Preferences: Personal likes/dislikes, lifestyle choices, values alignment, aesthetic preferences
   - Goals & Aspirations: Short-term objectives, long-term vision, career ambitions, personal growth targets
   - Values & Beliefs: Core principles, ethical stances, philosophical viewpoints, spiritual beliefs
   - Life Context: Family situation, education background, social environment, geographic influences
   - Personality Traits: Introversion/extroversion, openness, conscientiousness, emotional patterns
   - Health & Wellness: Physical health mentions, mental health awareness, fitness preferences, dietary choices

2. BEHAVIORAL PATTERNS DISCOVERY
   - Communication Style: Formal vs casual, directness level, emotional expression, humor usage
   - Problem-Solving Approach: Analytical vs intuitive, systematic vs creative, research methods
   - Learning Patterns: Visual vs auditory, hands-on vs theoretical, pace preferences, retention methods
   - Decision-Making: Risk tolerance, consultation patterns, timeline preferences, analysis depth
   - Stress Response: Coping mechanisms, pressure reactions, support seeking, resilience indicators
   - Work Habits: Productivity patterns, procrastination tendencies, organization systems, time management
   - Social Behaviors: Group dynamics, leadership tendencies, conflict resolution, relationship building

3. KNOWLEDGE DOMAINS MAPPING
   - Technical Skills: Programming languages, tools, frameworks, proficiency levels, learning trajectory
   - Professional Expertise: Industry knowledge, specialized skills, certifications, experience depth
   - Academic Background: Educational achievements, research areas, publications, continuous learning
   - Hobby Knowledge: Personal interests, recreational skills, passionate subjects, expertise development
   - Soft Skills: Leadership, communication, teamwork, emotional intelligence, adaptability
   - Domain-Specific Knowledge: Field expertise, niche specializations, cross-disciplinary understanding
   - Innovation & Creativity: Original thinking, creative problem-solving, artistic pursuits, invention

4. PROJECT PATTERNS IDENTIFICATION
   - Workflow Preferences: Sequential vs parallel, planning vs improvisation, documentation habits
   - Tool Usage: Preferred software, platforms, methodologies, automation preferences, efficiency tools
   - Collaboration Style: Team vs solo work, leadership vs following, communication frequency, delegation
   - Quality Standards: Attention to detail, perfectionism level, acceptance criteria, review processes
   - Resource Management: Time allocation, priority setting, efficiency strategies, budget consciousness
   - Project Lifecycle: Initiation methods, execution strategies, completion patterns, post-project analysis
   - Risk Management: Risk assessment abilities, contingency planning, adaptability to changes

5. TIMELINE EVOLUTION TRACKING
   - Skill Development: Learning progression, capability growth, expertise expansion, mastery indicators
   - Career Milestones: Job changes, promotions, significant achievements, professional transitions
   - Interest Evolution: Changing focuses, new passions, abandoned interests, hobby development
   - Relationship Development: Professional networks, mentoring relationships, partnership formation
   - Goal Achievement: Completed objectives, abandoned goals, pivoted directions, success metrics
   - Life Stage Transitions: Educational phases, career changes, personal milestones, lifestyle shifts
   - Knowledge Acquisition: Learning sequences, expertise building, certification timelines, skill stacking

6. INTERACTION INSIGHTS ANALYSIS
   - Communication Preferences: Channel selection, frequency, timing patterns, medium preferences
   - Response Styles: Quick vs thoughtful, brief vs detailed, formal vs casual, emotional tone
   - Engagement Patterns: Proactive vs reactive, initiating vs responding, participation levels
   - Feedback Reception: Open to criticism, defensive responses, improvement implementation, growth mindset
   - Social Dynamics: Group participation, authority respect, peer interaction, influence patterns
   - Conflict Resolution: Approach to disagreements, negotiation style, compromise willingness
   - Mentoring & Teaching: Knowledge sharing patterns, teaching ability, guidance provision, learning facilitation

EXTRACTION REQUIREMENTS:
- Extract EVERY unique fact, preference, skill, and behavioral pattern with meticulous attention to detail
- Include direct quotes and specific examples whenever possible to support findings
- Note contradictions or inconsistencies for further analysis and pattern recognition
- Identify implicit patterns that may not be explicitly stated but can be inferred from context
- Cross-reference information across categories for comprehensive understanding and validation
- Maintain objective analysis while noting subjective elements and personal interpretations
- Preserve temporal context and evolution indicators to track development over time
- Look for recurring themes, consistent behaviors, and developmental patterns across conversations
- Identify unique characteristics that distinguish this individual from general populations
- Note areas of expertise, passion, struggle, and growth for complete personality mapping

OUTPUT FORMAT:
Structure your analysis clearly with detailed subsections for each category. Use bullet points for discrete facts and longer paragraphs for complex patterns. Always cite specific examples from the conversation data to support your analysis. Provide confidence levels for inferences and clearly distinguish between explicitly stated information and derived insights.

QUALITY STANDARDS:
- Comprehensive coverage of all six analysis categories
- Specific evidence citations for every major finding
- Clear distinction between facts and interpretations
- Logical organization and professional presentation
- Actionable insights for understanding the individual's complete profile

The conversation data you will analyze follows this message. Provide your comprehensive Universal Context Pack analysis based on the framework above."""
        
        results = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_cached_tokens = 0
        total_cost = 0.0
        failed_chunks = []
        
        # **PARALLEL BATCH PROCESSING** for dramatically improved speed
        # Adaptive batch size based on total chunks for optimal performance
        if chunks_to_process <= 5:
            batch_size = 2  # Smaller batches for small jobs
        elif chunks_to_process <= 15:
            batch_size = 3  # Optimal for medium jobs
        else:
            batch_size = 4  # Larger batches for big jobs (stay under rate limits)
        
        async def process_single_chunk(chunk_num: int, idx: int, total_chunks: int):
            """Process a single chunk with full error handling"""
            try:
                print(f"🔄 Processing chunk {chunk_num} ({idx+1}/{total_chunks}) for job {job_id}")
                chunk_key = f"{user.r2_directory}/{job_id}/chunk_{chunk_num:03d}.txt"
                
                chunk_content = download_from_r2(chunk_key)
                
                if not chunk_content:
                    print(f"❌ Chunk {chunk_num} content not found at {chunk_key}")
                    return {"error": f"Chunk {chunk_num} not found", "chunk_num": chunk_num}
                
                print(f"✅ Chunk {chunk_num} loaded, size: {len(chunk_content)} chars")
                
                # Process with OpenAI using optimized prompt structure for caching
                print(f"🤖 Sending chunk {chunk_num} to OpenAI (model: gpt-5-nano-2025-08-07)")
                ai_response = openai_client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Conversation data to analyze:\n\n{chunk_content}"}
                    ],
                    max_completion_tokens=15000,
                    timeout=120,  # 2 minute timeout per chunk
                    prompt_cache_key="ucp_analysis_v1"  # Consistent cache key for all UCP analyses
                )
                
                print(f"✅ OpenAI response received for chunk {chunk_num}")
                
                # Log caching performance
                usage = ai_response.usage
                cached_tokens = getattr(usage.prompt_tokens_details, 'cached_tokens', 0) if hasattr(usage, 'prompt_tokens_details') else 0
                cache_hit_rate = (cached_tokens / usage.prompt_tokens * 100) if usage.prompt_tokens > 0 else 0
                
                print(f"📊 Chunk {chunk_num} - Tokens: {usage.completion_tokens} output, {usage.prompt_tokens} input")
                if cached_tokens > 0:
                    print(f"🚀 Cache hit! {cached_tokens}/{usage.prompt_tokens} tokens cached ({cache_hit_rate:.1f}%)")
                else:
                    print(f"💾 No cache hit for chunk {chunk_num}")
                
                input_tokens = usage.prompt_tokens
                output_tokens = usage.completion_tokens
                
                # Calculate cost for this chunk (cached tokens are discounted)
                non_cached_input_tokens = input_tokens - cached_tokens
                input_cost = (non_cached_input_tokens / 1_000_000) * 0.050  # Only non-cached tokens cost full price
                cached_cost = (cached_tokens / 1_000_000) * 0.0125  # 75% discount for cached tokens
                output_cost = (output_tokens / 1_000_000) * 0.400
                chunk_cost = input_cost + cached_cost + output_cost
                
                result = {
                    "chunk_index": chunk_num,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cached_tokens": cached_tokens,
                    "cache_hit_rate": cache_hit_rate,
                    "cost": chunk_cost,
                    "content": ai_response.choices[0].message.content,
                    "processed_at": datetime.utcnow().isoformat()
                }
                
                print(f"💾 Saving result for chunk {chunk_num} to R2")
                upload_to_r2(f"{user.r2_directory}/{job_id}/result_{chunk_num:03d}.json", json.dumps(result, indent=2))
                print(f"✅ Chunk {chunk_num} processing complete")
                
                return result
                
            except Exception as chunk_error:
                print(f"❌ Error processing chunk {chunk_num}: {chunk_error}")
                return {"error": str(chunk_error), "chunk_num": chunk_num}
        
        # Process chunks in parallel batches
        all_results = []
        total_chunks_count = len(actual_chunks_to_process)
        
        for batch_start in range(0, total_chunks_count, batch_size):
            batch_end = min(batch_start + batch_size, total_chunks_count)
            batch_chunks = actual_chunks_to_process[batch_start:batch_end]
            
            print(f"🚀 Processing batch {batch_start//batch_size + 1}: chunks {batch_chunks}")
            
            # Update progress for this batch
            batch_progress = int((batch_start / total_chunks_count) * 100)
            update_job_progress(job_id, "analyzing", 
                              batch_progress, 
                              f"Processing batch {batch_start//batch_size + 1}: chunks {batch_chunks}", 
                              current_chunk=batch_start+1, total_chunks=total_chunks_count)
            
            # Create tasks for parallel processing
            tasks = []
            for i, chunk_num in enumerate(batch_chunks):
                global_idx = batch_start + i
                task = asyncio.create_task(process_single_chunk(chunk_num, global_idx, total_chunks_count))
                tasks.append(task)
            
            # Wait for all chunks in this batch to complete
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process batch results
            for result in batch_results:
                if isinstance(result, Exception):
                    print(f"❌ Batch processing exception: {result}")
                    failed_chunks.append("unknown")
                elif isinstance(result, dict) and "error" in result:
                    print(f"❌ Chunk {result.get('chunk_num')} failed: {result['error']}")
                    failed_chunks.append(result.get('chunk_num'))
                else:
                    all_results.append(result)
                    
                    # Update running totals
                    total_input_tokens += result["input_tokens"]
                    total_output_tokens += result["output_tokens"]
                    total_cached_tokens += result["cached_tokens"]
                    total_cost += result["cost"]
            
            print(f"✅ Batch {batch_start//batch_size + 1} completed: {len([r for r in batch_results if not isinstance(r, Exception) and 'error' not in r])}/{len(batch_chunks)} successful")
        
        # Use the results from parallel processing
        results = all_results
        
        if not results:
            # Rollback credits for completely failed job
            try:
                refund_result = supabase.rpc("add_credits_to_user", {
                    "user_uuid": user.user_id,
                    "credits_to_add": len(actual_chunks_to_process),
                    "transaction_description": f"Credit refund for failed job {job_id} - {len(actual_chunks_to_process)} credits refunded"
                }).execute()
                print(f"✅ Refunded {len(actual_chunks_to_process)} credits for completely failed job {job_id}")
                
                # Also log as separate refund transaction for audit trail
                supabase.table("credit_transactions").insert({
                    "user_id": user.user_id,
                    "transaction_type": "refund",
                    "credits": len(actual_chunks_to_process),
                    "job_id": job_id,
                    "description": f"Job failure refund - {len(actual_chunks_to_process)} credits (Job ID: {job_id})"
                }).execute()
                
                raise HTTPException(status_code=500, detail=f"All chunks failed to process. {len(actual_chunks_to_process)} credits have been refunded to your account.")
                
            except Exception as refund_error:
                print(f"❌ Critical: Failed to refund credits for failed job: {refund_error}")
                raise HTTPException(status_code=500, detail=f"Job failed AND credit refund failed. Please contact support with job ID: {job_id}")
        
        # Update user's chunks used count
        print(f"📊 Updating chunks used count for user: {len(results)} chunks")
        await update_user_chunks_used(user.user_id, len(results))
        

        print(f"🏁 Analysis complete! Updating job progress to completed")
        update_job_progress(job_id, "completed", 100, f"All chunks analyzed - Universal Context Pack complete! Processed {len(results)}/{len(actual_chunks_to_process)} chunks")
        if failed_chunks:
            print(f"❌ Failed chunks: {failed_chunks}")
        
        
        # Create complete UCP from processed chunks only
        print(f"📝 Creating aggregated UCP content from {len(results)} results")
        aggregated_content = "\n\n" + "="*100 + "\n\n".join([
            f"# CHUNK {r['chunk_index']} ANALYSIS\n\n{r['content']}"
            for r in results if r.get('content')
        ])
        
        # Add note about upgrade if not all chunks were processed
        if len(actual_chunks_to_process) < len(selected_chunks):
            remaining_chunks = len(selected_chunks) - len(actual_chunks_to_process)
            upgrade_note = f"""

{"="*100}
# UPGRADE TO ANALYZE REMAINING CHUNKS

You have {remaining_chunks} more selected chunks that can be analyzed with more credits.

Processed: {len(actual_chunks_to_process)}/{len(selected_chunks)} selected chunks
Remaining: {remaining_chunks} chunks

Purchase more credits to unlock your complete Universal Context Pack!
{"="*100}
"""
            aggregated_content += upgrade_note
        
        upload_to_r2(f"{user.r2_directory}/{job_id}/complete_ucp.txt", aggregated_content)

        
        # Save summary to R2 with caching performance metrics
        cache_hit_rate = (total_cached_tokens / total_input_tokens * 100) if total_input_tokens > 0 else 0
        cost_savings = (total_cached_tokens / 1_000_000) * 0.0375  # 75% discount on cached tokens
        
        summary = {
            "job_id": job_id,
            "total_chunks": total_chunks,
            "selected_chunks": len(selected_chunks),
            "processed_chunks": len(results),
            "chunks_to_process": len(actual_chunks_to_process),
            "payment_plan": payment_status["plan"],
            "upgrade_required": len(actual_chunks_to_process) < len(selected_chunks),
            "failed_chunks": failed_chunks,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cached_tokens": total_cached_tokens,
            "cache_hit_rate": round(cache_hit_rate, 1),
            "cost_savings_from_cache": round(cost_savings, 4),
            "total_cost": total_cost,
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
                    "payment_plan": payment_status["plan"]
                }
            )
            print(f"Job {job_id} marked as completed in database")
        except Exception as e:
            print(f"Error updating job status to completed: {e}")
        
        # Save pack to Supabase database
        try:
            pack_name = f"UCP Pack {job_id[:8]}"
            r2_pack_path = f"{user.r2_directory}/{job_id}/"
            
            extraction_stats = {
                "total_chunks": total_chunks,
                "processed_chunks": len(results),
                "failed_chunks": failed_chunks,
                "payment_plan": payment_status["plan"]
            }
            
            chunk_stats = {"chunks_to_process": chunks_to_process}
            analysis_stats = {
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "total_cost": total_cost
            }
            
            await create_pack_in_db(
                user, 
                job_id, 
                pack_name, 
                r2_pack_path, 
                extraction_stats, 
                chunk_stats, 
                analysis_stats,
                len(aggregated_content)
            )
            print(f"Pack created in database for job {job_id}")
                
        except Exception as e:
            print(f"Error creating pack in database: {e}")
        
        result_data = {
            "job_id": job_id,
            "status": "completed" if chunks_to_process == total_chunks else "partial",
            "total_chunks": total_chunks,
            "processed_chunks": len(results),
            "chunks_to_process": chunks_to_process,
            "failed_chunks": failed_chunks,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cost": total_cost,
            "payment_plan": payment_status["plan"],
            "upgrade_required": chunks_to_process < total_chunks
        }
        
        if chunks_to_process < total_chunks:
            result_data["upgrade_message"] = f"Upgrade to Pro plan to analyze remaining {total_chunks - chunks_to_process} chunks"
        
        print(f"Processing complete! Total cost: ${total_cost:.3f}")
        print(f"Results stored in R2 bucket: {R2_BUCKET}")
        print(f"Successfully processed: {len(results)}/{chunks_to_process} chunks")
        
        return result_data
                
    except Exception as e:
        print(f" Error analyzing chunks: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
        print(f" Error analyzing chunks: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

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
                
                if chunk_metadata_content:
                    zipf.writestr("chunks_metadata.json", chunk_metadata_content)
                    chunk_metadata = json.loads(chunk_metadata_content)
                    total_chunks = chunk_metadata.get("total_chunks", 0)
                    print(f"Found {total_chunks} chunks in metadata")
                    
                    # Add all chunk files
                    chunks_added = 0
                    for i in range(1, total_chunks + 1):
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
                    
                    print(f"Successfully added {chunks_added}/{total_chunks} chunks to ZIP")
                    
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
    """List all completed packs from Supabase for the authenticated user."""
    try:
        if not supabase:
            # Fallback to R2-based jobs if Supabase is not available
            return await list_jobs(user)
        
        # Add timeout for the RPC call to prevent hanging requests
        import asyncio
        def fetch_packs_with_timeout():
            # Fetch packs from Supabase using backend function
            result = supabase.rpc("get_user_packs_for_backend", {"user_uuid": user.user_id}).execute()
            return result
        
        try:
            # Set a 30-second timeout for the database query
            result = await asyncio.wait_for(
                asyncio.to_thread(fetch_packs_with_timeout), 
                timeout=30.0
            )
        except asyncio.TimeoutError:
            print(f"Database query timeout for user {user.user_id}, falling back to R2 jobs")
            return await list_jobs(user)
        
        packs = []
        for pack in result.data:
            # Safely get stats, handling None values
            extraction_stats = pack.get("pack_extraction_stats") or {}
            analysis_stats = pack.get("pack_analysis_stats") or {}
            
            pack_data = {
                "job_id": pack["pack_job_id"],
                "pack_name": pack["pack_name_out"],
                "status": "completed",
                "created_at": pack["pack_created_at"],
                "stats": {
                    "total_chunks": extraction_stats.get("total_chunks", 0),
                    "processed_chunks": extraction_stats.get("processed_chunks", 0),
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
            expected_amount = 20.00
            if abs(request.amount - expected_amount) > 0.01:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Amount mismatch for unlimited plan. Expected $20.00, got ${request.amount}"
                )
        else:
            expected_amount = calculate_credit_price(request.credits)
            if abs(request.amount - expected_amount) > 0.01:  # Allow for small rounding differences
                raise HTTPException(
                    status_code=400, 
                    detail=f"Amount mismatch. Expected ${expected_amount}, got ${request.amount}"
                )
        
        # Get the frontend URL for success/cancel redirects
        frontend_url = os.getenv("FRONTEND_URL", "https://universal-context-pack.vercel.app")
        
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
            
        elif event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            
            print(f"🛒 [Webhook] Checkout session completed: {session['id']}")
            print(f"🛒 [Webhook] Payment status: {session.get('payment_status', 'unknown')}")
            print(f"🛒 [Webhook] Session status: {session.get('status', 'unknown')}")
            print(f"🛒 [Webhook] Amount total: {session.get('amount_total', 0)}")
            
            # Extract metadata from the checkout session
            user_id = session['metadata'].get('user_id')
            credits = int(session['metadata'].get('credits', 0))
            unlimited = session['metadata'].get('unlimited', 'False').lower() == 'true'
            amount = session['amount_total'] / 100 if session.get('amount_total') else 0  # Convert cents to dollars
            
            print(f"🛒 [Webhook] Metadata - user_id: {user_id}, credits: {credits}, unlimited: {unlimited}, amount: ${amount}")
            
            # Only process if payment was successful
            if session.get('payment_status') == 'paid':
                if user_id:
                    if unlimited:
                        # Grant unlimited access
                        await grant_unlimited_access(user_id, amount, session['id'])
                        print(f"✅ [Checkout] Granted unlimited access to user {user_id}")
                    elif credits > 0:
                        # Add credits to user account
                        await add_credits_to_user(user_id, credits, amount, session['id'])
                        print(f"✅ [Checkout] Added {credits} credits to user {user_id}")
                    else:
                        print(f"❌ [Checkout] Invalid purchase: user_id={user_id}, credits={credits}, unlimited={unlimited}")
                else:
                    print(f"❌ [Checkout] Missing user_id in metadata")
            else:
                print(f"⚠️ [Checkout] Session completed but payment not paid yet. Status: {session.get('payment_status', 'unknown')}")
                print(f"⚠️ [Checkout] This might be a timing issue - payment might complete shortly")
                
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
            
        else:
            print(f"📝 Unhandled webhook event: {event['type']}")
            
        return {"status": "success"}
        
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

def calculate_credit_price(credits: int) -> float:
    """Calculate price for credits with volume discounts"""
    # Special case: unlimited plan
    if credits == -1:
        return 20.00
    
    base_price = 0.02  # $0.02 per credit (85% cheaper!)
    
    if credits >= 250:
        # 25% off for 250+ credits
        return round(credits * base_price * 0.75, 2)
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
            print("Warning: Supabase not available")
            return
        
        print(f"🌟 Granting unlimited access to user {user_id}")
        print(f"💰 Amount: ${amount}, Stripe ID: {stripe_payment_id}")
        
        # Check if this payment was already processed (duplicate protection)
        existing_payment = supabase.table("credit_transactions").select("id").eq("stripe_payment_id", stripe_payment_id).execute()
        
        if existing_payment.data:
            print(f"⚠️ Payment {stripe_payment_id} already processed, skipping duplicate")
            return
        
        # Set unlimited access for the user (set credits to a very high number like 999999)
        # and update their plan to unlimited
        result = supabase.rpc("grant_unlimited_access", {
            "user_uuid": user_id,
            "transaction_description": f"Stripe payment - ${amount} for unlimited access (Payment ID: {stripe_payment_id})"
        }).execute()
        
        print(f"📊 Supabase RPC result: {result}")
        
        if result.data and result.data != -1:
            print(f"✅ Successfully granted unlimited access to user {user_id}")
        else:
            print(f"❌ Failed to grant unlimited access to user {user_id}. Error: {result}")
            
    except Exception as e:
        print(f"❌ Error granting unlimited access to user {user_id}: {e}")
        # Try to log more details about the error
        if hasattr(e, '__dict__'):
            print(f"❌ Error details: {e.__dict__}")

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

@app.post("/stripe/webhook")
async def stripe_webhook_alias(request: Request):
    """Alias endpoint for Stripe webhooks (matches Stripe dashboard configuration)"""
    return await stripe_webhook(request)

if __name__ == "__main__":
    print(" Starting Simple UCP Backend with R2 Storage - 3 Step Process...")
    print(f" Using R2 bucket: {R2_BUCKET}")
    print(" Steps: 1) Extract → 2) Chunk → 3) Analyze")
    uvicorn.run("simple_backend:app", host="0.0.0.0", port=8000, reload=False)
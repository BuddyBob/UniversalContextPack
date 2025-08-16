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
import jwt
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Disable SSL warnings and verification globally
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
os.environ['PYTHONHTTPSVERIFY'] = '0'
ssl._create_default_https_context = ssl._create_unverified_context

# Configuration from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Get this from Supabase Project Settings -> API

# R2 configuration
R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY") 
R2_BUCKET = os.getenv("R2_BUCKET_NAME")

# Initialize Supabase client
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("Warning: Supabase credentials not found. Running in legacy mode.")
    supabase = None

app = FastAPI(title="Simple UCP Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication
security = HTTPBearer()

# Request models
class AnalyzeRequest(BaseModel):
    openai_api_key: Optional[str] = None

# User model for authentication
class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, r2_directory: str):
        self.user_id = user_id
        self.email = email
        self.r2_directory = r2_directory

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    """Validate JWT token and return authenticated user"""
    try:
        # Extract token
        token = credentials.credentials
        
        # For development, let's be more lenient with JWT validation
        if SUPABASE_JWT_SECRET:
            try:
                # First try with full verification
                payload = jwt.decode(
                    token, 
                    SUPABASE_JWT_SECRET, 
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_aud": True}
                )
                print(f"JWT decoded successfully with full verification")
            except jwt.InvalidAudienceError:
                # Try without audience verification
                print(f"Audience verification failed, trying without audience check")
                payload = jwt.decode(
                    token, 
                    SUPABASE_JWT_SECRET, 
                    algorithms=["HS256"],
                    options={"verify_aud": False}
                )
                print(f"JWT decoded successfully without audience verification")
            except Exception as e:
                print(f"JWT verification failed: {e}")
                # For debugging, let's try without verification
                payload = jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
                print(f"JWT decoded without verification (development mode)")
        else:
            # Development: decode without verification (UNSAFE for production)
            payload = jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
            print(f"JWT decoded without verification (no secret)")
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        print(f"Extracted user data: user_id={user_id}, email={email}")
        
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token: missing user data")
            raise HTTPException(status_code=401, detail="Invalid token: missing user data")
        
        # Get or create user profile in Supabase
        if supabase:
            try:
                # Get user profile
                result = supabase.table("user_profiles").select("*").eq("id", user_id).single().execute()
                user_profile = result.data
                r2_directory = user_profile["r2_user_directory"]
            except Exception as e:
                # User profile might not exist, create it
                try:
                    r2_directory = f"user_{user_id}"
                    user_profile = {
                        "id": user_id,
                        "email": email,
                        "r2_user_directory": r2_directory
                    }
                    supabase.table("user_profiles").insert(user_profile).execute()
                except Exception as create_error:
                    print(f"Error creating user profile: {create_error}")
                    r2_directory = f"user_{user_id}"
        else:
            # Legacy mode: use user_id as directory
            r2_directory = f"user_{user_id}"
        
        return AuthenticatedUser(user_id, email, r2_directory)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
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
    """Create a job record in Supabase - Updated to match actual schema"""
    print(f"🔄 CREATING JOB IN DATABASE:")
    print(f"   User ID: {user.user_id}")
    print(f"   Job ID: {job_id}")
    print(f"   File Name: {file_name}")
    print(f"   Status: {status}")
    
    if not supabase:
        print("❌ SUPABASE CLIENT NOT AVAILABLE")
        return None
    
    try:
        job_data = {
            "user_id": user.user_id,
            "job_id": job_id,
            "status": status,
            "file_name": file_name or "unknown",
            "file_size": file_size or 0,
            "r2_path": f"{user.r2_directory}/{job_id}",
        }
        
        print(f"📝 INSERTING JOB DATA: {job_data}")
        result = supabase.table("jobs").insert(job_data).execute()
        
        if result.data:
            print(f"✅ JOB CREATED SUCCESSFULLY: {result.data[0]}")
            return result.data[0]
        else:
            print(f"❌ JOB CREATION FAILED: No data returned")
            return None
            
    except Exception as e:
        print(f"❌ ERROR CREATING JOB IN DATABASE: {e}")
        print(f"   Exception type: {type(e).__name__}")
        return None

async def update_job_status_in_db(user: AuthenticatedUser, job_id: str, status: str, progress: int = None, error_message: str = None, metadata: dict = None):
    """Update job status in Supabase"""
    print(f"🔄 UPDATING JOB STATUS:")
    print(f"   User ID: {user.user_id}")
    print(f"   Job ID: {job_id}")
    print(f"   New Status: {status}")
    print(f"   Progress: {progress}")
    
    if not supabase:
        print("❌ SUPABASE CLIENT NOT AVAILABLE")
        return None
    
    try:
        update_data = {"status": status}
        if progress is not None:
            update_data["progress"] = progress
        if error_message:
            update_data["error_message"] = error_message
        if metadata:
            update_data["metadata"] = metadata
        if status in ["completed", "failed"]:
            update_data["completed_at"] = datetime.utcnow().isoformat()
        
        print(f"📝 UPDATING JOB DATA: {update_data}")
        result = supabase.table("jobs").update(update_data).eq("job_id", job_id).eq("user_id", user.user_id).execute()
        
        if result.data:
            print(f"✅ JOB STATUS UPDATED SUCCESSFULLY: {result.data[0]}")
            return result.data[0]
        else:
            print(f"❌ JOB STATUS UPDATE FAILED: No data returned or job not found")
            print(f"   Looking for job_id: {job_id}, user_id: {user.user_id}")
            return None
            
    except Exception as e:
        print(f"❌ ERROR UPDATING JOB STATUS: {e}")
        print(f"   Exception type: {type(e).__name__}")
        return None

async def create_pack_in_db(user: AuthenticatedUser, job_id: str, pack_name: str, r2_pack_path: str, extraction_stats: dict = None, chunk_stats: dict = None, analysis_stats: dict = None, file_size: int = None):
    """Create a pack record in Supabase"""
    print(f"🔄 CREATING PACK IN DATABASE:")
    print(f"   User ID: {user.user_id}")
    print(f"   Job ID: {job_id}")
    print(f"   Pack Name: {pack_name}")
    print(f"   R2 Path: {r2_pack_path}")
    
    if not supabase:
        print("❌ SUPABASE CLIENT NOT AVAILABLE")
        return None
    
    try:
        # First check if the job exists
        print(f"🔍 CHECKING IF JOB EXISTS...")
        job_check = supabase.table("jobs").select("*").eq("job_id", job_id).eq("user_id", user.user_id).execute()
        
        if not job_check.data:
            print(f"❌ JOB NOT FOUND: job_id={job_id}, user_id={user.user_id}")
            print(f"   Cannot create pack without corresponding job")
            
            # Let's also check if any jobs exist for this user
            all_jobs = supabase.table("jobs").select("job_id").eq("user_id", user.user_id).execute()
            print(f"   Available jobs for user: {[job['job_id'] for job in all_jobs.data] if all_jobs.data else 'None'}")
            return None
        else:
            print(f"✅ JOB FOUND: {job_check.data[0]['status']}")
        
        pack_data = {
            "user_id": user.user_id,
            "job_id": job_id,
            "pack_name": pack_name,
            "r2_pack_path": r2_pack_path,
            "extraction_stats": extraction_stats,
            "chunk_stats": chunk_stats,
            "analysis_stats": analysis_stats,
            "file_size": file_size
        }
        
        print(f"📝 INSERTING PACK DATA: {pack_data}")
        result = supabase.table("packs").insert(pack_data).execute()
        
        if result.data:
            print(f"✅ PACK CREATED SUCCESSFULLY: {result.data[0]}")
            return result.data[0]
        else:
            print(f"❌ PACK CREATION FAILED: No data returned")
            return None
            
    except Exception as e:
        print(f"❌ ERROR CREATING PACK IN DATABASE: {e}")
        print(f"   Exception type: {type(e).__name__}")
        if hasattr(e, 'details'):
            print(f"   Details: {e.details}")
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
    Get OpenAI client with user's API key or fallback to default
    """
    if api_key and api_key.strip():
        try:
            # Create client with user's API key
            return OpenAI(api_key=api_key.strip())
        except Exception as e:
            print(f"Error creating OpenAI client with user key: {e}")
            # Fallback to default
            if default_openai_client:
                return default_openai_client
            else:
                raise HTTPException(status_code=400, detail="Invalid OpenAI API key and no default key available")
    
    # Use default client
    if default_openai_client:
        return default_openai_client
    else:
        raise HTTPException(status_code=400, detail="No OpenAI API key provided")

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
        print(f"=== DIRECT UPLOAD TO R2 ===")
        print(f"Key: {key}")
        print(f"Content size: {len(content)} characters")
        
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
            print(f"Successfully uploaded to R2: {key}")
            return True
        else:
            print(f"R2 upload failed: {response.status_code} - {response.text}")
            # Fallback to local storage
            local_path = f"local_storage/{key}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(content)
            print(f"Saved to local storage as fallback: {local_path}")
            return True
        
    except Exception as e:
        print(f"Direct upload failed: {type(e).__name__}: {str(e)}")
        # Fallback to local storage
        try:
            local_path = f"local_storage/{key}"
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(content)
            print(f"Saved to local storage as fallback: {local_path}")
            return True
        except Exception as fallback_error:
            print(f"Fallback to local storage also failed: {fallback_error}")
            return False

# Disable boto3 for now and use direct upload
r2_client = None

# Using local storage for now until R2 SSL issue is resolved
print("Using local storage for file operations...")
print("Local storage directory: local_storage/")

def upload_to_r2(key: str, content: str):
    """Upload content to R2 bucket."""
    print(f"=== UPLOAD DEBUG START ===")
    print(f"Function called with key: {key}")
    print(f"Content type: {type(content)}")
    print(f"Content size: {len(content)} characters")
    
    # Use direct upload method to avoid boto3 SSL recursion
    success = upload_to_r2_direct(key, content)
    
    if success:
        print(f"Successfully uploaded: {key}")
        print(f"=== UPLOAD DEBUG END SUCCESS ===")
        return True
    else:
        print(f"Upload failed for: {key}")
        print(f"=== UPLOAD DEBUG END ERROR ===")
        return False

def download_from_r2(key: str) -> str:
    """Download content from R2 bucket."""
    try:
        # Try R2 first
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        
        print(f"Attempting R2 download: {url}")
        
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
        else:
            print(f"R2 download failed ({response.status_code}): {response.text}")
            print(f"R2 download failed ({response.status_code}), trying local storage...")
            # Fall back to local storage
            local_path = f"local_storage/{key}"
            with open(local_path, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"Successfully downloaded from local storage: {key} ({len(content)} chars)")
            return content
            
    except Exception as e:
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

def list_r2_objects(prefix: str = "") -> List[str]:
    """List objects in R2 bucket with optional prefix."""
    try:
        response = r2_client.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix)
        if 'Contents' in response:
            return [obj['Key'] for obj in response['Contents']]
        return []
    except Exception as e:
        print(f"Error listing R2 objects: {e}")
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
progress_tracker = {}

def update_progress(job_id: str, step: str, progress: float, message: str):
    """Update progress for a job"""
    progress_tracker[job_id] = {
        "step": step,
        "progress": progress,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/progress/{job_id}/{operation}")
async def get_progress(job_id: str, operation: str):
    """Get current progress for a job operation"""
    progress = progress_tracker.get(job_id)
    if progress and progress.get("step") == operation:
        return progress
    else:
        return {"job_id": job_id, "step": operation, "progress": 0, "message": "No progress data"}

@app.get("/api/progress/{job_id}")
async def get_progress_stream(job_id: str):
    """Stream progress updates for a job"""
    async def generate():
        last_progress = None
        timeout_count = 0
        while timeout_count < 60:  # 30 seconds timeout
            current_progress = progress_tracker.get(job_id)
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
        update_progress(job_id, "extract", 0, "Starting text extraction...")
        
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
        print(f"Background extraction started for job {job_id} (user: {user.email})")
        await update_job_status_in_db(user, job_id, "processing", 10, metadata={"step": "parsing_content"})
        
        extracted_texts = []
        
        try:
            # Try parsing as JSON first
            json_data = json.loads(file_content)
            print("Processing JSON data structure...")
            update_progress(job_id, "extract", 20, "Processing JSON data structure...")
            
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
                            update_progress(job_id, "extract", scaled_progress, message)
                            progress_callback.last_percent = percent
                    except Exception as e:
                        print(f"Progress parsing error: {e}")
                        # Fallback for any parsing errors
                        update_progress(job_id, "extract", 50, message)
                else:
                    print(f"Non-item progress message: {message}")
                    update_progress(job_id, "extract", 50, message)
            
            extracted_texts = extract_text_from_structure(json_data, progress_callback=progress_callback)
        except json.JSONDecodeError:
            # Fallback to text processing using enhanced function
            print("Processing as text content...")
            update_progress(job_id, "extract", 30, "Processing as text content...")
            extracted_texts = extract_from_text_content(file_content)

        if not extracted_texts:
            update_progress(job_id, "extract", 0, "Error: No meaningful text found in file")
            return

        print(f"Extracted {len(extracted_texts)} meaningful text entries")
        update_progress(job_id, "extract", 80, f"Extracted {len(extracted_texts)} meaningful text entries")

        # Save extracted text to R2
        print("Saving extracted text to storage...")
        print(f"First few texts: {[text[:50] + '...' if len(text) > 50 else text for text in extracted_texts[:3]]}")
        update_progress(job_id, "extract", 85, "Saving extracted text to storage...")
        
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
        update_progress(job_id, "extract", 90, "Uploading to R2 storage...")
        upload_success = upload_to_r2(f"{user.r2_directory}/{job_id}/extracted.txt", extracted_content)
        
        if not upload_success:
            print("Upload failed, setting error status")
            update_progress(job_id, "extract", 0, "Error: Failed to save extracted text to storage")
            return
        
        print("Upload successful, proceeding...")
        update_progress(job_id, "extract", 100, "Text extraction completed successfully")
        
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
        
        print(f"Background extraction completed successfully for job {job_id}")
        
    except Exception as e:
        print(f"Error in background extraction for job {job_id}: {e}")
        update_progress(job_id, "extract", 0, f"Error: {str(e)}")

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
async def chunk_text(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Step 2: Create chunks from extracted text."""
    try:
        print(f"Starting chunking for job {job_id} for user {user.user_id}")
        update_progress(job_id, "chunk", 0, "Starting chunking process...")
        
        # Download extracted text from R2 using user directory
        update_progress(job_id, "chunk", 10, "Downloading extracted text...")
        extracted_content = download_from_r2(f"{user.r2_directory}/{job_id}/extracted.txt")
        if not extracted_content:
            raise HTTPException(status_code=404, detail="Extracted text not found")

        update_progress(job_id, "chunk", 20, "Analyzing text structure...")
        
        # Chunk the text with reduced token limit to stay under OpenAI rate limits
        max_tokens = 150000  # Reduced from 200,000 to 150,000 to stay well under 200k limit
        chunks = []
        
        # Split by conversation entries
        update_progress(job_id, "chunk", 30, "Splitting text into conversations...")
        conversations = extracted_content.split('\n\n')
        
        current_chunk = []
        current_tokens = 0
        total_conversations = len(conversations)
        
        update_progress(job_id, "chunk", 40, f"Processing {total_conversations} conversations...")
        
        for i, conv in enumerate(conversations):
            # Update progress every 100 conversations or at end
            if i % 100 == 0 or i == total_conversations - 1:
                progress_percent = 40 + (i / total_conversations * 50)  # 40% to 90%
                update_progress(job_id, "chunk", progress_percent, f"Processing conversation {i+1}/{total_conversations}")
            
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
        
        print(f" Created {len(chunks)} chunks")
        update_progress(job_id, "chunk", 90, f"Created {len(chunks)} chunks, saving to storage...")
        
        # Save chunks to R2
        chunk_info = []
        for i, chunk in enumerate(chunks):
            # Update progress for chunk uploads
            if i % 5 == 0 or i == len(chunks) - 1:  # Every 5 chunks or last chunk
                progress_percent = 90 + ((i + 1) / len(chunks) * 8)  # 90% to 98%
                update_progress(job_id, "chunk", progress_percent, f"Uploading chunk {i+1}/{len(chunks)}")
            
            upload_to_r2(f"{user.r2_directory}/{job_id}/chunk_{i+1:03d}.txt", chunk)
            chunk_info.append({
                "chunk_number": i + 1,
                "token_count": count_tokens(chunk),
                "preview": chunk[:200] + "..." if len(chunk) > 200 else chunk
            })
        
        update_progress(job_id, "chunk", 99, "Saving chunk metadata...")
        
        # Save chunk metadata
        chunk_metadata = {
            "job_id": job_id,
            "total_chunks": len(chunks),
            "chunks": chunk_info,
            "chunked_at": datetime.utcnow().isoformat(),
            "max_tokens_per_chunk": max_tokens
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json", json.dumps(chunk_metadata, indent=2))
        
        # Update job summary
        job_summary = {
            "job_id": job_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "chunked",
            "total_chunks": len(chunks),
            "chunked_at": datetime.utcnow().isoformat()
        }
        upload_to_r2(f"{user.r2_directory}/{job_id}/job_summary.json", json.dumps(job_summary, indent=2))
        
        update_progress(job_id, "chunk", 100, f"Chunking completed! Created {len(chunks)} chunks")
        
        return {
            "job_id": job_id,
            "status": "chunked",
            "total_chunks": len(chunks),
            "chunks": chunk_info
        }
        
    except Exception as e:
        print(f" Error chunking text: {e}")
        raise HTTPException(status_code=500, detail=f"Chunking failed: {str(e)}")

@app.post("/api/analyze/{job_id}")
async def analyze_chunks(job_id: str, request: AnalyzeRequest, user: AuthenticatedUser = Depends(get_current_user)):
    """Step 3: Analyze chunks with AI."""
    try:
        print(f"Starting AI analysis for job {job_id} for user {user.user_id}")
        
        # Get user's OpenAI API key from their profile (prefer this over request)
        user_api_key = await get_user_openai_key(user.user_id)
        api_key_to_use = user_api_key or request.openai_api_key
        
        if not api_key_to_use:
            raise HTTPException(
                status_code=400, 
                detail="No OpenAI API key found. Please save your API key in your profile settings."
            )
        
        print(f"Using {'profile' if user_api_key else 'request'} API key for analysis")
        
        # Get OpenAI client with user's API key
        openai_client = get_openai_client(api_key_to_use)
        
        # Get chunk metadata from user directory
        chunk_metadata_content = download_from_r2(f"{user.r2_directory}/{job_id}/chunks_metadata.json")
        if not chunk_metadata_content:
            raise HTTPException(status_code=404, detail="Chunk metadata not found")
        
        chunk_metadata = json.loads(chunk_metadata_content)
        total_chunks = chunk_metadata["total_chunks"]
        
        print(f"Found {total_chunks} chunks to analyze")
        
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
        
        for i in range(total_chunks):
            try:
                chunk_key = f"{user.r2_directory}/{job_id}/chunk_{i+1:03d}.txt"
                print(f" Processing chunk {i+1}/{total_chunks} - downloading {chunk_key}")
                
                chunk_content = download_from_r2(chunk_key)
                
                if not chunk_content:
                    print(f" Failed to download chunk {i+1}")
                    failed_chunks.append(i+1)
                    continue
                
                print(f" Downloaded chunk {i+1} ({len(chunk_content)} chars)")
                print(f" Sending chunk {i+1} to AI for analysis...")
                
                # Process with OpenAI
                ai_response = openai_client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",
                    messages=[{"role": "user", "content": ucp_prompt + chunk_content}],
                    max_completion_tokens=15000,
                    timeout=120  # 2 minute timeout per chunk
                )
                
                input_tokens = count_tokens(chunk_content)
                output_tokens = ai_response.usage.completion_tokens
                
                result = {
                    "chunk_index": i + 1,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "content": ai_response.choices[0].message.content,
                    "processed_at": datetime.utcnow().isoformat()
                }
                
                # Calculate costs
                input_cost = (input_tokens / 1_000_000) * 0.050
                output_cost = (output_tokens / 1_000_000) * 0.400
                
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                total_cost += input_cost + output_cost
                
                results.append(result)
                
                print(f" Chunk {i+1} analyzed successfully (cost: ${input_cost + output_cost:.3f})")
                
                # Save individual result to R2
                upload_to_r2(f"{user.r2_directory}/{job_id}/result_{i+1:03d}.json", json.dumps(result, indent=2))
                
            except Exception as chunk_error:
                print(f" Error processing chunk {i+1}: {chunk_error}")
                failed_chunks.append(i+1)
                continue
        
        if not results:
            raise HTTPException(status_code=500, detail=f"Failed to process any chunks. Failed chunks: {failed_chunks}")
        
        print(f"📊 Analysis complete: {len(results)}/{total_chunks} chunks processed successfully")
        if failed_chunks:
            print(f" Failed chunks: {failed_chunks}")
        
        # Create complete UCP
        aggregated_content = "\n\n" + "="*100 + "\n\n".join([
            f"# CHUNK {r['chunk_index']} ANALYSIS\n\n{r['content']}"
            for r in results if r.get('content')
        ])
        
        upload_to_r2(f"{user.r2_directory}/{job_id}/complete_ucp.txt", aggregated_content)
        
        # Save summary to R2
        summary = {
            "job_id": job_id,
            "total_chunks": total_chunks,
            "processed_chunks": len(results),
            "failed_chunks": failed_chunks,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cost": total_cost,
            "completed_at": datetime.utcnow().isoformat()
        }
        
        upload_to_r2(f"{user.r2_directory}/{job_id}/summary.json", json.dumps(summary, indent=2))
        
        # Update job status to completed
        try:
            await update_job_status_in_db(
                user, 
                job_id, 
                "completed", 
                progress=100,
                metadata={
                    "analysis_completed": True,
                    "total_chunks": total_chunks,
                    "total_cost": total_cost
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
                "failed_chunks": failed_chunks
            }
            
            analysis_stats = {
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "total_cost": total_cost,
                "completed_at": summary["completed_at"]
            }
            
            pack_record = await create_pack_in_db(
                user=user,
                job_id=job_id,
                pack_name=pack_name,
                r2_pack_path=r2_pack_path,
                extraction_stats=extraction_stats,
                analysis_stats=analysis_stats
            )
            
            if pack_record:
                print(f"Pack saved to database: {pack_record}")
            else:
                print("Warning: Failed to save pack to database")
                
        except Exception as e:
            print(f"Error saving pack to database: {e}")
            # Let's add more detailed error information
            import traceback
            print(f"Full error traceback: {traceback.format_exc()}")
        
        print(f"Processing complete! Total cost: ${total_cost:.3f}")
        print(f"Results stored in R2 bucket: {R2_BUCKET}")
        print(f"Successfully processed: {len(results)}/{total_chunks} chunks")
        
        return {
            "job_id": job_id,
            "status": "completed",
            "total_chunks": total_chunks,
            "processed_chunks": len(results),
            "failed_chunks": failed_chunks,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cost": total_cost
        }
        
    except Exception as e:
        print(f" Error analyzing chunks: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/api/status/{job_id}")
async def get_status(job_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    """Get job status and progress."""
    try:
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
                "analyzed": False
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
        
        # Fetch packs from Supabase
        result = supabase.table("packs").select("*").eq("user_id", user.user_id).order("created_at", desc=True).execute()
        
        packs = []
        for pack in result.data:
            pack_data = {
                "job_id": pack["job_id"],
                "pack_name": pack["pack_name"],
                "status": "completed",
                "created_at": pack["created_at"],
                "stats": {
                    "total_chunks": pack.get("extraction_stats", {}).get("total_chunks", 0),
                    "processed_chunks": pack.get("extraction_stats", {}).get("processed_chunks", 0),
                    "failed_chunks": pack.get("extraction_stats", {}).get("failed_chunks", 0),
                    "total_input_tokens": pack.get("analysis_stats", {}).get("total_input_tokens", 0),
                    "total_output_tokens": pack.get("analysis_stats", {}).get("total_output_tokens", 0),
                    "total_cost": pack.get("analysis_stats", {}).get("total_cost", 0)
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
        print(f"🔄 CREATING MISSING JOB RECORD...")
        job_record = await create_job_in_db(
            user=user,
            job_id=job_id,
            file_name="test_file.txt",
            file_size=1000,
            status="completed"
        )
        
        if job_record:
            print(f"✅ Job created or already exists")
        
        # Now try to create the pack
        print(f"🔄 ATTEMPTING TO CREATE PACK...")
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
        print(f"❌ TEST FAILED: {e}")
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
        
        # Try to decode the token to see what's in it
        try:
            # First decode without verification to see the payload
            payload = jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
            
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
                "total_chunks": 2,  # We can see 2 chunk files in the screenshot
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
        print(f"Getting profile for user: {current_user.user_id}")
        
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        result = supabase.table("user_profiles").select("*").eq("id", current_user.user_id).single().execute()
        
        if result.data:
            # Don't return the OpenAI API key in the response for security
            profile_data = {**result.data}
            if "openai_api_key" in profile_data:
                profile_data["has_openai_key"] = bool(profile_data["openai_api_key"])
                del profile_data["openai_api_key"]
            
            return {"profile": profile_data}
        else:
            raise HTTPException(status_code=404, detail="User profile not found")
            
    except Exception as e:
        print(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")

@app.post("/api/profile/openai-key")
async def save_openai_key(
    request: dict,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Save or update the user's OpenAI API key"""
    try:
        api_key = request.get("api_key", "").strip()
        
        if not api_key:
            raise HTTPException(status_code=400, detail="API key is required")
        
        print(f"Saving OpenAI API key for user: {current_user.user_id}")
        
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Update the user's profile with the new API key
        result = supabase.table("user_profiles").update({
            "openai_api_key": api_key,
            "updated_at": "NOW()"
        }).eq("id", current_user.user_id).execute()
        
        if result.data:
            return {"message": "OpenAI API key saved successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save API key")
            
    except Exception as e:
        print(f"Error saving OpenAI API key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {str(e)}")

@app.delete("/api/profile/openai-key")
async def remove_openai_key(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Remove the user's OpenAI API key"""
    try:
        print(f"Removing OpenAI API key for user: {current_user.user_id}")
        
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Remove the API key from the user's profile
        result = supabase.table("user_profiles").update({
            "openai_api_key": None,
            "updated_at": "NOW()"
        }).eq("id", current_user.user_id).execute()
        
        if result.data:
            return {"message": "OpenAI API key removed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove API key")
            
    except Exception as e:
        print(f"Error removing OpenAI API key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove API key: {str(e)}")

async def get_user_openai_key(user_id: str) -> Optional[str]:
    """Get the user's OpenAI API key from their profile"""
    try:
        if not supabase:
            return None
            
        result = supabase.table("user_profiles").select("openai_api_key").eq("id", user_id).single().execute()
        
        if result.data and result.data.get("openai_api_key"):
            return result.data["openai_api_key"].strip()
        
        return None
        
    except Exception as e:
        print(f"Error getting user OpenAI API key: {e}")
        return None

if __name__ == "__main__":
    print(" Starting Simple UCP Backend with R2 Storage - 3 Step Process...")
    print(f" Using R2 bucket: {R2_BUCKET}")
    print(" Steps: 1) Extract → 2) Chunk → 3) Analyze")
    uvicorn.run("simple_backend:app", host="0.0.0.0", port=8000, reload=False)

"""
Script to remove all packs from a specific user except for one specified pack.
This is useful for cleaning up test packs that weren't properly deleted from Cloudflare R2.

User ID: 08192f18-0b1c-4d00-9b90-208c64dd972e
Pack to keep: ae575328-4d4d-4770-9485-3148e0a8e604
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import from simple_backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client
from dotenv import load_dotenv
import requests
from urllib.parse import urlparse
import hashlib
import hmac
from datetime import datetime

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY")
R2_BUCKET = os.getenv("R2_BUCKET_NAME")

# Target user and pack to keep
TARGET_USER_ID = "08192f18-0b1c-4d00-9b90-208c64dd972e"
PACK_TO_KEEP = "ae575328-4d4d-4770-9485-3148e0a8e604"

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Create requests session for R2
r2_session = requests.Session()


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


def list_r2_objects(prefix: str = ""):
    """List objects in R2 bucket with optional prefix using boto3."""
    try:
        import boto3
        from botocore.config import Config
        
        print(f"📋 Listing R2 objects with prefix: {prefix}")
        
        # Create boto3 client for R2
        s3_client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
        # List objects with pagination support
        keys = []
        continuation_token = None
        
        while True:
            if continuation_token:
                response = s3_client.list_objects_v2(
                    Bucket=R2_BUCKET,
                    Prefix=prefix,
                    ContinuationToken=continuation_token
                )
            else:
                response = s3_client.list_objects_v2(
                    Bucket=R2_BUCKET,
                    Prefix=prefix
                )
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    keys.append(obj['Key'])
            
            # Check if there are more results
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break
        
        print(f"   Found {len(keys)} objects")
        return keys
            
    except Exception as e:
        print(f"❌ Error listing R2 objects: {e}")
        import traceback
        traceback.print_exc()
        return []


def delete_from_r2(key: str) -> bool:
    """Delete a single object from R2."""
    try:
        url = f"{R2_ENDPOINT}/{R2_BUCKET}/{key}"
        headers = {'Host': urlparse(R2_ENDPOINT).netloc}
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
        print(f"🗑️  Deleting R2 directory: {prefix}")
        
        # List all objects with this prefix
        objects = list_r2_objects(prefix)
        
        if not objects:
            print(f"   No objects found with prefix: {prefix}")
            return True
        
        print(f"   Found {len(objects)} objects to delete")
        deleted_count = 0
        
        # Delete each object
        for key in objects:
            if delete_from_r2(key):
                deleted_count += 1
                print(f"   ✅ Deleted: {key}")
            else:
                print(f"   ❌ Failed to delete: {key}")
        
        print(f"   ✅ Deleted {deleted_count}/{len(objects)} objects from R2")
        return deleted_count == len(objects)
        
    except Exception as e:
        print(f"❌ Error deleting R2 directory: {e}")
        return False


def get_user_packs(user_id: str):
    """Get all packs for a specific user"""
    try:
        result = supabase.rpc("get_user_packs_v2_with_stats", {
            "user_uuid": user_id
        }).execute()
        
        if result.data:
            return result.data
        return []
        
    except Exception as e:
        print(f"❌ Error getting user packs: {e}")
        return []


def delete_pack_from_db(user_id: str, pack_id: str):
    """Delete a pack from the database using RPC function"""
    try:
        result = supabase.rpc("delete_pack_v2", {
            "user_uuid": user_id,
            "target_pack_id": pack_id
        }).execute()
        
        if result.data:
            print(f"   ✅ Pack {pack_id} deleted from database")
            return True
        else:
            print(f"   ❌ Failed to delete pack {pack_id} from database")
            return False
            
    except Exception as e:
        print(f"   ❌ Error deleting pack from database: {e}")
        return False


def delete_pack(user_id: str, pack_id: str, pack_name: str):
    """Delete a pack and all its R2 files"""
    print(f"\n🗑️  Deleting pack: {pack_name} ({pack_id})")
    
    # Get user's R2 directory (assuming format: user_<uuid>)
    r2_directory = f"user_{user_id}"
    r2_prefix = f"{r2_directory}/{pack_id}/"
    
    # Delete R2 files
    r2_success = delete_r2_directory(r2_prefix)
    
    # Delete from database
    db_success = delete_pack_from_db(user_id, pack_id)
    
    if r2_success and db_success:
        print(f"   ✅ Successfully deleted pack: {pack_name}")
        return True
    else:
        print(f"   ⚠️  Partially deleted pack: {pack_name} (R2: {r2_success}, DB: {db_success})")
        return False


def get_r2_pack_directories(user_id: str):
    """Get all pack directories in R2 for a user"""
    try:
        # Try multiple possible path formats
        possible_prefixes = [
            f"user_{user_id}/",
            f"{user_id}/",
            f"users/{user_id}/",
        ]
        
        all_pack_ids = set()
        
        for r2_prefix in possible_prefixes:
            print(f"\n🔍 Scanning R2 for pack directories in: {r2_prefix}")
            
            # List all objects under this prefix
            all_objects = list_r2_objects(r2_prefix)
            
            if not all_objects:
                print(f"   No objects found with prefix: {r2_prefix}")
                continue
            
            print(f"   Found {len(all_objects)} total objects in R2")
            
            # Extract unique pack IDs from paths
            # Format is: <prefix>/<pack_id>/...
            for obj_path in all_objects:
                parts = obj_path.split('/')
                # Find the pack_id part (should be right after the user directory)
                if len(parts) >= 2:
                    # The pack_id is the part after the user directory
                    pack_id = parts[1] if r2_prefix.startswith("user_") or r2_prefix.startswith("users/") else parts[0]
                    if pack_id and pack_id != user_id and not pack_id.startswith("user_"):
                        all_pack_ids.add(pack_id)
        
        if all_pack_ids:
            print(f"\n✅ Found {len(all_pack_ids)} unique pack directories across all paths")
        else:
            print(f"\n⚠️  No pack directories found in R2")
        
        return list(all_pack_ids)
        
    except Exception as e:
        print(f"❌ Error scanning R2: {e}")
        import traceback
        traceback.print_exc()
        return []


def main():
    """Main function to delete all packs except the one to keep"""
    print("=" * 80)
    print("🧹 PACK CLEANUP SCRIPT")
    print("=" * 80)
    print(f"Target User: {TARGET_USER_ID}")
    print(f"Pack to Keep: {PACK_TO_KEEP}")
    print("=" * 80)
    
    # Get all packs from database
    print("\n📦 Fetching all packs from database...")
    db_packs = get_user_packs(TARGET_USER_ID)
    
    if db_packs:
        print(f"✅ Found {len(db_packs)} pack(s) in database")
        for pack in db_packs:
            print(f"   - {pack['pack_name']} ({pack['pack_id']})")
    else:
        print("⚠️  No packs found in database")
    
    # Get all pack directories from R2
    r2_pack_ids = get_r2_pack_directories(TARGET_USER_ID)
    
    if not r2_pack_ids:
        print("\n❌ No pack directories found in R2")
        return
    
    # Identify orphaned packs (in R2 but not in database)
    db_pack_ids = {p['pack_id'] for p in db_packs}
    orphaned_pack_ids = [pid for pid in r2_pack_ids if pid not in db_pack_ids]
    
    # Identify packs to delete (all except the one to keep)
    packs_to_delete_from_db = [p for p in db_packs if p['pack_id'] != PACK_TO_KEEP]
    r2_dirs_to_delete = [pid for pid in r2_pack_ids if pid != PACK_TO_KEEP]
    
    print(f"\n📊 Summary:")
    print(f"   Total R2 directories: {len(r2_pack_ids)}")
    print(f"   Database packs: {len(db_packs)}")
    print(f"   Orphaned R2 directories: {len(orphaned_pack_ids)}")
    print(f"   R2 directories to delete: {len(r2_dirs_to_delete)}")
    print(f"   Database packs to delete: {len(packs_to_delete_from_db)}")
    
    if PACK_TO_KEEP in r2_pack_ids:
        print(f"\n✅ Pack to KEEP (found in R2): {PACK_TO_KEEP}")
    else:
        print(f"\n⚠️  Pack to KEEP not found in R2: {PACK_TO_KEEP}")
    
    if not r2_dirs_to_delete and not packs_to_delete_from_db:
        print("\n✅ No packs to delete!")
        return
    
    if orphaned_pack_ids:
        print(f"\n🗑️  Orphaned R2 directories to DELETE (not in database):")
        for pack_id in orphaned_pack_ids[:10]:  # Show first 10
            print(f"   - {pack_id}")
        if len(orphaned_pack_ids) > 10:
            print(f"   ... and {len(orphaned_pack_ids) - 10} more")
    
    if packs_to_delete_from_db:
        print(f"\n🗑️  Database packs to DELETE:")
        for pack in packs_to_delete_from_db:
            print(f"   - {pack['pack_name']} ({pack['pack_id']})")
    
    # Confirm deletion
    print("\n" + "=" * 80)
    print(f"⚠️  This will delete {len(r2_dirs_to_delete)} R2 directories")
    response = input("Are you sure you want to delete these? (yes/no): ")
    
    if response.lower() != 'yes':
        print("❌ Deletion cancelled")
        return
    
    # Delete packs
    print("\n🚀 Starting deletion process...")
    success_count = 0
    failure_count = 0
    
    # Delete all R2 directories (including orphaned ones)
    for pack_id in r2_dirs_to_delete:
        pack_name = "Orphaned"
        # Find pack name if it exists in database
        for pack in db_packs:
            if pack['pack_id'] == pack_id:
                pack_name = pack['pack_name']
                break
        
        print(f"\n🗑️  Deleting: {pack_name} ({pack_id})")
        
        # Delete R2 files
        r2_directory = f"user_{TARGET_USER_ID}"
        r2_prefix = f"{r2_directory}/{pack_id}/"
        r2_success = delete_r2_directory(r2_prefix)
        
        # Delete from database if it exists
        db_success = True
        if pack_id in db_pack_ids:
            db_success = delete_pack_from_db(TARGET_USER_ID, pack_id)
        
        if r2_success and db_success:
            print(f"   ✅ Successfully deleted")
            success_count += 1
        else:
            print(f"   ⚠️  Partially deleted (R2: {r2_success}, DB: {db_success})")
            failure_count += 1
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 DELETION SUMMARY")
    print("=" * 80)
    print(f"✅ Successfully deleted: {success_count} pack(s)")
    print(f"❌ Failed to delete: {failure_count} pack(s)")
    print(f"📦 Remaining pack: {PACK_TO_KEEP}")
    print("=" * 80)


if __name__ == "__main__":
    main()

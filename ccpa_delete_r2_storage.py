#!/usr/bin/env python3
"""
CCPA Data Deletion - R2 Storage Cleanup
User: nickekum@gmail.com
UUID: 56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c
Date: 2026-02-16
"""

import os
import sys
import boto3
from botocore.config import Config
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# R2 Configuration
R2_ENDPOINT = os.getenv('R2_ENDPOINT')
R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY')
R2_SECRET_KEY = os.getenv('R2_SECRET_KEY')
R2_BUCKET = os.getenv('R2_BUCKET_NAME')

# User directory to delete
USER_DIRECTORY = "user_56b93b0e-53f7-4c6b-9e7a-484d4bf3df9c/"

def list_r2_objects(prefix: str):
    """List all objects with the given prefix in R2."""
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
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
            
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break
        
        return keys
    except Exception as e:
        print(f"❌ Error listing R2 objects: {e}")
        return []

def delete_from_r2(key: str, s3_client):
    """Delete a single object from R2."""
    try:
        s3_client.delete_object(Bucket=R2_BUCKET, Key=key)
        return True
    except Exception as e:
        print(f"❌ Error deleting {key}: {e}")
        return False

def delete_r2_directory(prefix: str):
    """Delete all objects with a given prefix (directory) from R2."""
    try:
        print(f"\n{'='*80}")
        print(f"🗑️  CCPA R2 Storage Deletion")
        print(f"{'='*80}")
        print(f"User Directory: {prefix}")
        print(f"Bucket: {R2_BUCKET}")
        print(f"{'='*80}\n")
        
        # Create S3 client
        s3_client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
        # List all objects with this prefix
        print(f"📂 Listing objects in {prefix}...")
        objects = list_r2_objects(prefix)
        
        if not objects:
            print(f"✅ No objects found with prefix: {prefix}")
            print(f"   Directory is already empty or doesn't exist.")
            return True
        
        print(f"📊 Found {len(objects)} objects to delete\n")
        
        # Confirm deletion
        print(f"⚠️  WARNING: This will permanently delete {len(objects)} files!")
        print(f"   This action CANNOT be undone.")
        response = input(f"\n   Continue with deletion? (yes/no): ")
        
        if response.lower() != 'yes':
            print(f"\n❌ Deletion cancelled by user.")
            return False
        
        print(f"\n🗑️  Deleting objects...")
        deleted_count = 0
        failed_count = 0
        
        # Delete each object
        for i, key in enumerate(objects, 1):
            print(f"   [{i}/{len(objects)}] Deleting: {key}")
            if delete_from_r2(key, s3_client):
                deleted_count += 1
            else:
                failed_count += 1
        
        print(f"\n{'='*80}")
        print(f"✅ Deletion Complete!")
        print(f"{'='*80}")
        print(f"   Successfully deleted: {deleted_count}/{len(objects)} objects")
        if failed_count > 0:
            print(f"   Failed: {failed_count} objects")
        print(f"{'='*80}\n")
        
        return deleted_count == len(objects)
    except Exception as e:
        print(f"\n❌ Error deleting R2 directory: {e}")
        return False

if __name__ == "__main__":
    print(f"\n🔐 Verifying R2 Configuration...")
    
    if not all([R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET]):
        print(f"❌ Missing R2 environment variables!")
        print(f"   Please ensure .env file is configured with:")
        print(f"   - R2_ENDPOINT")
        print(f"   - R2_ACCESS_KEY") 
        print(f"   - R2_SECRET_KEY")
        print(f"   - R2_BUCKET_NAME")
        sys.exit(1)
    
    print(f"✅ R2 Configuration verified\n")
    
    # Execute deletion
    success = delete_r2_directory(USER_DIRECTORY)
    
    if success:
        print(f"\n✅ CCPA R2 Storage Deletion Completed Successfully")
        print(f"\n📝 Next Steps:")
        print(f"   1. ✅ SQL deletion completed (already done)")
        print(f"   2. ✅ R2 storage deleted (just completed)")
        print(f"   3. 📧 Send confirmation email to: nickekum@gmail.com")
        print(f"   4. 📋 Document this deletion in compliance logs\n")
        sys.exit(0)
    else:
        print(f"\n❌ R2 Storage Deletion Failed")
        print(f"   Please review the errors above and try again.\n")
        sys.exit(1)

#!/usr/bin/env python3
"""
Quick diagnostic script to check Memory Tree configuration
Run this to verify your setup before creating a pack
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("=" * 70)
print("MEMORY TREE DIAGNOSTIC CHECK")
print("=" * 70)

# Check 1: Environment variable
memory_tree_enabled = os.getenv("MEMORY_TREE_ENABLED", "false").lower() == "true"
print(f"\n1. Environment Variable Check:")
print(f"   MEMORY_TREE_ENABLED = {os.getenv('MEMORY_TREE_ENABLED', 'false')}")
print(f"   Parsed as: {memory_tree_enabled}")
if memory_tree_enabled:
    print("   ✅ Memory Tree is ENABLED")
else:
    print("   ❌ Memory Tree is DISABLED")
    print("   → Set MEMORY_TREE_ENABLED=true in .env file")

# Check 2: Module availability
print(f"\n2. Module Import Check:")
try:
    from memory_tree import (
        get_scope_for_source,
        apply_chunk_to_memory_tree,
        export_pack_from_tree
    )
    print("   ✅ memory_tree module imported successfully")
    print("   ✅ All required functions available")
except ImportError as e:
    print(f"   ❌ Failed to import memory_tree module: {e}")
    print("   → Check that memory_tree.py exists in the same directory")

# Check 3: Database connection (optional)
print(f"\n3. Database Connection Check:")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if supabase_url and supabase_key:
    print("   ✅ Supabase credentials found")
    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
        
        # Try to query memory_nodes table
        result = supabase.table("memory_nodes").select("id").limit(1).execute()
        print("   ✅ memory_nodes table exists and is accessible")
        
        # Count total nodes
        count_result = supabase.table("memory_nodes").select("id", count="exact").execute()
        total_nodes = count_result.count if hasattr(count_result, 'count') else 0
        print(f"   📊 Total nodes in database: {total_nodes}")
        
    except Exception as e:
        print(f"   ❌ Database check failed: {e}")
        print("   → You may need to run memory_tree_schema.sql migration")
else:
    print("   ⚠️  Supabase credentials not found in .env")

# Summary
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

if memory_tree_enabled:
    print("✅ Memory Tree feature is ENABLED")
    print("\nNext steps:")
    print("1. Restart your backend server (python simple_backend.py)")
    print("2. Create a new pack with a small text file")
    print("3. Watch the logs for [TREE] messages")
    print("4. Check the tree viewer to see if nodes appear")
else:
    print("❌ Memory Tree feature is DISABLED")
    print("\nTo enable:")
    print("1. Set MEMORY_TREE_ENABLED=true in your .env file")
    print("2. Restart your backend server")
    print("3. Create a new pack to test")

print("\nFor database diagnostics, run the queries in:")
print("  memory_tree_diagnostics.sql")
print("=" * 70)

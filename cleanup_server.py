#!/usr/bin/env python3
"""
Server Cleanup Script - Remove unnecessary files and cache
Safely removes temporary files, cache, and development artifacts
"""

import os
import shutil
import glob
from pathlib import Path

def get_file_size(path):
    """Get human readable file size"""
    try:
        size = os.path.getsize(path)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    except:
        return "Unknown"

def get_dir_size(path):
    """Get total size of directory"""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except:
                    pass
    except:
        pass
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if total < 1024.0:
            return f"{total:.1f} {unit}"
        total /= 1024.0
    return f"{total:.1f} TB"

def safe_remove(path, description=""):
    """Safely remove file or directory"""
    try:
        if os.path.isfile(path):
            size = get_file_size(path)
            os.remove(path)
            print(f"  ✅ Removed file: {description} ({size})")
            return True
        elif os.path.isdir(path):
            size = get_dir_size(path)
            shutil.rmtree(path)
            print(f"  ✅ Removed directory: {description} ({size})")
            return True
        else:
            print(f"  ⚠️  Not found: {description}")
            return False
    except Exception as e:
        print(f"  ❌ Failed to remove {description}: {e}")
        return False

def main():
    """Main cleanup function"""
    print("🧹 SERVER CLEANUP SCRIPT 🧹")
    print("This will remove unnecessary files and cache to free up space.")
    print()
    
    # Get current directory
    base_dir = os.getcwd()
    print(f"Working directory: {base_dir}")
    print()
    
    # Confirm before proceeding
    confirm = input("⚠️  Proceed with cleanup? This will remove cache, logs, and development files. (y/N): ")
    if confirm.lower() != 'y':
        print("❌ Cleanup cancelled.")
        return
    
    total_removed = 0
    
    print("\n🗑️  Starting cleanup...")
    
    # 1. Python Cache Files
    print("\n📁 Cleaning Python cache files...")
    cache_patterns = [
        "**/__pycache__",
        "**/*.pyc", 
        "**/*.pyo",
        "**/*.pyd",
        "**/.pytest_cache"
    ]
    
    for pattern in cache_patterns:
        for path in glob.glob(pattern, recursive=True):
            if safe_remove(path, f"Python cache: {path}"):
                total_removed += 1
    
    # 2. Node.js artifacts (if any)
    print("\n📁 Cleaning Node.js artifacts...")
    node_patterns = [
        "frontend/.next",
        "frontend/node_modules/.cache",
        "frontend/.turbo",
        "**/turbo-build.log"
    ]
    
    for pattern in node_patterns:
        for path in glob.glob(pattern, recursive=True):
            if safe_remove(path, f"Node.js artifact: {path}"):
                total_removed += 1
    
    # 3. System files
    print("\n📁 Cleaning system files...")
    system_patterns = [
        "**/.DS_Store",
        "**/Thumbs.db",
        "**/*.tmp",
        "**/*.temp",
        "**/*.swp",
        "**/*~"
    ]
    
    for pattern in system_patterns:
        for path in glob.glob(pattern, recursive=True):
            if safe_remove(path, f"System file: {path}"):
                total_removed += 1
    
    # 4. Development/Test files that are no longer needed
    print("\n📁 Cleaning development files...")
    dev_files = [
        "clear_r2_bucket.py",
        "fast_clear_r2_bucket.py", 
        "ultra_fast_clear_r2_bucket.py",
        "test_concurrency.py",
        "test_timing_system.py",
        "batch_processor.py",  # Assuming this was experimental
        "performance_timing.py",  # Keep if needed for monitoring
        "time_estimator.py"  # Keep if needed for the app
    ]
    
    print("  ⚠️  Development files found:")
    for file in dev_files:
        if os.path.exists(file):
            size = get_file_size(file)
            print(f"    - {file} ({size})")
    
    cleanup_dev = input("\n  Remove development/test scripts? (y/N): ")
    if cleanup_dev.lower() == 'y':
        for file in dev_files:
            if os.path.exists(file):
                if safe_remove(file, f"Dev file: {file}"):
                    total_removed += 1
    
    # 5. Documentation files (optional)
    print("\n📁 Documentation files...")
    doc_files = [
        "test.MD",
        "CONCURRENCY_CONTROL.md",
        "MODEL_CHOICE.md"
    ]
    
    print("  📄 Documentation files found:")
    for file in doc_files:
        if os.path.exists(file):
            size = get_file_size(file)
            print(f"    - {file} ({size})")
    
    cleanup_docs = input("\n  Remove documentation files? (y/N): ")
    if cleanup_docs.lower() == 'y':
        for file in doc_files:
            if os.path.exists(file):
                if safe_remove(file, f"Doc file: {file}"):
                    total_removed += 1
    
    # 6. Log files
    print("\n📁 Cleaning log files...")
    log_patterns = [
        "**/*.log",
        "**/logs/*",
        "**/*.out"
    ]
    
    for pattern in log_patterns:
        for path in glob.glob(pattern, recursive=True):
            if safe_remove(path, f"Log file: {path}"):
                total_removed += 1
    
    # 7. Check for large unused files
    print("\n📁 Checking for large files...")
    large_files = []
    
    for root, dirs, files in os.walk('.'):
        # Skip node_modules and .git
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.venv']]
        
        for file in files:
            filepath = os.path.join(root, file)
            try:
                size = os.path.getsize(filepath)
                if size > 10 * 1024 * 1024:  # > 10MB
                    large_files.append((filepath, size))
            except:
                pass
    
    if large_files:
        print("  📊 Large files found (>10MB):")
        large_files.sort(key=lambda x: x[1], reverse=True)
        for filepath, size in large_files[:5]:  # Show top 5
            readable_size = get_file_size(filepath)
            print(f"    - {filepath} ({readable_size})")
    
    # 8. Empty directories
    print("\n📁 Removing empty directories...")
    empty_dirs = []
    for root, dirs, files in os.walk('.', topdown=False):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                if not os.listdir(dir_path):
                    empty_dirs.append(dir_path)
            except:
                pass
    
    for empty_dir in empty_dirs:
        if safe_remove(empty_dir, f"Empty directory: {empty_dir}"):
            total_removed += 1
    
    print(f"\n✅ Cleanup complete!")
    print(f"📊 Total items removed: {total_removed}")
    print(f"💾 Disk space has been freed up!")
    
    # Final recommendations
    print(f"\n💡 Additional recommendations:")
    print(f"  - Run 'git gc' to clean up git repository")
    print(f"  - Consider running 'npm prune' in frontend/ to remove unused packages")
    print(f"  - Review .env files to ensure no sensitive data is exposed")

if __name__ == "__main__":
    main()

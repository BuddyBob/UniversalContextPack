"""
Quick Test Runner for Process V3 E2E Tests
Python alternative to bash script for cross-platform compatibility
"""
import subprocess
import sys
import os
from pathlib import Path


def print_header(text, color='blue'):
    """Print colored header"""
    colors = {
        'blue': '\033[0;34m',
        'green': '\033[0;32m',
        'yellow': '\033[1;33m',
        'red': '\033[0;31m',
    }
    reset = '\033[0m'
    color_code = colors.get(color, colors['blue'])
    
    print(f"\n{color_code}{'='*60}{reset}")
    print(f"{color_code}  {text}{reset}")
    print(f"{color_code}{'='*60}{reset}\n")


def check_dependencies():
    """Check and install required dependencies"""
    print_header("Checking Dependencies")
    
    required_packages = [
        'pytest',
        'requests',
        'supabase',
        'python-dotenv'
    ]
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"✅ {package} installed")
        except ImportError:
            print(f"⚠️  Installing {package}...")
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
            print(f"✅ {package} installed successfully")


def check_environment():
    """Check if environment is properly configured"""
    print_header("Checking Environment")
    
    # Check if .env exists
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found")
        print("   Please create .env with required credentials:")
        print("   - TEST_USER_EMAIL")
        print("   - TEST_USER_PASSWORD")
        print("   - NEXT_PUBLIC_SUPABASE_URL")
        print("   - NEXT_PUBLIC_SUPABASE_ANON_KEY")
        print("")
    else:
        print("✅ .env file found")
    
    # Check if test file exists
    test_file = Path("frontend/app/process-v3/conversations.json")
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        sys.exit(1)
    else:
        size_mb = test_file.stat().st_size / (1024 * 1024)
        print(f"✅ Test file found: {test_file} ({size_mb:.2f} MB)")


def run_tests(test_args=None):
    """Run the test suite"""
    print_header("Running Tests")
    
    # Build pytest command
    cmd = [
        sys.executable,
        '-m',
        'pytest',
        'tests/test_process_v3_e2e.py',
        '-v',  # Verbose
        '-s',  # Show print statements
    ]
    
    # Add any additional arguments
    if test_args:
        cmd.extend(test_args)
    
    # Run tests
    try:
        result = subprocess.run(cmd, check=True)
        print_header("✅ All Tests Passed!", 'green')
        return 0
    except subprocess.CalledProcessError:
        print_header("❌ Some Tests Failed", 'red')
        return 1


def main():
    """Main entry point"""
    print_header("Process V3 E2E Test Runner")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher required")
        sys.exit(1)
    
    print(f"✅ Python version: {sys.version.split()[0]}")
    
    # Check dependencies
    check_dependencies()
    
    # Check environment
    check_environment()
    
    # Run tests
    test_args = sys.argv[1:] if len(sys.argv) > 1 else None
    exit_code = run_tests(test_args)
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

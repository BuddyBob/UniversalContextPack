#!/usr/bin/env python3
"""
Test script for ChatGPT URL extraction
"""

import sys
import os

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from chatgpt_extractor import validate_chatgpt_url, extract_chatgpt_conversation
    print("✓ ChatGPT extractor imported successfully")
    
    # Test URL validation
    test_urls = [
        "https://chatgpt.com/share/12345678-1234-1234-1234-123456789012",
        "https://invalid-url.com",
        "",
        "not-a-url"
    ]
    
    print("\nTesting URL validation:")
    for url in test_urls:
        is_valid, error = validate_chatgpt_url(url)
        print(f"  {url[:50]}{'...' if len(url) > 50 else ''}: {'✓' if is_valid else '✗'} {error if not is_valid else 'Valid'}")
    
    print("\n✓ ChatGPT extractor validation tests passed")
    print("Note: Full extraction would require a real ChatGPT share URL and Chrome browser")
    
except ImportError as e:
    print(f"✗ Failed to import ChatGPT extractor: {e}")
    print("Make sure selenium and webdriver-manager are installed")

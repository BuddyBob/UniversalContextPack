#!/usr/bin/env python3
"""
Fast Claude Extractor with aggressive timeouts
"""

import json
import time
import re
import os
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from contextlib import contextmanager

class FastClaudeExtractor:
    def __init__(self, headless=True, timeout=15):
        self.headless = headless
        self.timeout = timeout
    
    @contextmanager
    def get_driver(self):
        """Get a Chrome driver with ultra-fast options"""
        driver = None
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            chrome_options.add_argument('--disable-images')
            chrome_options.add_argument('--window-size=800,600')
            
            # Try to use ChromeDriverManager
            try:
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception as e:
                print(f"ChromeDriverManager failed: {e}, trying default")
                driver = webdriver.Chrome(options=chrome_options)
            
            # Set very aggressive timeouts
            driver.set_page_load_timeout(5)
            driver.implicitly_wait(1)
            
            yield driver
        
        except Exception as e:
            print(f"Failed to create Chrome driver: {e}")
            raise
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
    
    def parse_content_into_messages(self, full_text):
        """Parse extracted text content into conversation messages"""
        messages = []
        
        # Clean up the text
        text = re.sub(r'\s+', ' ', full_text).strip()
        
        # Quick security check first
        if any(keyword in text.lower() for keyword in [
            'verify you are human', 'security of your connection', 
            'checking your browser', 'waiting for claude.ai',
            'cloudflare', 'verification successful'
        ]):
            raise ValueError("Page shows security verification - URL may be inaccessible or require authentication")
        
        # Try to split into logical parts
        sections = []
        
        # Split on common conversation indicators
        potential_splits = [
            r'(?i)(user:|human:|you:)',
            r'(?i)(assistant:|claude:|ai:)',
            r'(?i)(question:|answer:)',
            r'\n\n+'
        ]
        
        # Try each split pattern
        for pattern in potential_splits:
            parts = re.split(pattern, text)
            if len(parts) > 1:
                sections = [part.strip() for part in parts if part.strip()]
                break
        
        # If no clear patterns, try to create logical chunks
        if not sections:
            chunk_size = 2000
            sections = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
        
        # Convert sections to messages
        for i, section in enumerate(sections):
            if len(section.strip()) > 50:
                role = 'user' if i % 2 == 0 else 'assistant'
                messages.append({
                    'role': role,
                    'content': section.strip(),
                    'timestamp': None
                })
        
        # If we couldn't parse properly, return the full content as one message
        if not messages:
            messages = [{
                'role': 'assistant',
                'content': text,
                'timestamp': None
            }]
        
        return messages
    
    def extract_conversation_fast(self, url):
        """Fast extraction with aggressive timeouts"""
        print(f"Fast Claude extraction from: {url}")
        
        if not url or 'claude.ai/share/' not in url:
            raise ValueError("Invalid Claude share URL")
        
        # Quick URL ID extraction
        conv_id = url.split('/')[-1]
        if len(conv_id) < 10:
            raise ValueError("Invalid conversation ID")
        
        with self.get_driver() as driver:
            start_time = time.time()
            
            try:
                print("Loading page (5s timeout)...")
                driver.get(url)
                print(f"Page loaded in {time.time() - start_time:.1f}s")
                
                # Quick check for content
                time.sleep(0.5)
                
                # Try to get any text content quickly
                try:
                    body = driver.find_element(By.TAG_NAME, 'body')
                    full_text = body.get_attribute('textContent') or ""
                    
                    # Look for any substantial content
                    if len(full_text.strip()) < 100:
                        raise ValueError("Insufficient content found - page may not have loaded properly")
                    
                    # Parse the content into messages
                    messages = self.parse_content_into_messages(full_text)
                    
                    # Return the full extracted content
                    return {
                        'success': True,
                        'conversation_id': conv_id,
                        'title': f"Claude Conversation {conv_id}",
                        'messages': messages,
                        'source': 'claude_share_fast',
                        'url': url,
                        'extraction_time': time.time() - start_time
                    }
                    
                except Exception as e:
                    raise ValueError(f"Failed to extract content: {e}")
            
            except Exception as e:
                elapsed = time.time() - start_time
                print(f"Extraction failed after {elapsed:.1f}s: {e}")
                raise

def extract_claude_conversation_fast(url, timeout=15):
    """Fast Claude extraction"""
    extractor = FastClaudeExtractor(timeout=timeout)
    return extractor.extract_conversation_fast(url)

def validate_claude_url(url):
    """Validate Claude share URL"""
    if not url:
        return False, "URL is required"
    
    if 'claude.ai/share/' not in url:
        return False, "Must be a Claude share URL"
    
    # Additional validation
    try:
        parsed = urlparse(url)
        path_parts = [part for part in parsed.path.split('/') if part]
        
        # For Claude URLs, we expect the pattern: /share/{conversation_id}
        if len(path_parts) >= 2 and path_parts[0] == 'share':
            conversation_id = path_parts[1]
            if len(conversation_id) >= 10:
                return True, "Valid Claude share URL"
        
        return False, "Invalid Claude share URL format"
    
    except Exception as e:
        return False, f"Error validating URL: {e}"

if __name__ == "__main__":
    # Test the fast extractor
    test_url = "https://claude.ai/share/74f51402-c8be-41a4-8a7d-1c7dd343aa12"
    
    try:
        print("Testing fast Claude extraction...")
        start = time.time()
        result = extract_claude_conversation_fast(test_url)
        end = time.time()
        print(f"Success in {end - start:.1f}s!")
        print(f"Messages: {len(result['messages'])}")
        
        # Show first message preview
        if result['messages']:
            first_msg = result['messages'][0]
            preview = first_msg['content'][:200] + "..." if len(first_msg['content']) > 200 else first_msg['content']
            print(f"First message preview: {preview}")
        
    except Exception as e:
        end = time.time()
        print(f"Failed in {end - start:.1f}s: {e}")

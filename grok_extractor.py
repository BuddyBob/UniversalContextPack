#!/usr/bin/env python3
"""
Simple Grok Extractor - Robust text extraction from Grok conversations
"""

import json
import time
import re
from urllib.parse import urlparse, unquote
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from contextlib import contextmanager

class GrokTextExtractor:
    """Simple text extractor for Grok conversations"""
    
    def __init__(self, headless=True, timeout=30):
        self.headless = headless
        self.timeout = timeout
    
    @contextmanager
    def get_driver(self):
        """Get configured Chrome WebDriver"""
        driver = None
        try:
            options = Options()
            if self.headless:
                options.add_argument('--headless=new')
            
            # Standard options for better compatibility
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            # Hide automation
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            
            # Additional stealth
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            yield driver
        finally:
            if driver:
                driver.quit()
    
    def extract_conversation(self, url):
        """
        Extract conversation from Grok URL and format for UCP backend
        
        Args:
            url (str): Grok share URL
            
        Returns:
            dict: UCP-compatible format with messages array
        """
        try:
            # Validate URL
            conv_id = self._parse_grok_url(url)
            
            # Extract text
            with self.get_driver() as driver:
                text_data = self._get_page_text(driver, url)
                
                # Parse into messages format
                messages = self._parse_text_to_messages(text_data['text'])
                
                return {
                    'success': True,
                    'conversation_id': conv_id,
                    'title': f"Grok Conversation {conv_id}",
                    'messages': messages,
                    'source': 'grok_share',
                    'url': url,
                    'extraction_time': time.time()
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'url': url,
                'extraction_time': time.time()
            }
    
    def _parse_grok_url(self, url):
        """Parse and validate Grok URL"""
        if not url:
            raise ValueError("URL is required")
        
        url = url.strip()
        
        if 'grok.com/share/' not in url:
            raise ValueError("Must be a Grok share URL")
        
        try:
            parsed = urlparse(url)
            path_parts = [part for part in parsed.path.split('/') if part]
            
            if len(path_parts) >= 2 and path_parts[0] == 'share':
                conversation_id = unquote(path_parts[1])
                if len(conversation_id) >= 10:
                    return conversation_id
            
            raise ValueError("Invalid Grok share URL format")
        except Exception:
            raise ValueError("Invalid URL format")
    
    def _get_page_text(self, driver, url):
        """Get all text from the Grok page"""
        print(f"Loading Grok conversation...")
        driver.set_page_load_timeout(15)
        driver.get(url)
        
        # Wait for page load
        WebDriverWait(driver, self.timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Wait for content to load
        time.sleep(8)
        
        # Get all text
        body = driver.find_element(By.TAG_NAME, "body")
        all_text = body.text
        
        # Check for common blocking patterns
        if any(keyword in all_text.lower() for keyword in [
            'access denied', 'not found', 'error', 'blocked',
            'sign in', 'login required', 'private conversation'
        ]):
            raise ValueError("Conversation appears to be private or inaccessible")
        
        # Basic validation
        if not all_text or len(all_text) < 50:
            raise ValueError("No substantial content found - conversation may be private")
        
        return {
            'text': self._clean_text(all_text)
        }
    
    def _clean_text(self, text):
        """Basic text cleaning"""
        if not text:
            return ""
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    def _parse_text_to_messages(self, text):
        """Parse text into message format"""
        messages = []
        
        # Simple parsing - split into chunks
        chunks = text.split('\n\n')
        chunks = [chunk.strip() for chunk in chunks if chunk.strip() and len(chunk.strip()) > 20]
        
        for i, chunk in enumerate(chunks):
            role = 'user' if i % 2 == 0 else 'assistant'
            messages.append({
                'role': role,
                'content': chunk,
                'timestamp': None
            })
        
        if not messages:
            # Fallback: treat all text as one message
            messages = [{
                'role': 'assistant',
                'content': text,
                'timestamp': None
            }]
        
        return messages

def extract_grok_conversation(url, timeout=30):
    """Extract conversation from Grok URL"""
    extractor = GrokTextExtractor(timeout=timeout)
    return extractor.extract_conversation(url)

def validate_grok_url(url):
    """Validate Grok share URL"""
    if not url:
        return False, "URL is required"
    
    if 'grok.com/share/' not in url:
        return False, "Must be a Grok share URL"
    
    try:
        parsed = urlparse(url)
        path_parts = [part for part in parsed.path.split('/') if part]
        
        if len(path_parts) >= 2 and path_parts[0] == 'share':
            conversation_id = unquote(path_parts[1])
            if len(conversation_id) >= 10:
                return True, "Valid Grok share URL"
        
        return False, "Invalid Grok share URL format"
    except Exception as e:
        return False, f"Error validating URL: {e}"

if __name__ == "__main__":
    # Test the extractor
    test_url = "https://grok.com/share/c2hhcmQtNA%3D%3D_42668729-dca4-4d3c-b608-ba0d62788b15"
    
    try:
        print("Testing Grok extraction...")
        result = extract_grok_conversation(test_url)
        
        if result['success']:
            print(f"Success! Messages: {len(result['messages'])}")
            if result['messages']:
                first_msg = result['messages'][0]
                preview = first_msg['content'][:200] + "..." if len(first_msg['content']) > 200 else first_msg['content']
                print(f"First message preview: {preview}")
        else:
            print(f"Failed: {result['error']}")
    except Exception as e:
        print(f"Error: {e}")

#!/usr/bin/env python3
"""
Production-Ready Claude Text Extractor

Simple, robust extractor that just gets all visible text from Claude conversation URLs.
Perfect for integration into larger web applications.
"""

import json
import time
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from contextlib import contextmanager

class ClaudeTextExtractor:
    """Simple text extractor for Claude conversations"""
    
    def __init__(self, headless=True, timeout=45):
        self.headless = headless
        self.timeout = timeout
    
    @contextmanager
    def get_driver(self):
        """Get configured Chrome WebDriver"""
        driver = None
        try:
            options = Options()
            if self.headless:
                options.add_argument('--headless')
            
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
        Extract conversation text from Claude URL and format for UCP backend
        
        Args:
            url (str): Claude share URL
            
        Returns:
            dict: UCP-compatible format with messages array
        """
        try:
            # Validate URL
            conv_id = self._parse_claude_url(url)
            
            # Extract text
            with self.get_driver() as driver:
                text_data = self._get_page_text(driver, url)
                
                # Parse into messages format
                messages = self._parse_text_to_messages(text_data['text'])
                
                return {
                    'success': True,
                    'conversation_id': conv_id,
                    'title': f"Claude Conversation {conv_id}",
                    'messages': messages,
                    'source': 'claude_share',
                    'url': url,
                    'extraction_time': time.time(),
                    'cloudflare_detected': text_data.get('cloudflare_detected', False)
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'url': url,
                'extraction_time': time.time()
            }
    
    def _parse_claude_url(self, url):
        """Parse and validate Claude URL"""
        if not url:
            raise ValueError("URL is required")
        
        url = url.strip()
        
        if 'claude.ai/share/' not in url:
            raise ValueError("Must be a Claude share URL")
        
        try:
            parsed = urlparse(url)
            conv_id = parsed.path.split('/')[-1]
            if len(conv_id) < 10:
                raise ValueError("Invalid conversation ID")
            return conv_id
        except Exception:
            raise ValueError("Invalid Claude URL format")
    
    def _get_page_text(self, driver, url):
        """Get all text from the Claude page"""
        print(f"Loading Claude conversation...")
        driver.get(url)
        
        # Wait for page load
        WebDriverWait(driver, self.timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Claude needs more time to load content
        time.sleep(10)
        
        # Get all text
        body = driver.find_element(By.TAG_NAME, "body")
        all_text = body.text
        
        # Check for Cloudflare or security verification
        security_detected = any(keyword in all_text.lower() for keyword in [
            'cloudflare', 'verify you are human', 'ray id:', 
            'security check', 'checking your browser', 'access denied',
            'please verify', 'waiting for claude.ai'
        ])
        
        if security_detected:
            raise ValueError("This Claude share URL shows a security verification page or is private. Claude conversations may require authentication for automated access. Please try: 1) Ensure the URL is publicly accessible, 2) Use a different conversation, or 3) Export manually from Claude.")
        
        # Basic validation
        if not all_text or len(all_text) < 50:
            raise ValueError("No substantial content found on Claude page")
        
        return {
            'text': self._clean_text(all_text),
            'cloudflare_detected': security_detected
        }
    
    def _clean_text(self, text):
        """Basic text cleaning"""
        if not text:
            return ""
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    def _parse_text_to_messages(self, text):
        """Parse raw text into conversation messages"""
        messages = []
        
        # Try to identify conversation patterns
        lines = text.split('\n')
        current_message = ""
        current_role = "user"
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for role indicators
            if any(indicator in line.lower() for indicator in ['human:', 'user:', 'you:']):
                if current_message:
                    messages.append({
                        'role': current_role,
                        'content': current_message.strip(),
                        'timestamp': None
                    })
                current_message = line
                current_role = "user"
            elif any(indicator in line.lower() for indicator in ['assistant:', 'claude:', 'ai:']):
                if current_message:
                    messages.append({
                        'role': current_role,
                        'content': current_message.strip(),
                        'timestamp': None
                    })
                current_message = line
                current_role = "assistant"
            else:
                current_message += "\n" + line
        
        # Add final message
        if current_message:
            messages.append({
                'role': current_role,
                'content': current_message.strip(),
                'timestamp': None
            })
        
        # If no clear structure found, create chunks
        if not messages:
            # Split into reasonable chunks
            chunk_size = 2000
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i+chunk_size].strip()
                if chunk:
                    role = 'user' if len(messages) % 2 == 0 else 'assistant'
                    messages.append({
                        'role': role,
                        'content': chunk,
                        'timestamp': None
                    })
        
        return messages

# API functions for backend integration
def extract_claude_conversation_fast(url, timeout=45):
    """
    Extract Claude conversation for UCP backend
    
    Args:
        url (str): Claude share URL
        timeout (int): Timeout in seconds
        
    Returns:
        dict: UCP-compatible result with messages array
    """
    extractor = ClaudeTextExtractor(timeout=timeout)
    return extractor.extract_conversation(url)

def validate_claude_url(url):
    """
    Validate Claude share URL
    
    Args:
        url (str): URL to validate
        
    Returns:
        tuple: (is_valid: bool, message: str)
    """
    if not url:
        return False, "URL is required"
    
    url = url.strip()
    
    if 'claude.ai/share/' not in url:
        return False, "Must be a Claude share URL"
    
    try:
        parsed = urlparse(url)
        path_parts = [part for part in parsed.path.split('/') if part]
        
        if len(path_parts) >= 2 and path_parts[0] == 'share':
            conversation_id = path_parts[1]
            if len(conversation_id) >= 10:
                return True, "Valid Claude share URL"
        
        return False, "Invalid Claude share URL format"
    except Exception as e:
        return False, f"Error validating URL: {e}"

# Test functionality
if __name__ == "__main__":
    test_url = "https://claude.ai/share/74f51402-c8be-41a4-8a7d-1c7dd343aa12"
    
    print("🚀 Claude Conversation Extractor")
    print("=" * 50)
    print(f"Testing URL: {test_url}")
    print()
    
    # Test validation
    is_valid, message = validate_claude_url(test_url)
    print(f"Validation: {is_valid} - {message}")
    
    if is_valid:
        print("Extracting conversation...")
        result = extract_claude_conversation_fast(test_url)
        
        if result['success']:
            print(f"✅ Success!")
            print(f"   Conversation ID: {result['conversation_id']}")
            print(f"   Messages: {len(result['messages'])}")
            print(f"   Source: {result['source']}")
            
            # Show first message preview
            if result['messages']:
                first_msg = result['messages'][0]
                preview = first_msg['content'] + "..." if len(first_msg['content']) > 200 else first_msg['content']
                print(f"   First message: {preview}")
            
        else:
            print(f"❌ Failed: {result['error']}")
    
    print("\n💡 Integration: Use extract_claude_conversation_fast(url) in your backend")

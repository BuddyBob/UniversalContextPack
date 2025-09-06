#!/usr/bin/env python3
"""
Production ChatGPT Extractor

Optimized for web applications with better error handling,
timeouts, and resource management.
"""

import json
import time
import re
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from contextlib import contextmanager

class ProductionChatGPTExtractor:
    def __init__(self, headless=True, timeout=30):
        self.headless = headless
        self.timeout = timeout
    
    @contextmanager
    def get_driver(self):
        """Context manager for WebDriver to ensure cleanup"""
        driver = None
        try:
            chrome_options = Options()
            if self.headless:
                chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            yield driver
        finally:
            if driver:
                driver.quit()
    
    def extract_conversation_id(self, url):
        """Extract conversation ID from URL"""
        try:
            parsed = urlparse(url)
            if not parsed.path:
                return None
            
            # Split path and filter out empty parts
            path_parts = [part for part in parsed.path.split('/') if part]
            
            # For ChatGPT URLs, we expect the pattern: /share/{conversation_id}
            if len(path_parts) >= 2 and path_parts[0] == 'share':
                conversation_id = path_parts[1]
                # Basic validation - conversation ID should be reasonably long
                if len(conversation_id) >= 10:
                    return conversation_id
            
            return None
        except Exception:
            return None
    
    def extract_messages(self, driver):
        """Extract messages from loaded page"""
        try:
            # Wait for content to load
            WebDriverWait(driver, self.timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Give time for dynamic content
            time.sleep(3)
            
            messages = []
            
            # Try different selectors
            selectors = [
                '[data-message-author-role]',
                '.text-message',
                '[class*="message"]'
            ]
            
            for selector in selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if len(elements) > 2:  # Found multiple messages
                    for element in elements:
                        try:
                            text = element.text.strip()
                            if text and len(text) > 10:
                                role = self.determine_role_from_element(element, text)
                                if role:
                                    messages.append({
                                        'role': role,
                                        'content': text
                                    })
                        except Exception:
                            continue
                    
                    if messages:
                        return self.clean_messages(messages)
            
            return None
            
        except Exception as e:
            raise Exception(f"Failed to extract messages: {str(e)}")
    
    def determine_role_from_element(self, element, text):
        """Determine message role"""
        try:
            # Check data attributes
            role_attr = element.get_attribute('data-message-author-role')
            if role_attr:
                return 'user' if role_attr.lower() in ['user', 'human'] else 'assistant'
            
            # Check classes
            class_attr = element.get_attribute('class') or ''
            if 'user' in class_attr.lower():
                return 'user'
            elif 'assistant' in class_attr.lower() or 'bot' in class_attr.lower():
                return 'assistant'
            
            # Check parent elements
            parent = element.find_element(By.XPATH, '..')
            parent_class = parent.get_attribute('class') or ''
            if 'user' in parent_class.lower():
                return 'user'
            elif 'assistant' in parent_class.lower():
                return 'assistant'
            
            # Fallback to text analysis
            text_lower = text[:50].lower()
            if any(starter in text_lower for starter in ['user:', 'human:', 'you:']):
                return 'user'
            elif any(starter in text_lower for starter in ['assistant:', 'chatgpt:', 'ai:']):
                return 'assistant'
            
            return None
            
        except Exception:
            return None
    
    def clean_messages(self, messages):
        """Clean and deduplicate messages"""
        cleaned = []
        seen_content = set()
        
        for msg in messages:
            content = msg['content'].strip()
            # Skip duplicates and very short messages
            if content and len(content) > 10 and content not in seen_content:
                cleaned.append({
                    'role': msg['role'],
                    'content': content
                })
                seen_content.add(content)
        
        return cleaned if len(cleaned) > 1 else None
    
    def extract_conversation(self, url):
        """Main extraction method"""
        # Validate URL
        if not url or 'chatgpt.com/share/' not in url:
            raise ValueError("Invalid ChatGPT share URL")
        
        conv_id = self.extract_conversation_id(url)
        if not conv_id:
            raise ValueError(f"Could not extract conversation ID from URL: {url}")
        
        with self.get_driver() as driver:
            try:
                driver.get(url)
                messages = self.extract_messages(driver)
                
                if not messages:
                    raise Exception("No conversation found")
                
                return {
                    'conversation_id': conv_id,
                    'messages': messages,
                    'message_count': len(messages),
                    'extracted_at': time.strftime('%Y-%m-%d %H:%M:%S')
                }
                
            except Exception as e:
                raise Exception(f"Extraction failed: {str(e)}")

# Simple API functions for web integration
def extract_chatgpt_conversation(url, timeout=30):
    """Extract conversation from ChatGPT URL"""
    extractor = ProductionChatGPTExtractor(timeout=timeout)
    return extractor.extract_conversation(url)

def validate_chatgpt_url(url):
    """Validate ChatGPT share URL"""
    if not url:
        return False, "URL is required"
    
    if 'chatgpt.com/share/' not in url:
        return False, "Must be a ChatGPT share URL"
    
    try:
        parsed = urlparse(url)
        if not parsed.path:
            return False, "Invalid URL format"
        
        # Split path and filter out empty parts
        path_parts = [part for part in parsed.path.split('/') if part]
        
        # For ChatGPT URLs, we expect the pattern: /share/{conversation_id}
        if len(path_parts) >= 2 and path_parts[0] == 'share':
            conv_id = path_parts[1]
            # Basic validation - conversation ID should be reasonably long
            if len(conv_id) >= 10:
                return True, "Valid URL"
        
        return False, "Invalid conversation ID"
    except Exception:
        return False, "Invalid URL format"

# Example usage
if __name__ == "__main__":
    url = "https://chatgpt.com/share/68bba00f-f950-8004-ae26-3cd8e1f21f2d"
    
    try:
        print("Extracting conversation...")
        result = extract_chatgpt_conversation(url)
        
        print(f"✓ Extracted {result['message_count']} messages")
        print(f"✓ Conversation ID: {result['conversation_id']}")
        
        # Show first few messages
        for i, msg in enumerate(result['messages'][:3]):
            print(f"\n{i+1}. [{msg['role'].upper()}]:")
            print(f"   {msg['content'][:100]}...")
        
        # Save minimal JSON
        output = {
            'messages': result['messages'],
            'metadata': {
                'conversation_id': result['conversation_id'],
                'message_count': result['message_count'],
                'extracted_at': result['extracted_at']
            }
        }
        
        with open('extracted_conversation.json', 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"\n✓ Saved to extracted_conversation.json")
        
    except Exception as e:
        print(f"✗ Error: {e}")

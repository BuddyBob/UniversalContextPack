#!/usr/bin/env python3
"""
Production ChatGPT Extractor

Optimized for web applications with better error handling,
timeouts, and resource management.
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

class ProductionChatGPTExtractor:
    def __init__(self, headless=True, timeout=45):  # Increased default timeout
        self.headless = headless
        self.timeout = timeout
    
    @contextmanager
    def get_driver(self):
        """Get a Chrome driver with production-ready options"""
        driver = None
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--allow-running-insecure-content')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            chrome_options.add_argument('--disable-images')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
                        # Try to use system Chrome first, then fall back to ChromeDriverManager
            try:
                # Try different Chrome binary locations
                chrome_binaries = [
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium'
                ]
                
                chrome_binary = None
                for binary in chrome_binaries:
                    if os.path.exists(binary):
                        chrome_binary = binary
                        break
                
                if chrome_binary:
                    chrome_options.binary_location = chrome_binary
                    print(f"Using Chrome binary: {chrome_binary}")
                
                # Try system chromedriver first
                chromedriver_paths = [
                    '/usr/local/bin/chromedriver',
                    '/usr/bin/chromedriver'
                ]
                
                chromedriver_path = None
                for path in chromedriver_paths:
                    if os.path.exists(path):
                        chromedriver_path = path
                        break
                
                if chromedriver_path:
                    print(f"Using system chromedriver: {chromedriver_path}")
                    service = Service(chromedriver_path)
                else:
                    print("System chromedriver not found, using ChromeDriverManager...")
                    service = Service(ChromeDriverManager().install())
                
                driver = webdriver.Chrome(service=service, options=chrome_options)
                print("Chrome driver initialized successfully")
            except Exception as e:
                error_msg = str(e)
                print(f"Chrome setup failed: {error_msg}")
                
                # Check for version mismatch specifically
                if "This version of ChromeDriver only supports Chrome version" in error_msg:
                    print("ChromeDriver version mismatch detected!")
                    print("This is a common issue in production environments.")
                    
                # Try fallback with ChromeDriverManager if system chromedriver failed
                if chromedriver_path and "ChromeDriver only supports Chrome version" in error_msg:
                    print("Retrying with ChromeDriverManager as fallback...")
                    try:
                        service = Service(ChromeDriverManager().install())
                        driver = webdriver.Chrome(service=service, options=chrome_options)
                        print("Fallback ChromeDriverManager succeeded")
                    except Exception as fallback_error:
                        print(f"Fallback also failed: {fallback_error}")
                        raise
                else:
                    raise
            
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            yield driver
        except Exception as e:
            print(f"Error setting up Chrome driver: {e}")
            raise
        finally:
            if driver:
                driver.quit()
    
    def extract_conversation_id(self, url):
        """Extract conversation ID from URL"""
        try:
            print(f"Extracting conversation ID from URL: {url}")
            parsed = urlparse(url)
            print(f"Parsed URL - scheme: {parsed.scheme}, netloc: {parsed.netloc}, path: {parsed.path}")
            
            if not parsed.path:
                print("No path in parsed URL")
                return None
            
            # Split path and filter out empty parts
            path_parts = [part for part in parsed.path.split('/') if part]
            print(f"Path parts: {path_parts}")
            
            # For ChatGPT URLs, we expect the pattern: /share/{conversation_id}
            if len(path_parts) >= 2 and path_parts[0] == 'share':
                conversation_id = path_parts[1]
                print(f"Found conversation ID: {conversation_id}")
                # Basic validation - conversation ID should be reasonably long
                if len(conversation_id) >= 10:
                    return conversation_id
                else:
                    print(f"Conversation ID too short: {len(conversation_id)} chars")
            else:
                print(f"Invalid path structure. Expected /share/{{id}}, got: {'/'.join(path_parts)}")
            
            return None
        except Exception as e:
            print(f"Error in extract_conversation_id: {e}")
            return None
    
    def extract_messages(self, driver):
        """Extract messages from loaded page"""
        try:
            # Wait for content to load
            WebDriverWait(driver, self.timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Progressive loading detection for large conversations
            print("Waiting for conversation to fully load...")
            initial_wait = 3
            max_wait = 30  # Maximum wait time for large conversations
            check_interval = 2
            
            previous_content_length = 0
            stable_count = 0
            
            for wait_time in range(initial_wait, max_wait, check_interval):
                time.sleep(check_interval)
                
                current_content = driver.find_element(By.TAG_NAME, "body").text
                current_length = len(current_content)
                
                print(f"Content length after {wait_time}s: {current_length} chars")
                
                # Check if content has stabilized (stopped growing)
                if current_length == previous_content_length:
                    stable_count += 1
                    if stable_count >= 2:  # Content stable for 2 checks
                        print(f"Content stabilized at {current_length} chars")
                        break
                else:
                    stable_count = 0
                    previous_content_length = current_length
                
                # If we have substantial content, we can proceed
                if current_length > 5000:  # Large enough content
                    print(f"Sufficient content loaded ({current_length} chars), proceeding...")
                    break
            
            messages = []
            
            # Debug: Check page content
            page_text = driver.find_element(By.TAG_NAME, "body").text
            print(f"Final page text length: {len(page_text)}")
            
            # Check for loading indicators or empty state
            if 'loading' in page_text.lower() or len(page_text) < 500:
                print("Page appears to still be loading or is empty")
                time.sleep(5)  # Additional wait
                page_text = driver.find_element(By.TAG_NAME, "body").text
                print(f"After additional wait: {len(page_text)} chars")
            
            # Try different selectors (updated for current ChatGPT structure)
            selectors = [
                '[data-message-author-role]',
                '[data-testid*="conversation-turn"]',
                '.text-message',
                '[class*="message"]',
                '[class*="turn"]',
                'div[class*="group"]',  # ChatGPT often uses grouped divs
                'article',
                '[role="article"]'
            ]
            
            for selector in selectors:
                print(f"Trying selector: {selector}")
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                print(f"Found {len(elements)} elements with selector {selector}")
                
                if len(elements) > 1:  # Found multiple messages
                    for i, element in enumerate(elements):
                        try:
                            text = element.text.strip()
                            if text and len(text) > 10:
                                print(f"Element {i}: {text[:100]}...")
                                role = self.determine_role_from_element(element, text)
                                if role:
                                    messages.append({
                                        'role': role,
                                        'content': text
                                    })
                        except Exception as e:
                            print(f"Error processing element {i}: {e}")
                            continue
                    
                    if messages:
                        print(f"Successfully extracted {len(messages)} messages")
                        return self.clean_messages(messages)
            
            # If no specific selectors work, try extracting all text content
            print("No specific selectors worked, trying fallback extraction...")
            all_divs = driver.find_elements(By.TAG_NAME, "div")
            print(f"Found {len(all_divs)} div elements")
            
            # Look for divs with substantial text content
            for div in all_divs:
                try:
                    text = div.text.strip()
                    if text and len(text) > 50 and len(text) < 5000:  # Reasonable message length
                        # Skip if it contains too many child elements (likely UI)
                        children = div.find_elements(By.XPATH, ".//*")
                        if len(children) < 10:  # Not too nested
                            role = self.determine_role_from_element(div, text)
                            if role and text not in [msg['content'] for msg in messages]:
                                messages.append({
                                    'role': role,
                                    'content': text
                                })
                except Exception:
                    continue
            
            if messages:
                print(f"Fallback extraction found {len(messages)} messages")
                return self.clean_messages(messages)
            
            print("No messages found with any method")
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
            
            # Check for testid attributes (common in modern ChatGPT)
            testid = element.get_attribute('data-testid') or ''
            if 'user' in testid.lower():
                return 'user'
            elif 'assistant' in testid.lower() or 'bot' in testid.lower():
                return 'assistant'
            
            # Check classes
            class_attr = element.get_attribute('class') or ''
            if 'user' in class_attr.lower():
                return 'user'
            elif 'assistant' in class_attr.lower() or 'bot' in class_attr.lower():
                return 'assistant'
            
            # Check parent elements
            try:
                parent = element.find_element(By.XPATH, '..')
                parent_class = parent.get_attribute('class') or ''
                parent_testid = parent.get_attribute('data-testid') or ''
                
                if 'user' in parent_class.lower() or 'user' in parent_testid.lower():
                    return 'user'
                elif 'assistant' in parent_class.lower() or 'bot' in parent_class.lower() or 'assistant' in parent_testid.lower():
                    return 'assistant'
            except:
                pass
            
            # Fallback to text analysis
            text_lower = text[:100].lower()
            if any(starter in text_lower for starter in ['user:', 'human:', 'you:']):
                return 'user'
            elif any(starter in text_lower for starter in ['assistant:', 'chatgpt:', 'ai:']):
                return 'assistant'
            
            # Pattern-based detection for common conversational patterns
            if text.strip().endswith('?') and len(text) < 500:  # Likely a question
                return 'user'
            elif text.startswith(('I can', 'I would', 'I think', 'Here', 'Let me', 'To ', 'You can')):
                return 'assistant'
            
            # Default to alternating pattern if we can't determine
            # This is a fallback - not ideal but better than nothing
            return 'user'  # Will be cleaned up in post-processing
            
        except Exception as e:
            print(f"Error determining role: {e}")
            return 'user'  # Safe default
    
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
                print(f"Loading page: {url}")
                driver.get(url)
                
                # Wait for initial page load
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # Check for common error conditions
                page_source = driver.page_source.lower()
                if 'conversation not found' in page_source or 'page not found' in page_source:
                    raise Exception("Conversation not found - URL may be invalid or private")
                
                if 'please log in' in page_source or 'sign in' in page_source:
                    raise Exception("Conversation requires authentication")
                
                # Wait for ChatGPT-specific elements to appear
                print("Waiting for ChatGPT conversation elements...")
                try:
                    # Wait for any of these common ChatGPT elements
                    WebDriverWait(driver, 15).until(
                        lambda d: len(d.find_elements(By.CSS_SELECTOR, 
                            '[data-message-author-role], [class*="message"], [class*="conversation"], article, [role="article"]'
                        )) > 0
                    )
                except:
                    print("Standard elements not found, continuing with extraction attempt...")
                
                messages = self.extract_messages(driver)
                
                if not messages:
                    # Try to get any text content for debugging
                    body_text = driver.find_element(By.TAG_NAME, "body").text
                    print(f"Page body text (first 1000 chars): {body_text[:1000]}")
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
def extract_chatgpt_conversation(url, timeout=45):  # Increased default timeout
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

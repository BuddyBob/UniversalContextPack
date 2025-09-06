#!/usr/bin/env python3
"""
Production Claude Extractor

Optimized for web applications with better error handling,
timeouts, and resource management for Claude conversation shares.
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

class ProductionClaudeExtractor:
    def __init__(self, headless=True, timeout=30):
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
                chrome_paths = [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/chromium-browser',
                    '/snap/bin/chromium'
                ]
                
                chrome_binary = None
                for path in chrome_paths:
                    if os.path.exists(path):
                        chrome_binary = path
                        print(f"Found Chrome binary at: {path}")
                        break
                
                if chrome_binary:
                    chrome_options.binary_location = chrome_binary
                
                # Try to find ChromeDriver
                chromedriver_paths = [
                    '/usr/bin/chromedriver',
                    '/usr/local/bin/chromedriver'
                ]
                
                chromedriver_path = None
                for path in chromedriver_paths:
                    if os.path.exists(path):
                        chromedriver_path = path
                        print(f"Found ChromeDriver at: {path}")
                        break
                
                if chromedriver_path:
                    service = Service(chromedriver_path)
                    driver = webdriver.Chrome(service=service, options=chrome_options)
                    print("Using system ChromeDriver")
                else:
                    # Fall back to ChromeDriverManager
                    service = Service(ChromeDriverManager().install())
                    driver = webdriver.Chrome(service=service, options=chrome_options)
                    print("Using ChromeDriverManager")
                    
            except Exception as e:
                print(f"Error setting up Chrome driver: {e}")
                # Final fallback
                driver = webdriver.Chrome(options=chrome_options)
                print("Using default Chrome driver")
            
            # Set timeouts
            driver.set_page_load_timeout(self.timeout)
            driver.implicitly_wait(10)
            
            # Set user agent to appear more like a real browser
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            yield driver
        
        except Exception as e:
            print(f"Failed to create Chrome driver: {e}")
            raise
        finally:
            if driver:
                try:
                    driver.quit()
                    print("Chrome driver closed")
                except Exception as e:
                    print(f"Error closing driver: {e}")
    
    def extract_conversation_id(self, url):
        """Extract conversation ID from Claude share URL"""
        try:
            print(f"Extracting conversation ID from Claude URL: {url}")
            parsed = urlparse(url)
            print(f"Parsed URL - scheme: {parsed.scheme}, netloc: {parsed.netloc}, path: {parsed.path}")
            
            if not parsed.path:
                print("No path in parsed URL")
                return None
            
            # Split path and filter out empty parts
            path_parts = [part for part in parsed.path.split('/') if part]
            print(f"Path parts: {path_parts}")
            
            # For Claude URLs, we expect the pattern: /share/{conversation_id}
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
    
    def clean_message_text(self, text):
        """Clean and format message text"""
        if not text:
            return ""
        
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove common artifacts
        text = re.sub(r'\n+', '\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        
        return text
    
    def detect_message_role(self, element):
        """Detect if a message is from user or Claude"""
        text = element.get_attribute('textContent') or ""
        text_lower = text.lower()
        
        # Look for role indicators in the element's attributes or content
        try:
            # Check for common Claude indicators
            if any(indicator in text_lower for indicator in ['claude:', 'assistant:', 'ai:']):
                return 'assistant'
            
            # Check for user indicators
            if any(indicator in text_lower for indicator in ['user:', 'human:', 'you:']):
                return 'user'
            
            # Check parent elements or data attributes that might indicate role
            parent = element.find_element(By.XPATH, '..')
            if parent:
                parent_classes = parent.get_attribute('class') or ""
                if 'assistant' in parent_classes.lower() or 'claude' in parent_classes.lower():
                    return 'assistant'
                elif 'user' in parent_classes.lower() or 'human' in parent_classes.lower():
                    return 'user'
        
        except Exception as e:
            print(f"Error detecting message role: {e}")
        
        # Default to alternating pattern if we can't determine
        return 'unknown'
    
    def extract_conversation(self, url):
        """Extract conversation from Claude share URL"""
        print(f"Starting Claude conversation extraction from: {url}")
        
        if not url or 'claude.ai/share/' not in url:
            raise ValueError("Invalid Claude share URL")
        
        conv_id = self.extract_conversation_id(url)
        if not conv_id:
            raise ValueError(f"Could not extract conversation ID from URL: {url}")
        
        messages = []
        
        with self.get_driver() as driver:
            try:
                print("Loading Claude conversation page...")
                driver.get(url)
                
                # Wait for the page to load
                time.sleep(3)
                
                # Wait for conversation content to be present
                wait = WebDriverWait(driver, self.timeout)
                
                # Try multiple selectors for Claude conversation content
                possible_selectors = [
                    '[data-testid="conversation"]',
                    '.conversation',
                    '[role="main"]',
                    '.messages',
                    '.chat-messages',
                    'main'
                ]
                
                conversation_container = None
                for selector in possible_selectors:
                    try:
                        conversation_container = wait.until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        print(f"Found conversation container with selector: {selector}")
                        break
                    except Exception:
                        continue
                
                if not conversation_container:
                    print("Could not find conversation container, trying to extract from body")
                    conversation_container = driver.find_element(By.TAG_NAME, 'body')
                
                # Look for message elements
                message_selectors = [
                    '[data-testid="message"]',
                    '.message',
                    '.chat-message',
                    'div[class*="message"]',
                    'div[class*="chat"]'
                ]
                
                message_elements = []
                for selector in message_selectors:
                    try:
                        elements = conversation_container.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            message_elements = elements
                            print(f"Found {len(elements)} message elements with selector: {selector}")
                            break
                    except Exception:
                        continue
                
                if not message_elements:
                    # Fallback: look for any div elements that might contain messages
                    print("No specific message elements found, trying generic approach")
                    all_divs = conversation_container.find_elements(By.TAG_NAME, 'div')
                    # Filter divs that likely contain conversation content
                    message_elements = [div for div in all_divs if len(div.get_attribute('textContent') or '') > 20]
                
                print(f"Found {len(message_elements)} potential message elements")
                
                # Extract messages
                current_role = 'user'  # Start with user
                for i, element in enumerate(message_elements):
                    try:
                        text_content = element.get_attribute('textContent') or ""
                        text_content = self.clean_message_text(text_content)
                        
                        if len(text_content.strip()) < 10:  # Skip very short messages
                            continue
                        
                        # Detect role or alternate
                        detected_role = self.detect_message_role(element)
                        if detected_role != 'unknown':
                            role = detected_role
                        else:
                            # Alternate between user and assistant
                            role = 'user' if i % 2 == 0 else 'assistant'
                        
                        messages.append({
                            'role': role,
                            'content': text_content,
                            'timestamp': None  # Claude shares don't typically include timestamps
                        })
                        
                        print(f"Extracted message {len(messages)}: {role} - {text_content[:100]}...")
                    
                    except Exception as e:
                        print(f"Error processing message element {i}: {e}")
                        continue
                
                if not messages:
                    raise ValueError("No messages found in the conversation")
                
                print(f"Successfully extracted {len(messages)} messages from Claude conversation")
                
                return {
                    'success': True,
                    'conversation_id': conv_id,
                    'title': f"Claude Conversation {conv_id}",
                    'messages': messages,
                    'source': 'claude_share',
                    'url': url
                }
            
            except Exception as e:
                print(f"Error during Claude extraction: {e}")
                raise

def extract_claude_conversation(url, timeout=30):
    """Extract conversation from Claude URL"""
    extractor = ProductionClaudeExtractor(timeout=timeout)
    return extractor.extract_conversation(url)

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
    # Test the extractor
    test_url = "https://claude.ai/share/4ace25c1-fb1d-414d-bf54-534313bb2d6f"
    
    try:
        print(f"Testing Claude URL validation: {test_url}")
        is_valid, message = validate_claude_url(test_url)
        print(f"Validation result: {is_valid} - {message}")
        
        if is_valid:
            print("Starting extraction...")
            result = extract_claude_conversation(test_url)
            print(f"Extraction successful! Found {len(result['messages'])} messages")
            print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Test failed: {e}")

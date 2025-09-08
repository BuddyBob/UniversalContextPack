#!/usr/bin/env python3
"""
Claude Conversation Extractor

Simple, reliable extraction from Claude share URLs.
Uses the proven two-step approach: requests first, then selenium.
"""

import time
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def try_requests_first(url):
    """Try simple requests first - sometimes works without triggering Cloudflare"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200 and len(response.text) > 1000:
            # Quick check if we got actual content
            if 'conversation' in response.text.lower() or 'message' in response.text.lower():
                try:
                    # Try to use BeautifulSoup if available
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(response.text, 'html.parser')
                    # Remove scripts and styles
                    for script in soup(["script", "style"]):
                        script.decompose()
                    text = soup.get_text()
                    return {'success': True, 'text': text, 'length': len(text), 'method': 'requests'}
                except ImportError:
                    # Fallback to raw text if BeautifulSoup not available
                    return {'success': True, 'text': response.text, 'length': len(response.text), 'method': 'requests_raw'}
    except Exception:
        pass
    return None

def extract_claude_conversation(url):
    """Main function to extract Claude conversation"""
    
    # Validate URL format
    if 'claude.ai/share/' not in url:
        return {'success': False, 'error': 'Invalid Claude share URL'}
    
    # Try requests first (faster and less likely to trigger Cloudflare)
    print("Trying simple HTTP request first...")
    result = try_requests_first(url)
    if result:
        print("✅ Got content with simple request!")
        return format_result(url, result['text'], 'requests')
    
    print("Simple request failed, trying with browser...")
    
    # Setup Chrome with stealth options
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-plugins')
    options.add_argument('--disable-images')
    options.add_argument('--disable-javascript')  # Try without JS first
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Hide automation indicators
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    
    try:
        # Additional stealth
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
        driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']})")
        
        # Load page
        driver.get(url)
        
        # Wait for body
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Wait for content to load
        time.sleep(5)
        
        # Get all text from body
        body = driver.find_element(By.TAG_NAME, "body")
        text = body.text
        
        # If we hit Cloudflare, try with JS enabled
        if 'Verify you are human' in text or 'cloudflare' in text.lower():
            print("Cloudflare detected, retrying with JS enabled...")
            driver.quit()
            
            # Retry with JS enabled
            options_js = Options()
            options_js.add_argument('--headless')
            options_js.add_argument('--no-sandbox')
            options_js.add_argument('--disable-dev-shm-usage')
            options_js.add_argument('--disable-blink-features=AutomationControlled')
            options_js.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            options_js.add_experimental_option("excludeSwitches", ["enable-automation"])
            options_js.add_experimental_option('useAutomationExtension', False)
            
            driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=options_js
            )
            
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            driver.get(url)
            WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(10)  # Wait longer for JS to load
            
            body = driver.find_element(By.TAG_NAME, "body")
            text = body.text
        
        # Check for common access issues
        if 'Verify you are human' in text or 'cloudflare' in text.lower():
            return {
                'success': False,
                'error': 'Cloudflare protection detected - conversation may be private or require authentication',
                'raw_text': text[:1000] + '...' if len(text) > 1000 else text
            }
        
        if len(text) < 100:
            return {
                'success': False,
                'error': 'Very little content found - URL may be invalid or private',
                'raw_text': text
            }
        
        return format_result(url, text, 'selenium')
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        driver.quit()

def format_result(url, text, method):
    """Format the extracted text into the expected result structure"""
    conversation_id = url.split('/')[-1]
    messages = parse_text_to_messages(text)
    
    return {
        'success': True,
        'conversation_id': conversation_id,
        'source': 'claude',
        'messages': messages,
        'extraction_method': method,
        'raw_text': text
    }

def parse_text_to_messages(text):
    """Parse extracted text into conversation messages"""
    messages = []
    
    # Clean up the text
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Filter out obvious UI elements
    content_lines = []
    for line in lines:
        # Skip common UI elements
        if any(skip in line.lower() for skip in [
            'claude.ai', 'anthropic', 'sign in', 'sign up', 'menu', 'nav',
            'cookie', 'privacy', 'terms', 'upgrade', 'pro', 'subscribe',
            'loading', 'error', 'retry', 'back', 'home', 'share', 'copy'
        ]):
            continue
        
        # Keep substantial content
        if len(line) > 15:  # Slightly higher threshold
            content_lines.append(line)
    
    # Create messages from content
    if content_lines:
        # Simple chunking approach
        current_message = ""
        message_count = 0
        
        for line in content_lines:
            # Start new message if current one is getting long
            if current_message and len(current_message) > 800:
                messages.append({
                    'role': 'human' if message_count % 2 == 0 else 'assistant',
                    'content': current_message.strip()
                })
                current_message = line
                message_count += 1
            else:
                current_message += "\n" + line if current_message else line
        
        # Add final message
        if current_message.strip():
            messages.append({
                'role': 'human' if message_count % 2 == 0 else 'assistant',
                'content': current_message.strip()
            })
    
    # Fallback: if no messages created, create one from all text
    if not messages and text.strip():
        clean_text = '\n'.join(content_lines) if content_lines else text.strip()
        if len(clean_text) > 50:  # Only if substantial content
            messages.append({
                'role': 'human',
                'content': clean_text
            })
    
    return messages

# Test function
def test_extractor():
    """Test the extractor with a sample URL"""
    test_url = "https://claude.ai/share/74f51402-c8be-41a4-8a7d-1c7dd343aa12"
    
    print("🤖 Claude Conversation Extractor Test")
    print("=" * 50)
    print(f"Testing URL: {test_url}")
    print()
    
    result = extract_claude_conversation(test_url)
    
    if result['success']:
        print(f"✅ Success!")
        print(f"   Method: {result['extraction_method']}")
        print(f"   Conversation ID: {result['conversation_id']}")
        print(f"   Messages found: {len(result['messages'])}")
        
        if result['messages']:
            first_msg = result['messages'][0]
            preview = first_msg['content'][:400] + "..." if len(first_msg['content']) > 400 else first_msg['content']
            print(f"   First message preview:\n   {preview}")
        
        print(f"   Raw text length: {len(result.get('raw_text', ''))} characters")
            
    else:
        print(f"❌ Error: {result['error']}")
        if 'raw_text' in result:
            print(f"Raw text preview: {result['raw_text'][:300]}...")

if __name__ == "__main__":
    test_extractor()

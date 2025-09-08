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


def extract_claude_conversation_fast(url):
    """
    Extract conversation from Claude shared link with selenium
    """
    # Validate URL format
    if 'claude.ai/share/' not in url:
        return {'success': False, 'error': 'Invalid Claude share URL'}
    
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    
    driver = None
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        print(f"Loading URL: {url}")
        driver.get(url)
        
        # Wait for page to load
        wait = WebDriverWait(driver, 10)
        
        # Wait for content to load
        time.sleep(3)
        
        # Try to find conversation container
        try:
            conversation_container = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="conversation"]'))
            )
            print("Found conversation container")
        except:
            # Fallback: look for messages directly
            print("Conversation container not found, looking for messages...")
            time.sleep(2)
        
        # Look for message elements with different possible selectors
        message_selectors = [
            '[data-is-streaming="false"]',
            '[role="presentation"]',
            '.font-claude-message',
            '[data-testid*="message"]',
            '.prose'
        ]
        
        messages = []
        message_elements = []
        
        for selector in message_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"Found {len(elements)} elements with selector: {selector}")
                    message_elements = elements
                    break
            except Exception as e:
                print(f"Selector {selector} failed: {e}")
                continue
        
        if not message_elements:
            # Last resort: get all text content
            print("No specific message elements found, extracting all text...")
            body = driver.find_element(By.TAG_NAME, "body")
            all_text = body.text
            
            if all_text and len(all_text.strip()) > 100:
                # Try to split into logical parts
                parts = [p.strip() for p in all_text.split('\n\n') if p.strip() and len(p.strip()) > 10]
                
                for i, part in enumerate(parts[:20]):  # Limit to first 20 parts
                    role = "human" if i % 2 == 0 else "assistant"
                    messages.append({
                        'role': role,
                        'content': part
                    })
                
                if messages:
                    conversation_id = url.split('/')[-1]
                    return {
                        'success': True,
                        'conversation_id': conversation_id,
                        'source': 'claude',
                        'messages': messages,
                        'extraction_method': 'full_text_fallback'
                    }
            
            return {'success': False, 'error': 'No readable content found on page'}
        
        # Process found message elements
        for i, element in enumerate(message_elements):
            try:
                text_content = element.text.strip()
                
                if text_content and len(text_content) > 10:
                    # Determine role based on position or content
                    role = "human" if i % 2 == 0 else "assistant"
                    
                    # Look for role indicators in the content or surrounding elements
                    if "Human:" in text_content or element.get_attribute('data-author') == 'human':
                        role = "human"
                        text_content = text_content.replace("Human:", "").strip()
                    elif "Assistant:" in text_content or element.get_attribute('data-author') == 'assistant':
                        role = "assistant"
                        text_content = text_content.replace("Assistant:", "").strip()
                    
                    messages.append({
                        'role': role,
                        'content': text_content
                    })
                    
            except Exception as e:
                print(f"Error processing message element {i}: {e}")
                continue
        
        if not messages:
            return {'success': False, 'error': 'No messages found in conversation'}
        
        # Extract conversation ID from URL
        conversation_id = url.split('/')[-1]
        
        print(f"Successfully extracted {len(messages)} messages")
        
        return {
            'success': True,
            'conversation_id': conversation_id,
            'source': 'claude',
            'messages': messages,
            'extraction_method': 'selenium_elements'
        }
        
    except Exception as e:
        print(f"Error during extraction: {e}")
        return {
            'success': False,
            'error': f'Extraction failed: {str(e)}'
        }
    
    finally:
        if driver:
            driver.quit()

def validate_claude_url(url):
    """Validate if URL is a proper Claude share URL"""
    try:
        if not url or not isinstance(url, str):
            return False, "URL must be a non-empty string"
        
        url = url.strip()
        
        if 'claude.ai/share/' not in url:
            return False, "Must be a Claude share URL"
        
        parsed = urlparse(url)
        path_parts = [part for part in parsed.path.split('/') if part]
        
        if len(path_parts) >= 2 and path_parts[0] == 'share':
            conversation_id = path_parts[1]
            if len(conversation_id) >= 10:  # Basic length check
                return True, "Valid Claude share URL"
        
        return False, "Invalid Claude share URL format"
        
    except Exception as e:
        return False, f"Error validating URL: {e}"


if __name__ == "__main__":
    # Test the extractor
    test_url = "https://claude.ai/share/example-id"
    print("Testing Claude extractor...")
    result = extract_claude_conversation_fast(test_url)
    print(json.dumps(result, indent=2))
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

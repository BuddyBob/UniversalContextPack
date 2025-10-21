#!/usr/bin/env python3
"""
ChatGPT URL Extractor - Requests-based implementation

Fast and lightweight extractor for ChatGPT shared conversation URLs.
No Selenium/WebDriver needed - uses simple HTTP requests.
"""

import requests
import re
import json
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlparse

class ChatGPTExtractor:
    """Extract conversation text from shared ChatGPT URLs using requests."""
    
    def __init__(self, timeout: int = 30):
        """
        Initialize the extractor.
        
        Args:
            timeout: Request timeout in seconds (default: 30)
        """
        self.timeout = timeout
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        }
    
    def validate_url(self, url: str) -> Tuple[bool, str]:
        """
        Validate that the URL is a valid ChatGPT shared conversation.
        
        Args:
            url: The URL to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            parsed = urlparse(url)
            
            # Check if it's a chatgpt.com domain
            if parsed.netloc not in ['chatgpt.com', 'chat.openai.com', 'www.chatgpt.com']:
                return False, "URL must be from chatgpt.com or chat.openai.com"
            
            # Check if it's a share URL
            if '/share/' not in parsed.path and '/c/' not in parsed.path:
                return False, "URL must be a shared conversation (/share/ or /c/)"
            
            return True, ""
            
        except Exception as e:
            return False, f"Invalid URL format: {str(e)}"
    
    def extract_conversation_text(self, html: str) -> List[str]:
        """
        Extract actual conversation text from JavaScript data in HTML.
        
        Args:
            html: The HTML content to extract from
            
        Returns:
            List of extracted text blocks
        """
        texts = []
        
        # Find all script tags
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
        
        print(f"🔍 Found {len(scripts)} script tags in HTML")
        
        total_matches = 0
        skipped_urls = 0
        skipped_metadata = 0
        skipped_code = 0
        skipped_quality = 0
        
        for script in scripts:
            # Look for longer quoted strings (likely conversation text)
            matches = re.findall(r'"([^"]{50,})"', script)
            total_matches += len(matches)
            
            for text in matches:
                # Skip URLs
                if text.startswith(('http://', 'https://', '//', 'www.')):
                    skipped_urls += 1
                    continue
                
                # Skip if contains JSON metadata markers
                if '"_' in text or '_"' in text:
                    skipped_metadata += 1
                    continue
                
                # Skip code/technical strings
                if any(x in text for x in ['function(', 'getElementById', 'addEventListener', 'window.', 'document.']):
                    skipped_code += 1
                    continue
                
                # Check for good text quality (letters and spaces > 70%)
                clean_chars = sum(c.isalpha() or c.isspace() or c in '.,!?;:-' for c in text)
                if len(text) > 0 and clean_chars / len(text) > 0.7:
                    # Unescape
                    text = text.replace('\\n', '\n').replace('\\t', ' ')
                    text = text.replace('\\"', '"').replace('\\/', '/')
                    text = text.replace('\\u0026', '&')
                    texts.append(text.strip())
                else:
                    skipped_quality += 1
        
        print(f"📊 Extraction stats:")
        print(f"   Total matches: {total_matches}")
        print(f"   Skipped URLs: {skipped_urls}")
        print(f"   Skipped metadata: {skipped_metadata}")
        print(f"   Skipped code: {skipped_code}")
        print(f"   Skipped quality: {skipped_quality}")
        print(f"   ✅ Extracted: {len(texts)} text blocks")
        
        return texts
    
    def format_conversation(self, texts: List[str]) -> str:
        """
        Format extracted texts into a readable conversation.
        
        Args:
            texts: List of extracted text blocks
            
        Returns:
            Formatted conversation string
        """
        output = []
        conversation_blocks = []
        
        # Only include substantial text blocks
        for text in texts:
            if len(text) > 100:
                conversation_blocks.append(text)
        
        # Format with separators
        for i, text in enumerate(conversation_blocks):
            output.append(f"{'='*80}")
            output.append(f"Block {i+1}:")
            output.append(f"{'='*80}")
            output.append(text)
            output.append("")  # Empty line between blocks
        
        return '\n'.join(output)
    
    def extract_from_url(self, url: str) -> Dict[str, any]:
        """
        Extract conversation from a ChatGPT shared URL.
        
        Args:
            url: The ChatGPT shared conversation URL
            
        Returns:
            Dictionary with extraction results:
            {
                'success': bool,
                'url': str,
                'text_blocks': List[str],
                'formatted_text': str,
                'block_count': int,
                'total_length': int,
                'error': Optional[str]
            }
        """
        result = {
            'success': False,
            'url': url,
            'text_blocks': [],
            'formatted_text': '',
            'block_count': 0,
            'total_length': 0,
            'error': None
        }
        
        try:
            # Validate URL
            is_valid, error_msg = self.validate_url(url)
            if not is_valid:
                result['error'] = error_msg
                return result
            
            # Fetch the page
            print(f"📥 Fetching URL: {url}")
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            response.raise_for_status()
            
            # Extract text blocks
            print("🔍 Extracting conversation text...")
            texts = self.extract_conversation_text(response.text)
            
            # Filter substantial blocks
            substantial_blocks = [t for t in texts if len(t) > 100]
            
            if not substantial_blocks:
                result['error'] = "No conversation text found in the URL"
                return result
            
            # Format the conversation
            formatted = self.format_conversation(texts)
            
            # Calculate total length
            total_length = sum(len(t) for t in substantial_blocks)
            
            result['success'] = True
            result['text_blocks'] = substantial_blocks
            result['formatted_text'] = formatted
            result['block_count'] = len(substantial_blocks)
            result['total_length'] = total_length
            
            print(f"✅ Successfully extracted {len(substantial_blocks)} text blocks ({total_length} characters)")
            
            return result
            
        except requests.Timeout:
            result['error'] = f"Request timed out after {self.timeout} seconds"
            return result
        except requests.RequestException as e:
            result['error'] = f"Failed to fetch URL: {str(e)}"
            return result
        except Exception as e:
            result['error'] = f"Extraction failed: {str(e)}"
            return result


# Convenience function for backward compatibility and simple usage
def extract_chatgpt_conversation(url: str, timeout: int = 30) -> Dict[str, any]:
    """
    Convenience function to extract from a ChatGPT URL.
    Returns the same structure as the old selenium-based extractor for compatibility.
    
    Args:
        url: The ChatGPT shared conversation URL
        timeout: Request timeout in seconds
        
    Returns:
        Extraction result dictionary
    """
    extractor = ChatGPTExtractor(timeout=timeout)
    result = extractor.extract_from_url(url)
    
    # Transform to match old format if needed
    if result['success']:
        # Convert text blocks to messages format for backward compatibility
        messages = []
        for i, block in enumerate(result['text_blocks']):
            # Alternate between user and assistant (simple heuristic)
            role = 'user' if i % 2 == 0 else 'assistant'
            messages.append({
                'role': role,
                'content': block
            })
        
        return {
            'conversation_id': url.split('/')[-1],
            'messages': messages,
            'message_count': len(messages),
            'url': url,
            'success': True
        }
    else:
        return {
            'success': False,
            'error': result['error'],
            'url': url
        }


def validate_chatgpt_url(url: str) -> Tuple[bool, str]:
    """
    Validate ChatGPT share URL.
    
    Args:
        url: The URL to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    extractor = ChatGPTExtractor()
    return extractor.validate_url(url)


# For testing
if __name__ == "__main__":
    # Example usage
    test_url = "https://chatgpt.com/share/68f6d57d-a7ec-8004-936a-f4427a7dac5d"
    
    print("ChatGPT URL Extractor - Testing")
    print("=" * 80)
    
    result = extract_chatgpt_conversation(test_url)
    
    if result.get('success'):
        print(f"\n✅ Extraction successful!")
        print(f"📊 Extracted {result['message_count']} messages")
        print(f"📏 Conversation ID: {result['conversation_id']}")
        
        # Show first few messages
        for i, msg in enumerate(result['messages'][:3]):
            print(f"\n{i+1}. [{msg['role'].upper()}]:")
            print(f"   {msg['content'][:200]}...")
        
        # Save to file
        with open("chatgpt_conversation.json", 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print("\n💾 Saved to chatgpt_conversation.json")
    else:
        print(f"\n❌ Extraction failed: {result.get('error', 'Unknown error')}")

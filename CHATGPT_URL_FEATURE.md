# ChatGPT URL Extraction Feature

## Overview
The Universal Context Pack now supports extracting conversations directly from ChatGPT shared URLs. This feature allows users to process ChatGPT conversations without needing to export files manually.

## How to Use

### Frontend
1. **Navigate to the Process page**
2. **Select "ChatGPT URL" tab** in the upload section
3. **Paste a ChatGPT share URL** in the format: `https://chatgpt.com/share/[conversation-id]`
4. **Click "Load ChatGPT Conversation"** to validate and prepare the URL
5. **Click "Extract ChatGPT Conversation"** to begin processing

### Supported URL Format
- Must be a ChatGPT shared conversation URL
- Format: `https://chatgpt.com/share/[conversation-id]`
- Only publicly shared conversations are accessible

### Backend Processing
1. **URL Validation**: Checks if URL is a valid ChatGPT share link
2. **Browser Automation**: Uses Selenium with Chrome to extract conversation
3. **Content Extraction**: Extracts messages and identifies speakers (user/assistant)
4. **Format Conversion**: Converts to the same format as file uploads for downstream processing
5. **Storage**: Saves extracted content to R2 storage like regular file uploads

## Technical Implementation

### Frontend Changes (TypeScript/React)
- Added `chatgptUrl` and `isUrlInput` state variables
- Created `validateChatGPTUrl()` and `processChatGPTUrl()` functions
- Added `performChatGPTExtraction()` for API communication
- Updated UI with tabbed interface for File Upload vs ChatGPT URL
- Enhanced session saving/loading to persist URL state

### Backend Changes (Python/FastAPI)
- Added `/api/extract-chatgpt-url` endpoint
- Created `ChatGPTURLRequest` Pydantic model
- Implemented `process_chatgpt_url_background()` for async processing
- Added Selenium-based extraction using `chatgpt_extractor.py`
- Integrated with existing job progress tracking and R2 storage

### Dependencies Added
```
selenium==4.15.2
webdriver-manager==4.0.1
```

## ChatGPT Extractor Module

### Key Features
- **Headless browser automation** with Chrome
- **Multiple selector strategies** to find conversation elements
- **Message role detection** (user vs assistant)
- **Content deduplication** and cleaning
- **Timeout and error handling**
- **Production-ready** with proper resource cleanup

### Browser Configuration
- Headless mode by default
- Optimized Chrome options for server deployment
- Automatic ChromeDriver management
- Anti-bot detection measures

## Error Handling

### URL Validation Errors
- Empty URL
- Invalid format
- Non-ChatGPT domain
- Missing conversation ID

### Extraction Errors
- Browser automation failures
- Network timeouts
- Content not found
- Permission issues (private conversations)

## Deployment Considerations

### Server Requirements
- Chrome/Chromium browser installed
- Sufficient memory for browser instances
- Network access to chatgpt.com

### Docker/Railway Deployment
- Chrome needs to be installed in container
- Headless mode required
- May need additional dependencies for font rendering

### Performance
- Extraction typically takes 60-90 seconds
- Memory usage ~200-500MB per extraction
- Single-threaded due to browser automation

## Future Enhancements

### Potential Features
- Support for multiple conversation URLs
- Batch processing of ChatGPT exports
- Direct ChatGPT API integration (when available)
- Support for other conversation formats (Claude, etc.)

### Optimizations
- Browser instance pooling
- Caching for repeated extractions
- Progress streaming during extraction
- Parallel processing with multiple browsers

## Testing

### Manual Testing
1. Get a valid ChatGPT shared conversation URL
2. Test the complete flow: URL input → validation → extraction → chunking → analysis
3. Verify extracted content matches original conversation
4. Test error cases with invalid URLs

### Unit Tests
```python
python test_chatgpt_extractor.py
```

## Security Notes
- Only processes publicly shared ChatGPT conversations
- No authentication or private data access
- Browser runs in sandboxed environment
- All extracted content follows existing data retention policies

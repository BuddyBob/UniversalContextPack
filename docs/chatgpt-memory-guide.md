# Move ChatGPT Memory - Complete Guide

⏱️ **5 MIN READ**

Learn how to extract your ChatGPT conversation history and transform it into portable AI memory that works with any LLM provider.

---

## Table of Contents

1. [Overview](#overview)
2. [Method 1: Export JSON Files](#method-1-export-json-files)
3. [Method 2: Shared Conversation URLs](#method-2-shared-conversation-urls)
4. [Understanding the JSON Structure](#understanding-the-json-structure)
5. [The Sanitization Pipeline](#the-sanitization-pipeline)
6. [Handling API Limitations](#handling-api-limitations)
7. [Best Practices](#best-practices)

---

## Overview

ChatGPT stores all your conversation history, which contains valuable context about your:
- Communication style and preferences
- Technical expertise and knowledge domains
- Project patterns and workflows
- Goals, values, and personality traits

Universal Context Pack extracts this data and transforms it into **structured memory nodes** that can be loaded into any AI platform.

---

## Method 1: Export JSON Files

### Step 1: Export from ChatGPT

1. Go to [ChatGPT Settings](https://chat.openai.com/settings)
2. Navigate to **Data Controls** → **Export Data**
3. Click **Export** and confirm your request
4. Wait for OpenAI to prepare your data (usually 24-48 hours)
5. Download the ZIP file when ready

### Step 2: Extract Conversations

Your export contains:
```
chatgpt-export/
├── conversations.json     ← Main conversation history
├── chat.html             ← Human-readable format
├── message_feedback.json
└── model_comparisons.json
```

The `conversations.json` file is what you'll upload to Universal Context Pack.

### Step 3: Upload to UCP

1. Visit [context-pack.com/packs](https://www.context-pack.com/packs)
2. Create a new pack or open an existing one
3. Click **Add Source** → **Upload File**
4. Select your `conversations.json` file
5. The system automatically detects the format and begins processing

---

## Method 2: Shared Conversation URLs

For individual conversations, you can use shared URLs directly—no export needed.

### Step 1: Share a Conversation

1. Open any ChatGPT conversation
2. Click the **Share** button (top right)
3. Enable **Share link** and copy the URL
4. The URL format: `https://chatgpt.com/share/[conversation-id]`

### Step 2: Extract with UCP

1. Go to your pack in UCP
2. Click **Add Source** → **Paste URL**
3. Paste the ChatGPT share link
4. UCP automatically extracts the conversation content

### How URL Extraction Works

Our `ChatGPTExtractor` class uses HTTP requests to:
1. Fetch the shared conversation page
2. Parse JavaScript data from the HTML
3. Extract conversation text blocks
4. Filter out metadata, URLs, and code
5. Format into readable message structure

```python
# The extractor validates URLs automatically
valid_domains = ['chatgpt.com', 'chat.openai.com']
valid_paths = ['/share/', '/c/']
```

### URL Limitations

- Only works with **public shared links** (not private conversations)
- Rate limited to prevent abuse (max ~10 URLs per minute)
- Some older share links may not work if OpenAI changed formats

---

## Understanding the JSON Structure

ChatGPT exports use this structure:

```json
{
  "id": "conversation-uuid",
  "title": "Conversation Title",
  "create_time": 1234567890,
  "update_time": 1234567890,
  "mapping": {
    "message-uuid-1": {
      "id": "message-uuid-1",
      "message": {
        "author": {"role": "user"},
        "content": {"parts": ["User message text"]},
        "create_time": 1234567890
      }
    },
    "message-uuid-2": {
      "id": "message-uuid-2",
      "parent": "message-uuid-1",
      "message": {
        "author": {"role": "assistant"},
        "content": {"parts": ["Assistant response"]},
        "create_time": 1234567890
      }
    }
  }
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `mapping` | Tree structure of all messages |
| `parent` | Links messages in conversation thread |
| `author.role` | `user`, `assistant`, or `system` |
| `content.parts` | Array of message text blocks |
| `create_time` | Unix timestamp |

---

## The Sanitization Pipeline

UCP processes your ChatGPT data through multiple stages:

### Stage 1: Extraction
- Parse JSON structure
- Reconstruct conversation threads from message tree
- Handle malformed or incomplete data
- Extract metadata (timestamps, model used, etc.)

### Stage 2: Filtering
Remove noise that doesn't contribute to context:
- System messages and prompts
- Error messages and retries
- Duplicate content from branches
- Empty or extremely short messages

### Stage 3: Chunking
Split large conversations into optimal segments:
- **Chunk size**: 150,000 tokens (balance of context and cost)
- **Overlap**: Maintains continuity between chunks
- **Smart splitting**: Breaks at conversation boundaries, not mid-message

### Stage 4: Analysis
Each chunk is analyzed by GPT-4 to extract:
- **Identity**: Name, roles, background, demographics
- **Preferences**: Communication style, tools, workflows
- **Knowledge**: Skills, expertise, domain knowledge
- **Projects**: Active work, goals, collaboration patterns
- **Facts**: Relationships, events, contextual information

### Stage 5: Memory Tree Construction
Structured facts are stored as **memory nodes**:
- Nodes are deduplicated (same fact found multiple times → merged)
- Evidence links track which chunks support each fact
- Scopes organize nodes (`user_profile`, `knowledge:topic`)

---

## Handling API Limitations

### Rate Limits

**OpenAI API**:
- Standard rate limits apply to analysis
- We use optimized chunking to minimize API calls
- Prompt caching reduces costs for similar content

**ChatGPT Export**:
- One export request per 24 hours
- Export may take 24-48 hours to prepare

### Large Conversation Files

If your `conversations.json` is very large (>100MB):

1. **Split by date range**: Create multiple packs for different time periods
2. **Selective processing**: Only analyze recent conversations
3. **Use ZIP compression**: Reduces upload time and storage

### Token Limits

ChatGPT conversations can be massive. UCP handles this by:
- Automatic chunking (150K tokens per chunk)
- Streaming uploads for large files
- Background processing with progress updates

---

## Best Practices

### 1. Export Regularly
Create periodic exports to maintain backups:
- Monthly exports for active users
- Quarterly exports for occasional users
- After important conversations

### 2. Organize by Purpose
Create separate packs for different contexts:
- **Personal Pack**: General knowledge and preferences
- **Work Pack**: Professional projects and expertise
- **Learning Pack**: Educational conversations and research

### 3. Selective Processing
You don't need to analyze everything:
- Focus on **recent conversations** (last 3-6 months)
- Skip **small talk** and **troubleshooting**
- Prioritize **substantive discussions** about your expertise

### 4. Clean Your Data
Before uploading:
- **Review sensitive info**: Remove private data if needed
- **Delete test conversations**: Remove debugging or testing chats
- **Merge related topics**: Group similar conversations

### 5. Verify Extraction Quality
After processing:
- **Check the pack preview**: Does it accurately represent you?
- **Review memory nodes**: Are facts correct and relevant?
- **Delete inaccuracies**: Remove or edit incorrect nodes
- See [Context Management Guide](context-management.md) for editing

---

## Next Steps

✅ **You've exported your ChatGPT memory!**

Now you can:
- [Manage your context nodes](context-management.md) - Edit and organize
- [Transfer to Claude](migration-claude.md) - Use with Anthropic's AI
- [Transfer to Gemini](migration-gemini.md) - Use with Google's AI
- [Create local backups](local-backup.md) - Save as JSON

---

## Common Issues

### Export File Not Found
**Problem**: Can't find `conversations.json` in the export  
**Solution**: Look for `chat.json` or similar - OpenAI occasionally changes naming

### Upload Fails
**Problem**: File upload times out or fails  
**Solution**: 
- Compress as ZIP first
- Check file size (max 1GB)
- Try splitting into smaller date ranges

### No Context Extracted
**Problem**: Processing completes but pack is empty  
**Solution**:
- Verify file contains actual conversations
- Check JSON format (must be valid ChatGPT export)
- Contact support if file format has changed

### Wrong Interpretation
**Problem**: Analysis misunderstands your context  
**Solution**:
- Use [Context Management](context-management.md) to edit nodes
- Provide more recent conversations for better accuracy
- Delete outdated or incorrect nodes

---

**[← Back to Documentation Hub](index.md)**

# Backend Architecture Guide - simple_backend.py

## Overview
This guide explains how the UCP backend (`simple_backend.py`) processes conversation files through the `/process` page workflow. The system follows a **Pack V2 architecture** where files are organized into "packs" (collections) and "sources" (individual files).

---

## Core Workflow: /process Page

### High-Level Flow
```
User on /process page
  ↓
1. Create/Select Pack → POST /api/v2/packs
  ↓
2. Upload File/URL → POST /api/v2/packs/{pack_id}/sources
  ↓
3. Extract & Chunk (automatic background processing)
  ↓
4. Poll Status → GET /api/v2/sources/{source_id}/status
  ↓
5. Check Credits → GET /api/v2/sources/{source_id}/credit-check
  ↓
6. Start Analysis → POST /api/v2/sources/{source_id}/start-analysis
  ↓
7. Poll Status (analyzing) → GET /api/v2/sources/{source_id}/status
  ↓
8. Download Results → GET /api/v2/packs/{pack_id}/download/zip
```

---

## API Endpoints: Pack Management

### 1. Create Pack
**Endpoint**: `POST /api/v2/packs`
**File Location**: Line 3591
**Purpose**: Create a new empty pack to hold sources

**Request Body**:
```json
{
  "pack_name": "My ChatGPT History",
  "description": "Conversations from Q4 2024",
  "custom_system_prompt": "Focus on technical discussions" // Optional
}
```

**Response**:
```json
{
  "pack_id": "uuid-here",
  "pack_name": "My ChatGPT History",
  "total_sources": 0,
  "total_tokens": 0
}
```

**Database**: Calls RPC `create_pack_v2()` to insert into `packs` table

---

### 2. List User Packs
**Endpoint**: `GET /api/v2/packs`
**File Location**: Line 3639
**Purpose**: Get all packs for authenticated user

**Response**:
```json
{
  "packs": [
    {
      "pack_id": "uuid",
      "pack_name": "Pack Name",
      "total_sources": 3,
      "total_tokens": 450000,
      "created_at": "2024-11-22T...",
      "sources": [...]
    }
  ]
}
```

**Database**: Calls RPC `get_user_packs_v2()` with joins to `pack_sources`

---

### 3. Get Pack Details
**Endpoint**: `GET /api/v2/packs/{pack_id}`
**File Location**: Line 3675
**Purpose**: Get detailed info about a specific pack including all sources

**Response**: Pack object with full source details including chunk counts and analysis status

---

## API Endpoints: Source Upload & Processing

### 4. Add Source to Pack (FILE UPLOAD OR URL)
**Endpoint**: `POST /api/v2/packs/{pack_id}/sources`
**File Location**: Line 3760
**Purpose**: Upload a conversation file OR provide a URL to add to a pack

**Key Function**: `add_source_to_pack()`

#### Request (File Upload):
```
Content-Type: multipart/form-data

file: [UploadFile]
source_name: "ChatGPT Export Nov 2024"
source_type: "chat_export"
```

#### Request (URL):
```
Content-Type: multipart/form-data

file: [empty blob]  // Workaround for FastAPI validation
url: "https://chatgpt.com/share/abc123"
source_name: "Shared Conversation"
source_type: "chat_export"
```

**Processing Flow**:

1. **Validate Input**: Check that either file OR url is provided (not both, not neither)
2. **Generate source_id**: UUID for this source
3. **Database Record**: Call RPC `add_pack_source()` to create record in `pack_sources` table
4. **Background Task**: Launch async processing:
   - **For Files**: `extract_and_chunk_source()` - Line 1842
   - **For URLs**: `process_conversation_url_for_pack()` - Line 3478

**Response**:
```json
{
  "source_id": "uuid",
  "pack_id": "pack-uuid",
  "source_name": "ChatGPT Export",
  "status": "extracting",
  "message": "Source added and extraction started"
}
```

**Important Notes**:
- Returns immediately (202 Accepted)
- Actual processing happens in background
- Frontend polls status endpoint to track progress

---

## Core Processing Functions

### 5. extract_and_chunk_source() - Line 1842
**Purpose**: Extract text from file and split into chunks

**Parameters**:
- `pack_id`: Pack containing this source
- `source_id`: Unique source identifier
- `file_content`: Raw file content (string)
- `filename`: Original filename
- `user`: Authenticated user object

**Processing Steps**:

```python
# 1. Update status to 'extracting'
supabase.rpc("update_pack_source_status", {
    "target_source_id": source_id,
    "new_status": "extracting"
})

# 2. Extract meaningful text from file content
extracted_text = extract_from_text_content(file_content)
# Cleans HTML, removes timestamps, filters noise

# 3. Smart chunking
chunks = create_smart_chunks(extracted_text, max_chunk_size=150000)
# Returns list of {"chunk_id": 0, "text": "...", "tokens": 145000}

# 4. Save chunks to R2 storage
for chunk in chunks:
    r2_key = f"chunks/{pack_id}/{source_id}/chunk_{chunk['chunk_id']}.txt"
    r2_client.put_object(Bucket=bucket, Key=r2_key, Body=chunk['text'])

# 5. Save chunk metadata to database
chunk_records = [
    {
        "chunk_id": chunk["chunk_id"],
        "chunk_text": chunk["text"][:500],  # Preview only
        "token_count": chunk["tokens"],
        "r2_path": r2_key,
        "status": "chunked"
    }
    for chunk in chunks
]
supabase.from_("pack_source_chunks").insert(chunk_records).execute()

# 6. Update source status to 'chunked'
supabase.rpc("update_pack_source_status", {
    "target_source_id": source_id,
    "new_status": "chunked"
})
```

**Error Handling**: If any step fails, updates status to 'error' with error message

**Database Tables Updated**:
- `pack_sources`: status → 'extracting' → 'chunked'
- `pack_source_chunks`: Insert chunk records
- `packs`: Increment total_tokens

---

### 6. process_conversation_url_for_pack() - Line 3478
**Purpose**: Extract conversation from shared URL (ChatGPT/Claude links)

**Parameters**:
- `pack_id`: Pack containing this source
- `source_id`: Unique source identifier
- `url`: Shared conversation URL
- `platform`: 'ChatGPT' or 'Claude'
- `user`: Authenticated user object

**Processing Steps**:

```python
# 1. Update status
supabase.rpc("update_pack_source_status", {
    "target_source_id": source_id,
    "new_status": "extracting"
})

# 2. Validate URL format
if platform == 'ChatGPT':
    # Must match: chatgpt.com/share/xxx or chat.openai.com/share/xxx
    validate_chatgpt_url(url)
elif platform == 'Claude':
    # Must match: claude.ai/share/xxx
    validate_claude_url(url)

# 3. Extract conversation content from URL
if platform == 'ChatGPT':
    from chatgpt_extractor import extract_chatgpt_conversation
    conversation_data = await extract_chatgpt_conversation(url)
elif platform == 'Claude':
    conversation_data = await extract_claude_conversation(url)

# 4. Convert to text format
file_content = format_conversation_to_text(conversation_data)

# 5. Call extract_and_chunk_source() with the extracted text
await extract_and_chunk_source(
    pack_id=pack_id,
    source_id=source_id,
    file_content=file_content,
    filename=url,
    user=user
)
```

**Key Difference from File Upload**: 
- Extracts content from web URL first
- Then follows same chunking pipeline as file uploads
- URL stored in `file_name` field for reference

---

## API Endpoints: Analysis

### 7. Get Source Status
**Endpoint**: `GET /api/v2/sources/{source_id}/status`
**File Location**: Line 3936
**Purpose**: Poll processing status (used by frontend during extraction & analysis)

**Response**:
```json
{
  "source_id": "uuid",
  "status": "chunked", // extracting|chunked|analyzing|analyzed|error
  "total_chunks": 5,
  "analyzed_chunks": 0,
  "total_tokens": 750000,
  "error_message": null,
  "pack_id": "pack-uuid",
  "source_name": "ChatGPT Export"
}
```

**Status Values**:
- `extracting`: Currently extracting and chunking
- `chunked`: Ready for analysis
- `analyzing`: AI analysis in progress
- `analyzed`: Complete, ready to download
- `error`: Failed with error message

---

### 8. Credit Check
**Endpoint**: `GET /api/v2/sources/{source_id}/credit-check`
**File Location**: Line 4014
**Purpose**: Check if user has enough credits to analyze this source

**Response**:
```json
{
  "total_chunks": 5,
  "credits_required": 5,
  "user_credits": 10,
  "can_proceed": true,
  "credits_after": 5,
  "message": "You have sufficient credits"
}
```

**Logic**:
- Each chunk = 1 credit
- Checks `user_profiles.credits_balance`
- Unlimited plan users: always `can_proceed: true`

**Database**: Queries `pack_source_chunks` COUNT + `user_profiles.credits_balance`

---

### 9. Start Analysis
**Endpoint**: `POST /api/v2/sources/{source_id}/start-analysis`
**File Location**: Line 4067
**Purpose**: Begin AI analysis of chunked source

**Request Body**:
```json
{
  "max_chunks": 5  // Optional: limit chunks to analyze
}
```

**Processing Flow**:

```python
# 1. Verify source is in 'chunked' status
source = get_source(source_id)
if source.status != 'chunked':
    raise HTTPException(400, "Source must be chunked first")

# 2. Check user has enough credits
chunk_count = get_chunk_count(source_id)
if not user.is_unlimited and user.credits < chunk_count:
    raise HTTPException(402, "Insufficient credits")

# 3. Update status to 'analyzing'
update_source_status(source_id, "analyzing")

# 4. Launch background analysis task
asyncio.create_task(
    analyze_source_chunks(
        pack_id=source.pack_id,
        source_id=source_id,
        filename=source.file_name,
        user=user,
        max_chunks=max_chunks,
        custom_system_prompt=pack.custom_system_prompt
    )
)

# 5. Return immediately
return {
    "status": "analyzing",
    "total_chunks": chunk_count,
    "estimated_time_seconds": chunk_count * 60
}
```

**Important**: Returns 202 Accepted immediately, analysis runs in background

---

### 10. analyze_source_chunks() - Line 1989
**Purpose**: Main AI analysis function (background task)

**Parameters**:
- `pack_id`: Pack containing source
- `source_id`: Source to analyze
- `filename`: Original filename for logs
- `user`: Authenticated user
- `max_chunks`: Optional limit on chunks to analyze
- `custom_system_prompt`: Optional custom analysis prompt

**Processing Steps**:

```python
# 1. Load all chunks from database
chunks = supabase.from_("pack_source_chunks")\
    .select("*")\
    .eq("source_id", source_id)\
    .order("chunk_id")\
    .execute()

# Apply max_chunks limit if specified
if max_chunks:
    chunks = chunks[:max_chunks]

# 2. Get analysis system prompt
if custom_system_prompt:
    system_prompt = custom_system_prompt
else:
    system_prompt = get_default_system_prompt()  # 6-category analysis

# 3. Deduct credits upfront
if not user.is_unlimited:
    supabase.rpc("deduct_credits", {
        "user_uuid": user.user_id,
        "credit_amount": len(chunks)
    }).execute()

# 4. Process each chunk with GPT-4
analyzed_chunks = []
for i, chunk in enumerate(chunks):
    # Load full chunk text from R2
    chunk_text = r2_client.get_object(
        Bucket=bucket,
        Key=chunk['r2_path']
    )['Body'].read().decode('utf-8')
    
    # Call OpenAI API
    response = await openai_client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": chunk_text}
        ],
        temperature=0.3
    )
    
    analysis_result = response.choices[0].message.content
    
    # Save analysis to R2
    analysis_key = f"analysis/{pack_id}/{source_id}/chunk_{i}_analysis.txt"
    r2_client.put_object(
        Bucket=bucket,
        Key=analysis_key,
        Body=analysis_result
    )
    
    # Update chunk status
    supabase.from_("pack_source_chunks")\
        .update({
            "status": "analyzed",
            "analysis_r2_path": analysis_key
        })\
        .eq("id", chunk['id'])\
        .execute()
    
    analyzed_chunks.append(analysis_result)
    
    # Update progress (for polling)
    supabase.rpc("update_pack_source_analysis_progress", {
        "target_source_id": source_id,
        "chunks_analyzed": i + 1
    })

# 5. Aggregate all analyses into final UCP
final_ucp = aggregate_analyses(analyzed_chunks)
# Combines all chunk analyses into single coherent profile

# 6. Save final UCP to R2
ucp_key = f"ucps/{pack_id}/{source_id}/complete_ucp.txt"
r2_client.put_object(
    Bucket=bucket,
    Key=ucp_key,
    Body=final_ucp
)

# 7. Update source status to 'analyzed'
supabase.rpc("update_pack_source_status", {
    "target_source_id": source_id,
    "new_status": "analyzed",
    "ucp_r2_path": ucp_key
})
```

**Error Handling**:
- If analysis fails, refunds unused credits
- Updates status to 'error' with message
- Individual chunk failures don't stop entire analysis

**Cost**: Each chunk analyzed = 1 credit deducted

---

## API Endpoints: Download Results

### 11. Download Pack as ZIP
**Endpoint**: `GET /api/v2/packs/{pack_id}/download/zip`
**File Location**: Line 4195
**Purpose**: Download complete pack with all analyzed sources

**Response**: ZIP file containing:
```
pack_name.zip
├── source_1_name/
│   ├── complete_ucp.txt          # Final aggregated analysis
│   ├── chunk_0_analysis.txt      # Individual chunk analyses
│   ├── chunk_1_analysis.txt
│   └── ...
├── source_2_name/
│   └── ...
└── pack_summary.json             # Metadata about pack
```

**Processing**:
```python
# 1. Verify user owns pack
pack = get_pack(pack_id)
if pack.user_id != user.user_id:
    raise HTTPException(403, "Not authorized")

# 2. Get all sources in pack
sources = get_pack_sources(pack_id)

# 3. For each source, download files from R2
zip_buffer = BytesIO()
with zipfile.ZipFile(zip_buffer, 'w') as zf:
    for source in sources:
        # Download complete UCP
        ucp_content = r2_client.get_object(
            Bucket=bucket,
            Key=source['ucp_r2_path']
        )['Body'].read()
        
        zf.writestr(
            f"{source['source_name']}/complete_ucp.txt",
            ucp_content
        )
        
        # Download individual chunk analyses
        chunks = get_analyzed_chunks(source['source_id'])
        for chunk in chunks:
            chunk_analysis = r2_client.get_object(
                Bucket=bucket,
                Key=chunk['analysis_r2_path']
            )['Body'].read()
            
            zf.writestr(
                f"{source['source_name']}/chunk_{chunk['chunk_id']}_analysis.txt",
                chunk_analysis
            )
    
    # Add pack summary
    summary = {
        "pack_name": pack['pack_name'],
        "total_sources": len(sources),
        "total_tokens": pack['total_tokens'],
        "created_at": pack['created_at']
    }
    zf.writestr("pack_summary.json", json.dumps(summary, indent=2))

# 4. Return ZIP file
return Response(
    content=zip_buffer.getvalue(),
    media_type="application/zip",
    headers={
        "Content-Disposition": f"attachment; filename={pack['pack_name']}.zip"
    }
)
```

---

### 12. Export Pack as Single File
**Endpoint**: `GET /api/v2/packs/{pack_id}/export/{export_type}`
**File Location**: Line 4311
**Purpose**: Export entire pack as single combined file

**Export Types**:
- `ucp`: Combined UCP text file (all sources merged)
- `json`: JSON with all analyses and metadata
- `markdown`: Formatted markdown document

**Example (UCP export)**:
```python
# 1. Get all sources
sources = get_pack_sources(pack_id)

# 2. Combine all UCPs
combined_ucp = f"# Universal Context Pack: {pack['pack_name']}\n\n"
combined_ucp += f"Generated: {datetime.now()}\n\n"

for source in sources:
    ucp_content = r2_client.get_object(
        Bucket=bucket,
        Key=source['ucp_r2_path']
    )['Body'].read().decode('utf-8')
    
    combined_ucp += f"\n\n## Source: {source['source_name']}\n\n"
    combined_ucp += ucp_content

# 3. Return as downloadable file
return Response(
    content=combined_ucp,
    media_type="text/plain",
    headers={
        "Content-Disposition": f"attachment; filename={pack['pack_name']}_UCP.txt"
    }
)
```

---

## Helper Functions

### extract_from_text_content() - Line 1461
**Purpose**: Clean and extract meaningful text from raw file content

**Operations**:
1. Detect and parse JSON structures
2. Remove timestamps, usernames, system messages
3. Filter out noise (errors, warnings, metadata)
4. Deduplicate repeated content
5. Extract only meaningful conversation text

**Input**: Raw file content (JSON export or plain text)
**Output**: Clean conversation text

---

### create_smart_chunks() - Line ~1700
**Purpose**: Split large text into optimal chunks for analysis

**Algorithm**:
```python
def create_smart_chunks(text: str, max_chunk_size: int = 150000):
    # 1. Split by double newlines (conversation boundaries)
    segments = text.split('\n\n')
    
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for segment in segments:
        segment_tokens = count_tokens(segment)
        
        # 2. If adding segment exceeds limit, start new chunk
        if current_tokens + segment_tokens > max_chunk_size:
            if current_chunk:
                chunks.append({
                    "chunk_id": len(chunks),
                    "text": current_chunk,
                    "tokens": current_tokens
                })
            current_chunk = segment
            current_tokens = segment_tokens
        else:
            current_chunk += "\n\n" + segment
            current_tokens += segment_tokens
    
    # 3. Add final chunk
    if current_chunk:
        chunks.append({
            "chunk_id": len(chunks),
            "text": current_chunk,
            "tokens": current_tokens
        })
    
    return chunks
```

**Key Features**:
- Preserves conversation boundaries
- Handles segments larger than max size (splits further if needed)
- Uses tiktoken for accurate token counting
- Optimizes for GPT-4 context window

---

## Database Schema (Simplified)

### packs
```sql
- pack_id (uuid, PK)
- user_id (uuid, FK to auth.users)
- pack_name (text)
- description (text)
- custom_system_prompt (text, nullable)
- total_sources (int, default 0)
- total_tokens (bigint, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

### pack_sources
```sql
- source_id (uuid, PK)
- pack_id (uuid, FK to packs)
- user_id (uuid, FK to auth.users)
- source_name (text)
- source_type (text) -- 'chat_export' or 'chat_url'
- file_name (text) -- Original filename or URL
- file_size (bigint)
- status (text) -- 'extracting'|'chunked'|'analyzing'|'analyzed'|'error'
- error_message (text, nullable)
- total_tokens (bigint, default 0)
- ucp_r2_path (text, nullable) -- Path to final UCP in R2
- created_at (timestamp)
- updated_at (timestamp)
```

### pack_source_chunks
```sql
- id (serial, PK)
- source_id (uuid, FK to pack_sources)
- chunk_id (int) -- Sequence number within source
- chunk_text (text) -- Preview only (first 500 chars)
- token_count (int)
- r2_path (text) -- Full chunk text location
- analysis_r2_path (text, nullable) -- Analysis result location
- status (text) -- 'chunked'|'analyzing'|'analyzed'
- created_at (timestamp)
```

### user_profiles
```sql
- user_id (uuid, PK, FK to auth.users)
- email (text)
- credits_balance (int, default 0)
- plan (text) -- 'free'|'paid'|'unlimited'
- is_unlimited (boolean, default false)
- created_at (timestamp)
```

---

## Frontend Integration Example

### Complete /process Workflow

```typescript
// 1. User selects/creates pack
const packResponse = await fetch('/api/v2/packs', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    pack_name: 'My ChatGPT History',
    description: 'Q4 2024 conversations'
  })
});
const { pack_id } = await packResponse.json();

// 2. User uploads file
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('source_name', 'ChatGPT Export Nov 2024');
formData.append('source_type', 'chat_export');

const uploadResponse = await fetch(`/api/v2/packs/${pack_id}/sources`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const { source_id } = await uploadResponse.json();

// 3. Poll extraction status
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(`/api/v2/sources/${source_id}/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const status = await statusResponse.json();
  
  if (status.status === 'chunked') {
    clearInterval(pollInterval);
    showChunkedUI(status.total_chunks);
  } else if (status.status === 'error') {
    clearInterval(pollInterval);
    showError(status.error_message);
  }
}, 2000);

// 4. User clicks "Analyze"
// First check credits
const creditCheck = await fetch(`/api/v2/sources/${source_id}/credit-check`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const credits = await creditCheck.json();

if (!credits.can_proceed) {
  showUpgradePrompt();
  return;
}

// Start analysis
const analysisResponse = await fetch(`/api/v2/sources/${source_id}/start-analysis`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ max_chunks: credits.total_chunks })
});

// 5. Poll analysis progress
const analysisPoll = setInterval(async () => {
  const statusResponse = await fetch(`/api/v2/sources/${source_id}/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const status = await statusResponse.json();
  
  updateProgressBar(status.analyzed_chunks / status.total_chunks);
  
  if (status.status === 'analyzed') {
    clearInterval(analysisPoll);
    showDownloadButton(pack_id);
  }
}, 3000);

// 6. Download results
const downloadUrl = `/api/v2/packs/${pack_id}/download/zip`;
window.location.href = downloadUrl;
```

---

## Common Issues & Debugging

### Issue: "Source stuck in 'extracting' status"
**Cause**: Background task crashed or timed out
**Debug**:
1. Check backend logs for exceptions
2. Verify R2 storage is accessible
3. Check file content is valid format

### Issue: "Analysis fails after 1-2 chunks"
**Cause**: OpenAI API key invalid or rate limited
**Debug**:
1. Verify user's API key in `user_profiles`
2. Check OpenAI API quota/limits
3. Look for 429 errors in logs

### Issue: "Credits not deducted correctly"
**Cause**: Race condition or failed transaction
**Debug**:
1. Check `user_profiles.credits_balance` directly
2. Verify RPC `deduct_credits` execution
3. Check for partial analysis rollbacks

---

## Security Considerations

### Authentication
- All endpoints require JWT token via `Depends(get_current_user)`
- Token contains `user_id` used for row-level filtering
- Supabase RLS policies enforce user data isolation

### Authorization
- Users can only access their own packs/sources
- All queries filter by `user_id`
- Pack ownership verified on every operation

### Data Privacy
- Files stored in R2 with user-specific paths
- No cross-user data access possible
- API keys stored encrypted in database

### Rate Limiting
- Credit system prevents abuse
- Background tasks have timeout limits
- OpenAI API calls throttled per user

---

## Performance Optimizations

### Async Processing
- File upload returns immediately (202)
- Heavy processing in background tasks
- Frontend polls for updates

### Chunking Strategy
- 150K tokens balances cost vs context
- Parallel chunk analysis possible (not currently implemented)
- Smart boundaries preserve conversation flow

### Storage
- R2 for cheap, scalable file storage
- Database stores metadata only, not full text
- Chunk previews (500 chars) for UI without fetching full text

### Caching
- System prompts cached in memory
- Token counts cached to avoid recomputation
- User profile data cached per request

---

## Summary

The `/process` workflow follows this simple pattern:

1. **Pack Creation**: User creates container for sources
2. **Source Upload**: User adds file or URL to pack
3. **Extraction**: System extracts/chunks in background (automatic)
4. **Credit Check**: Frontend verifies user can afford analysis
5. **Analysis Start**: User triggers AI analysis (background)
6. **Progress Polling**: Frontend polls status until complete
7. **Download**: User gets ZIP with all results

All heavy processing happens asynchronously in background tasks. The frontend just uploads data and polls status. This architecture keeps the UI responsive and handles large files efficiently.

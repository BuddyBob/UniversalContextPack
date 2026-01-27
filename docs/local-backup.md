# Local Backup Guide

⏱️ **4 MIN READ**

Learn how to save your context pack locally as JSON, export the Memory Tree structure, and implement backup best practices.

---

## Table of Contents

1. [Why Create Local Backups?](#why-create-local-backups)
2. [Export Formats](#export-formats)
3. [Creating Backups](#creating-backups)
4. [Understanding Export Structures](#understanding-export-structures)
5. [Backup Best Practices](#backup-best-practices)
6. [Restoring from Backups](#restoring-from-backups)

---

## Why Create Local Backups?

### Benefits of Local Backups

- **Data ownership**: Full control over your AI memory
- **Version history**: Track how context evolves over time
- **Disaster recovery**: Restore if data is accidentally deleted
- **Offline access**: View context without internet connection
- **Migration**: Move between UCP instances or other tools
- **Privacy**: Keep sensitive context off cloud entirely

### When to Create Backups

- ✅ Before major edits or deletions
- ✅ Monthly, as part of regular maintenance
- ✅ After processing large new sources
- ✅ Before migrating to new AI platforms
- ✅ When reaching project milestones

---

## Export Formats

Universal Context Pack offers **four export formats**, each optimized for different use cases:

### 1. Compact Format

**Purpose**: Token-efficient, minimal formatting

**Best for**:
- AI platforms with small context windows
- Reducing API costs
- Quick sharing

**Structure**:
```
USER PROFILE: Name: John Doe; Roles: Engineer, Leader; 
Skills: React TypeScript Python; Preferences: Concise 
explanations with examples...
```

**Size**: ~60% of Standard format

### 2. Standard Format (Recommended)

**Purpose**: Human-readable, well-structured markdown

**Best for**:
- Most AI platforms (Claude, ChatGPT, Gemini)
- Human review and editing
- General-purpose backup

**Structure**:
```markdown
# USER CONTEXT PACK

## USER PROFILE

### Identity
**Name:** John Doe
**Roles:** Software Engineer, Tech Lead

### Skills
- Expert in React, TypeScript, Python
- Proficient in PostgreSQL, Redis
```

**Size**: Baseline reference

### 3. Complete Format

**Purpose**: All evidence, metadata, and source attribution

**Best for**:
- Long-context AIs (Gemini 1M tokens)
- Comprehensive backups
- Audit trails and verification

**Structure**:
```markdown
# USER CONTEXT PACK (COMPLETE)

## USER PROFILE

### Identity
**Name:** John Doe
**Roles:** Software Engineer, Tech Lead
**Evidence:**
  - Source: conversations.json (Chunk 5)
    "I'm John, a software engineer with 5 years..."
  - Source: linkedin_export.pdf (Page 1)
    "John Doe - Senior Engineer at Tech Corp"

### Skills
- Expert in React, TypeScript, Python
  **Evidence:**
    - Source: conversations.json (Chunk 12)
      "I've been using React professionally for 4 years..."
```

**Size**: ~150-200% of Standard format

### 4. Tree Format (JSON)

**Purpose**: Structured data for programmatic use

**Best for**:
- Developers building on UCP
- Custom analysis tools
- Vector database imports
- Future re-import (feature coming soon)

**Structure**:
```json
{
  "pack_id": "pack-123",
  "user_id": "user-uuid",
  "generated_at": "2026-01-27T12:00:00Z",
  "nodes": [
    {
      "id": "node-uuid-1",
      "label": "Expert in React",
      "node_type": "Skill",
      "data": {
        "text": "Expert in React with 5 years experience",
        "proficiency": "expert"
      }
    }
  ]
}
```

**Size**: ~120% of Standard format (includes metadata)

---

## Creating Backups

### Export from Web UI

1. Go to [context-pack.com/packs](https://www.context-pack.com/packs)
2. Open your pack
3. Click **Download Pack** button
4. Select export format:
   - Compact
   - Standard
   - Complete
   - Tree (JSON)
5. File downloads: `pack-[id]-[format]-[date].txt` or `.json`

### Save Locally

**Recommended structure**:
```
~/Documents/UCP-Backups/
├── 2026-01/
│   ├── work-pack-standard-2026-01-27.txt
│   ├── work-pack-tree-2026-01-27.json
│   └── personal-pack-standard-2026-01-27.txt
├── 2026-02/
│   └── work-pack-standard-2026-02-15.txt
└── README.md
```

**Naming convention**:
```
[pack-name]-[format]-[YYYY-MM-DD].[txt|json]
```

Examples:
- `work-context-standard-2026-01-27.txt`
- `personal-memory-tree-2026-01-27.json`
- `research-notes-complete-2026-01-27.txt`

---

## Understanding Export Structures

### Standard Format Breakdown

```markdown
# USER CONTEXT PACK
*Generated from Memory Tree on 2026-01-27*

---

## USER PROFILE                    ← Scope: user_profile

### Identity                       ← Node type
**Name:** John Doe                ← Data fields
**Roles:** Engineer, Tech Lead

### Preferences                    ← Multiple nodes of same type
- Prefers TypeScript over JavaScript
- Likes detailed code reviews
- Values work-life balance

### Projects                       ← Structured nodes
**Universal Context Pack**
Building AI memory portability tool
*Status: Active*

---

## KNOWLEDGE: Machine Learning   ← Scope: knowledge:machine_learning

### Concepts                      ← Knowledge-specific node types
**Transformer Architecture**
Neural network architecture using self-attention...

### Entities
**OpenAI** - AI research company
**Anthropic** - AI safety company
```

### Tree Format (JSON) Breakdown

```json
{
  "pack_id": "unique-pack-id",
  "user_id": "user-uuid",
  "generated_at": "2026-01-27T12:00:00Z",
  
  "nodes": [
    {
      "id": "node-uuid",           // Unique node identifier
      "label": "Expert in React",   // Human-readable title
      "node_type": "Skill",         // Category
      "data": {                     // Structured data
        "text": "Expert in React...",
        "proficiency": "expert",
        "years": 5
      }
    }
  ]
}
```

**Key fields**:
- `id`: Unique identifier for each node
- `label`: Display title (max 120 chars)
- `node_type`: Category (Identity, Skill, Project, etc.)
- `data`: Flexible JSON object with node-specific fields

**Note**: Tree format excludes `created_at`, `updated_at`, and `evidence_count` for simplicity and AI-friendliness.

---

## Backup Best Practices

### 1. Use the 3-2-1 Rule

- **3 copies** of your data (original + 2 backups)
- **2 different media** (local disk + cloud storage)
- **1 off-site** backup (cloud service or external disk)

**Example**:
1. Original: Live in UCP
2. Backup 1: Local disk (`~/Documents/UCP-Backups/`)
3. Backup 2: Cloud storage (Google Drive, Dropbox, iCloud)

### 2. Version Control

Use Git for backup versioning:

```bash
cd ~/Documents/UCP-Backups/
git init
git add .
git commit -m "Monthly backup - Jan 2026"
git tag "v2026-01"
```

Benefits:
- Track changes over time
- Revert to previous versions
- See context evolution

### 3. Automate Backups

**Manual approach** (recommended monthly):
1. Set calendar reminder (1st of each month)
2. Export Standard + Tree formats
3. Save to backup folder
4. Commit to Git

**Future automated approach** (coming soon):
- UCP will support scheduled exports
- Auto-upload to your cloud storage
- Email notifications when backup completes

### 4. Test Restores

**Monthly verification**:
1. Pick a random backup file
2. Open and review contents
3. Verify JSON is valid (for Tree format)
4. Ensure no corruption

```bash
# Validate JSON backup
cat work-pack-tree-2026-01-27.json | python -m json.tool
```

### 5. Document Your Backups

Create `README.md` in your backup folder:

```markdown
# UCP Backup Log

## Current Packs
- **Work Context**: Professional projects, skills, work preferences
- **Personal Context**: Hobbies, personal goals, learning notes

## Backup Schedule
- Frequency: Monthly (1st of month)
- Formats: Standard (for use) + Tree (for restore)
- Storage: Local + Google Drive

## Restore Instructions
1. Create new pack in UCP
2. Upload Tree JSON (when feature available)
3. Or manually paste Standard format into AI

## Change Log
- 2026-01-27: Initial backup setup
- 2026-02-01: Added ML research notes to knowledge scope
```

---

## Restoring from Backups

### Current Restore Methods

**Tree JSON re-import**: *Coming soon* (will support full restore)

**Standard/Complete text restore**: Manual paste into AI

1. Open backup file (`.txt`)
2. Copy contents
3. Paste into Claude Project, ChatGPT conversation, or Gemini prompt

**Selective restore** (using Tree JSON):

```python
import json

# Load backup
with open('backup-tree.json', 'r') as f:
    tree = json.load(f)

# Extract specific nodes
skills = [n for n in tree['nodes'] if n['node_type'] == 'Skill']
projects = [n for n in tree['nodes'] if n['node_type'] == 'Project']

# Create minimal pack
minimal_pack = {
    'nodes': skills + projects
}

# Save for use
with open('minimal-pack.json', 'w') as f:
    json.dump(minimal_pack, f, indent=2)
```

### Future: Full Restore Feature

**Coming soon**: Upload backup JSON to recreate pack

1. Create new pack in UCP
2. Click **Import from Backup**
3. Upload Tree JSON file
4. UCP recreates all nodes and structure
5. Evidence links restored (if sources still exist)

---

## Advanced: Vector Store Export

For power users building custom RAG systems:

### Export for Embeddings

1. Export **Tree JSON** format
2. Extract node labels and data
3. Generate embeddings with OpenAI API
4. Store in vector database (Pinecone, Weaviate, ChromaDB)

**Example**:
```python
import openai
import json

# Load tree
with open('tree-backup.json', 'r') as f:
    tree = json.load(f)

# Generate embeddings
for node in tree['nodes']:
    text = f"{node['label']}: {node['data'].get('text', '')}"
    
    embedding = openai.Embedding.create(
        input=text,
        model="text-embedding-3-small"
    )
    
    node['embedding'] = embedding['data'][0]['embedding']

# Save with embeddings
with open('tree-with-embeddings.json', 'w') as f:
    json.dump(tree, f)
```

### Use Vector Store

Query your context with semantic search:

```python
# User asks a question
question = "What are my Python skills?"

# Get question embedding
q_embedding = openai.Embedding.create(
    input=question,
    model="text-embedding-3-small"
)

# Search vector store
results = vector_db.query(
    vector=q_embedding['data'][0]['embedding'],
    top_k=5
)

# Results are most relevant nodes from your memory
```

---

## Security Considerations

### Sensitive Information

Before backing up:
1. **Review nodes**: Check for sensitive data (addresses, phone numbers, etc.)
2. **Edit if needed**: Remove or redact private info (see [Context Management](context-management.md))
3. **Encrypt backups**: Use encrypted storage for sensitive packs

### Encryption

**macOS**:
```bash
# Encrypt with disk utility
hdiutil create -encryption AES-256 -size 100m \
  -fs HFS+J -volname "UCP Backups" ucp-backups.dmg
```

**Linux**:
```bash
# Encrypt folder with GPG
tar czf - ~/UCP-Backups | gpg -c > ucp-backups.tar.gz.gpg
```

**Cross-platform**: Use VeraCrypt or 7-Zip with AES-256 encryption

### Cloud Storage

If storing backups in cloud:
- Use services with encryption at rest (Google Drive, Dropbox, iCloud)
- Enable 2FA on your cloud account
- Consider client-side encryption before upload

---

## Next Steps

✅ **Your context is backed up and safe!**

Explore more:
- [Context Management](context-management.md) - Clean before backing up
- [Migration to Claude](migration-claude.md) - Use your backup with Claude
- [Migration to Gemini](migration-gemini.md) - Use with Gemini
- [Architecture Guide](architecture-guide.md) - Understand what you're backing up

---

**[← Back to Documentation Hub](index.md)**

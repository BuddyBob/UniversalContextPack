# Context Management Guide

⏱️ **4 MIN READ**

Learn how to edit, delete, and organize your memory nodes to maintain accurate AI context across all platforms.

---

## Table of Contents

1. [What Are Memory Nodes?](#what-are-memory-nodes)
2. [Viewing Your Memory Tree](#viewing-your-memory-tree)
3. [Editing Memory Nodes](#editing-memory-nodes)
4. [Deleting Nodes](#deleting-nodes)
5. [Understanding Scopes](#understanding-scopes)
6. [Evidence Tracking](#evidence-tracking)
7. [Best Practices](#best-practices)

---

## What Are Memory Nodes?

Instead of storing conversations as plain text, Universal Context Pack structures your knowledge as a **graph of memory nodes**.

Each node represents a **specific fact** about you or your knowledge:

| Node Type | Description | Example |
|-----------|-------------|---------|
| **Identity** | Your name, roles, background | "Software engineer with 5 years experience" |
| **Preference** | Communication style, tools | "Prefers concise explanations with examples" |
| **Project** | Active work and goals | "Building a SaaS platform for AI memory" |
| **Skill** | Technical expertise | "Expert in Python, React, PostgreSQL" |
| **Goal** | Objectives and aspirations | "Launch product to 1,000 users by Q2" |
| **Fact** | Relationships, events, context | "Works remotely from San Francisco" |
| **Section** | Document chapters (knowledge) | "Chapter 3: Neural Networks" |
| **Entity** | People, places, organizations | "OpenAI - AI research company" |
| **Concept** | Ideas and definitions | "RAG: Retrieval Augmented Generation" |

### Why Nodes Instead of Text?

**Traditional approach** (concatenated text):
- Duplicates facts across conversations
- Hard to update or correct information
- No way to track evidence for claims
- Becomes bloated over time

**Memory nodes approach**:
- ✅ Each fact stored once
- ✅ Easy to edit or delete specific information
- ✅ Evidence trails show where facts came from
- ✅ Efficient and maintainable

---

## Viewing Your Memory Tree

### Access the Tree Editor

1. Go to [context-pack.com/packs](https://www.context-pack.com/packs)
2. Open any pack
3. Click **View Memory Tree** or **Edit Tree**

### Tree Structure

Your memory tree is organized by **scopes**:

```
📦 Your Pack
├── 👤 user_profile
│   ├── Identity (1 node)
│   ├── Preferences (15 nodes)
│   ├── Projects (8 nodes)
│   ├── Skills (23 nodes)
│   └── Goals (5 nodes)
│
└── 📚 knowledge:machine_learning
    ├── Sections (12 nodes)
    ├── Concepts (45 nodes)
    ├── Entities (8 nodes)
    └── Facts (34 nodes)
```

### Node Display

Each node shows:
- **Label**: Human-readable title
- **Type**: Category (Identity, Skill, etc.)
- **Data**: Structured information (name, description, etc.)
- **Evidence Count**: How many sources support this fact
- **Created/Updated**: Timestamps

---

## Editing Memory Nodes

### When to Edit Nodes

- **Outdated information**: Your role or location changed
- **Incomplete data**: Add more detail to a preference
- **Incorrect extraction**: AI misunderstood a conversation
- **Refinement**: Make facts more precise

### How to Edit a Node

1. Find the node in the tree editor
2. Click **Edit** or select the node
3. Modify the **data fields**:
   ```json
   {
     "name": "John Doe",
     "roles": ["Software Engineer", "Tech Lead"],
     "location": "San Francisco, CA"
   }
   ```
4. Update the **label** if needed (the display title)
5. Click **Save Changes**

### Editable Fields

Different node types have different data structures:

**Identity Node**:
```json
{
  "name": "Your Name",
  "roles": ["Role 1", "Role 2"],
  "background": ["Fact 1", "Fact 2"],
  "demographics": "Optional demographics info"
}
```

**Preference Node**:
```json
{
  "text": "Prefers TypeScript over JavaScript for type safety"
}
```

**Project Node**:
```json
{
  "name": "Project Name",
  "description": "What the project does",
  "status": "Active",
  "technologies": ["React", "Python", "PostgreSQL"]
}
```

**Concept Node** (knowledge):
```json
{
  "name": "Concept Name",
  "definition": "Detailed explanation",
  "category": "Machine Learning",
  "text": "Human-readable summary"
}
```

### Merge Behavior

When processing new conversations, UCP **merges** facts into existing nodes:

- **Lists**: Union (no duplicates) - `["React", "Vue"]` + `["Vue", "Angular"]` = `["React", "Vue", "Angular"]`
- **Scalars**: New value overwrites old - `location: "NYC"` + `location: "SF"` = `location: "SF"`
- **Objects**: Deep merge - `{name: "John", age: 30}` + `{age: 31, role: "Engineer"}` = `{name: "John", age: 31, role: "Engineer"}`

---

## Deleting Nodes

### When to Delete Nodes

- **Incorrect facts**: AI hallucinated or misunderstood
- **Sensitive information**: Remove private data
- **Outdated context**: Old projects you no longer work on
- **Duplicates**: Same fact stored multiple times (rare but possible)

### How to Delete a Node

1. Select the node in the tree editor
2. Click **Delete Node**
3. Confirm deletion

> **⚠️ Warning**: Deleting a node also removes all associated **evidence** records. This action cannot be undone.

### Bulk Deletion

To delete multiple nodes:
1. Select nodes using checkboxes (if available)
2. Click **Delete Selected**
3. Confirm bulk deletion

### What Happens to Evidence?

When you delete a node:
- All evidence links are removed
- Source chunks remain intact
- Other nodes from the same source are unaffected

---

## Understanding Scopes

Scopes organize your memory into logical categories.

### User Profile Scope

**Scope**: `user_profile`

Contains facts about **you**:
- Identity, preferences, communication style
- Skills, goals, constraints
- Active projects and work patterns

**When to use**: Chat conversations with AI assistants, personal knowledge

### Knowledge Scopes

**Scope**: `knowledge:<topic>`

Contains facts about **specific topics**:
- `knowledge:machine_learning` - ML concepts, algorithms, papers
- `knowledge:project_alpha` - Documentation for a specific project
- `knowledge:book_deep_learning` - Notes from a book

**When to use**: PDFs, documentation, research papers, books

### How Scopes Are Assigned

UCP automatically determines scope based on:

| Source Type | Filename | → Scope |
|-------------|----------|---------|
| Chat export | `conversations.json` | `user_profile` |
| Chat export | `chatgpt_history.json` | `user_profile` |
| Document | `Deep Learning Book.pdf` | `knowledge:deep_learning_book` |
| Document | `API Docs.md` | `knowledge:api_docs` |
| URL | `example.com/article` | `knowledge:generic` |

### Changing Scopes

Currently, scopes are auto-assigned during processing. To reorganize:
1. Delete nodes from incorrect scope
2. Re-upload source with corrected filename/type
3. Or manually edit scope (advanced users only)

---

## Evidence Tracking

Every memory node is backed by **evidence** - links to source chunks that support the fact.

### What Is Evidence?

An evidence record contains:
- **Node ID**: Which node this supports
- **Source ID**: Which uploaded file
- **Chunk Index**: Which chunk in the source
- **Snippet**: Short text excerpt (250 chars max)

### Viewing Evidence

When you select a node, you can see:
- **Evidence count**: Number of supporting sources
- **Source list**: Which conversations or documents mentioned this
- **Snippets**: Actual text excerpts

Example:
```
Preference: "Prefers React over Vue"
Evidence:
  ├── Source: conversations.json (Chunk 3)
  │   "I've been using React for 3 years and find it more intuitive..."
  │
  └── Source: project_notes.md (Chunk 1)
      "Decided to build the frontend with React because..."
```

### Why Evidence Matters

- **Trust**: See where facts came from
- **Verification**: Confirm AI didn't hallucinate
- **Updates**: Know which sources to re-process if info changes
- **Debugging**: Understand why AI thinks something about you

---

## Best Practices

### 1. Regular Audits
Review your memory tree monthly:
- Delete outdated projects
- Update changed preferences
- Remove incorrect facts

### 2. Keep It Lean
Don't hoard information:
- Delete trivial preferences
- Focus on **persistent** facts, not temporary interests
- Remove one-off projects that are complete

### 3. Accurate Labels
Use clear, descriptive labels:
- ✅ "Prefers async/await over callbacks in JavaScript"
- ❌ "Code preference"

### 4. Verify After Processing
After analyzing new sources:
- **Review new nodes**: Are they accurate?
- **Check for duplicates**: Same fact stored twice?
- **Edit immediately**: Fix errors while context is fresh

### 5. Organize by Scope
Use scopes intentionally:
- Keep **personal knowledge** in `user_profile`
- Create specific **knowledge scopes** for each domain
- Don't mix unrelated topics in one scope

### 6. Backup Before Major Changes
Before bulk edits or deletions:
- [Export your tree as JSON](local-backup.md)
- Save a backup locally
- Restore if you make a mistake

---

## Common Workflows

### Correcting a Misunderstanding

**Scenario**: AI thinks you're a data scientist, but you're a software engineer.

1. Find the Identity node in `user_profile`
2. Edit the `roles` field: `["Data Scientist"]` → `["Software Engineer"]`
3. Save changes
4. Delete any "Data Science" skill nodes that were incorrectly added

### Removing Sensitive Information

**Scenario**: Your home address was extracted from a conversation.

1. Search for nodes containing the address
2. Select and delete all matching nodes
3. Verify evidence snippets don't contain the address
4. Re-export your pack to ensure clean data

### Updating Project Status

**Scenario**: Finished a project and want to update its status.

1. Find the Project node
2. Edit the data: `"status": "Active"` → `"status": "Complete"`
3. Add completion date if desired: `"completed": "2026-01-27"`
4. Save changes

---

## Advanced: Direct JSON Exports

For power users, you can export and edit the entire tree as JSON:

1. Export tree: **Download → Tree Export**
2. Edit locally in a text editor
3. Re-import (feature coming soon)

Example structure:
```json
{
  "nodes": [
    {
      "id": "node-uuid",
      "label": "Expert in React",
      "node_type": "Skill",
      "data": {
        "text": "Expert in React with 5 years experience"
      }
    }
  ]
}
```

---

## Next Steps

✅ **You know how to manage your context!**

Now explore:
- [Move ChatGPT Memory](chatgpt-memory-guide.md) - Extract from ChatGPT
- [Migration to Claude](migration-claude.md) - Use with Claude AI
- [Local Backup Guide](local-backup.md) - Save your tree locally
- [Architecture Guide](architecture-guide.md) - Understand the system

---

**[← Back to Documentation Hub](index.md)**

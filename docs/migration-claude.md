# Migration Guide: Transfer to Claude

⏱️ **3 MIN READ**

Learn how to use your Universal Context Pack with Anthropic's Claude AI, including format optimization and Projects setup.

---

## Table of Contents

1. [Overview](#overview)
2. [Claude's Context Window](#claudes-context-window)
3. [Export Format for Claude](#export-format-for-claude)
4. [Using Claude Projects](#using-claude-projects)
5. [Best Practices](#best-practices)
6. [Example Workflow](#example-workflow)

---

## Overview

Claude is Anthropic's AI assistant with strong reasoning capabilities and a large context window. Universal Context Pack makes it easy to transfer your ChatGPT memory (or any AI conversation history) to Claude.

### Why Migrate to Claude?

- **Compare AI models**: Test Claude vs ChatGPT with the same context
- **Platform independence**: Not locked into one AI provider
- **Better for certain tasks**: Claude excels at analysis, coding, and long-form writing
- **Team collaboration**: Use Claude's Projects feature for shared context

---

## Claude's Context Window

### Current Limits (as of January 2026)

| Model | Context Window | Best For |
|-------|----------------|----------|
| **Claude 3.5 Sonnet** | 200K tokens (~150K words) | Most use cases |
| **Claude 3 Opus** | 200K tokens | Complex tasks, deep reasoning |
| **Claude 3 Haiku** | 200K tokens | Fast, lightweight tasks |

### Token Estimation

Your UCP pack size in tokens:
- **Standard pack**: 10K - 50K tokens
- **Complete pack**: 50K - 150K tokens
- **Large pack** (many sources): 150K+ tokens

> 💡 **Tip**: Claude's 200K window can hold even very large packs with room for conversation.

---

## Export Format for Claude

### Step 1: Export Your Pack

1. Go to your pack in [context-pack.com/packs](https://www.context-pack.com/packs)
2. Click **Download Pack**
3. Choose export format:
   - **Standard** (recommended for Claude): Structured, readable format
   - **Compact**: Minimal formatting, more token-efficient
   - **Complete**: Includes all evidence and metadata

### Step 2: Optimize for Claude

Claude works best with **well-structured markdown**:

**✅ Good for Claude**:
```markdown
# USER CONTEXT

## Identity
- Name: John Doe
- Role: Software Engineer
- Location: San Francisco, CA

## Skills
- Expert in React, TypeScript, Python
- Proficient in PostgreSQL, Redis
- Familiar with AWS, Docker

## Current Projects
### SaaS Platform for AI Memory
Building Universal Context Pack - a tool for portable AI memory.
Technologies: React, Python, PostgreSQL
Status: Active development
```

**❌ Less ideal**:
```
Name: John Doe, Role: Software Engineer, Location: San Francisco, CA, Skills: React TypeScript Python PostgreSQL Redis AWS Docker, Project: SaaS Platform...
```

UCP's **Standard export** is pre-formatted for Claude's preferences.

---

## Using Claude Projects

Claude Projects let you save reusable context across conversations.

### Step 1: Create a Project

1. Open [Claude.ai](https://claude.ai)
2. Click **Projects** in the sidebar
3. Click **Create Project**
4. Name it: e.g., "My UCP Context"

### Step 2: Add Your Pack

1. Open your new project
2. Click **Add Knowledge**
3. **Option A**: Paste your UCP pack text directly
4. **Option B**: Upload your UCP `.txt` file

### Step 3: Start Conversations

All conversations in this project will automatically have access to your context:
- No need to paste context each time
- Update the project knowledge when your context changes
- Share projects with team members (if using Claude Teams)

### Project Knowledge Best Practices

**Do**:
- ✅ Keep context focused on persistent facts
- ✅ Update project knowledge monthly
- ✅ Use separate projects for work vs personal
- ✅ Name projects clearly: "John's Work Context", "ML Research Notes"

**Don't**:
- ❌ Include temporary or time-sensitive info
- ❌ Mix unrelated contexts in one project
- ❌ Let context get stale (review quarterly)

---

## Best Practices

### 1. Token Budget Management

Claude conversations include:
- **Project knowledge** (your UCP pack): ~20K-50K tokens
- **Conversation history**: Variable
- **Your new message**: ~100-1000 tokens
- **Claude's response budget**: Remaining tokens

**Strategy**: Keep your pack under 50K tokens to leave room for long conversations.

### 2. Format for Readability

Claude responds better to **clear structure**:

```markdown
## Communication Preferences
- **Tone**: Professional but conversational
- **Detail level**: Detailed explanations with examples
- **Code style**: TypeScript with functional patterns
- **Feedback style**: Direct and constructive
```

vs:

```
Preferences: professional conversational detailed examples TypeScript functional direct feedback
```

### 3. Update Regularly

When your context changes:
1. Re-export from UCP
2. Update Claude Project knowledge
3. Or paste updated context in a new conversation

### 4. Version Your Packs

Create dated exports:
- `ucp-context-2026-01.txt`
- `ucp-context-2026-04.txt`

This helps you track changes and revert if needed.

### 5. Use Custom Instructions

Combine your UCP pack with Claude's **Custom Instructions**:

**Project Knowledge**: Detailed facts about you  
**Custom Instructions**: How Claude should behave

Example custom instruction:
```
Always consider my context from the project knowledge.
Adapt your responses to my communication preferences.
Reference my skills and projects when relevant.
```

---

## Example Workflow

### Scenario: Software Engineer Switching from ChatGPT

**Starting point**: 2 years of ChatGPT conversations

**Step 1**: Export ChatGPT data
- Follow [ChatGPT Memory Guide](chatgpt-memory-guide.md)
- Upload `conversations.json` to UCP

**Step 2**: Process in UCP
- Analyze conversation history
- Generate memory tree
- Review and clean nodes (see [Context Management](context-management.md))

**Step 3**: Export for Claude
- Download **Standard** format pack
- File: `my-context-2026-01.txt` (~35K tokens)

**Step 4**: Set up Claude Project
- Create project: "My Engineering Context"
- Upload the UCP pack
- Add custom instruction: "Always reference my projects and preferences"

**Step 5**: Test
Start a conversation:
```
User: "Help me architect a new feature for my SaaS platform"

Claude: "Based on your Universal Context Pack project and your 
expertise in React, TypeScript, and PostgreSQL, I'll suggest 
an architecture that aligns with your functional programming 
preferences..."
```

**Result**: Claude instantly knows:
- Your technical stack (React, TypeScript, PostgreSQL)
- Your preferences (functional programming)
- Your active project (SaaS platform)

---

## Format Conversion Tips

### From ChatGPT Custom Instructions

If you're also migrating ChatGPT custom instructions:

**ChatGPT format**:
```
What would you like ChatGPT to know about you?
I'm a software engineer who...

How would you like ChatGPT to respond?
Be concise and provide examples...
```

**Convert to Claude Project**:
```markdown
# My Profile
I'm a software engineer who...

# Response Preferences
- Be concise
- Provide code examples
- Use TypeScript
```

Then merge with your UCP pack in the Claude Project.

### Combining Multiple Sources

If you have context from multiple places:

1. **UCP Pack** (from ChatGPT history): Core knowledge
2. **Manual notes**: Additional preferences
3. **Project docs**: Specific project context

**Merge strategy**:
```markdown
# USER CONTEXT (from UCP)
[Your UCP export here]

---

# ADDITIONAL PREFERENCES
[Your manual notes here]

---

# PROJECT: Current Focus
[Specific project documentation]
```

---

## Troubleshooting

### "Context Too Large" Error

**Problem**: Pack exceeds Claude's window  
**Solution**:
- Use **Compact** export format (saves ~20% tokens)
- Remove knowledge scopes you don't need for this project
- Split into multiple projects (Work vs Personal)

### Claude Ignores Context

**Problem**: Responses don't reflect your pack  
**Solution**:
- Verify pack is in Project Knowledge (not just pasted in chat)
- Add custom instruction: "Always reference my context from project knowledge"
- Make first message explicit: "Review my context and summarize what you know about me"

### Outdated Information

**Problem**: Pack contains old facts  
**Solution**:
- Update nodes in UCP (see [Context Management](context-management.md))
- Re-export and update Claude Project
- Or add correction in conversation: "Note: I now work at [new company]"

---

## Next Steps

✅ **You're ready to use Claude with your context!**

Explore more:
- [Migration to Gemini](migration-gemini.md) - Try Google's AI
- [Context Management](context-management.md) - Keep context accurate
- [Local Backup](local-backup.md) - Save your pack locally
- [Architecture Guide](architecture-guide.md) - Understand the system

---

**[← Back to Documentation Hub](index.md)**

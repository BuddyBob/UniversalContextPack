"""
Centralized prompt templates for document analysis and memory tree extraction.

This module contains all ChatGPT/OpenAI prompts used in the application,
making it easy to update, test, and maintain prompt engineering.
"""

# ==============================================================================
# CHUNK ANALYSIS PROMPTS
# ==============================================================================

SMALL_DOCUMENT_PROMPT = """
Extract ALL meaningful information from this document with maximum precision.

Rules:
- Do NOT summarize - extract details verbatim
- Do NOT duplicate facts (keep the most explicit version)
- Preserve exact values (names, dates, numbers, URLs, commands)
- Quote short key phrases when precision matters
- Flag ambiguous items

Output format:
1. Document type & purpose (1-2 sentences)
2. Comprehensive extraction (organized bullets by topic)
3. Relationships (if any explicit dependencies exist)

Document:
{chunk}
"""

CONVERSATION_PROMPT = """
# Identity

You are an intelligent conversation analyzer that extracts persistent information about THE USER (the conversation owner).
You are reading chunk {chunk_idx}/{total_chunks} of the complete user's chat extractions.

# Instructions

Rules:
- THE USER is the "I/my/me" speaker. Do not profile people they mention.
- Extract ONLY persistent info (roles, long-term projects, durable preferences, stable constraints, skills, long-term goals).
- No speculation. If unclear, omit.
- No duplicates inside this chunk.

## Identify THE USER

Clues to identify THE USER:
* First-person statements: "I am...", "I work on...", "my background is..."
* The person asking questions or having the conversation
* If helping someone, the helper is the user (not the person being helped)
* If discussing someone, that person is NOT the user

## Extract Persistent Information

Extract information that remains true about THE USER across time:
* Who is THE USER? (roles, identity, profession)
* THE USER's background (skills, interests, experience)
* THE USER's projects (what they're working on)
* THE USER's goals or aspirations
* THE USER's constraints or preferences
* Any other facts about THE USER

Do NOT extract:
* Details about other people (unless directly related to the user)

Focus on extracting comprehensive, factual information about the user.

Conversation content:
{chunk}
"""

MEDIUM_DOCUMENT_PROMPT = """
You are analyzing a medium-length document.
Your goal is to extract condensed but comprehensive key facts from this chunk.

First figure out what this document could be about. Why would a user be interested in storing this document?

Based on that reasoning extract information that would be relevant to that:
- Important claims, data points, definitions, and steps
- Specific arguments or evidence presented
- Entities, roles, timelines, processes, or instructions
- Any meaningful detail that contributes to understanding

Do NOT summarize.
Do NOT generalize.
Preserve nuance and specificity.

Document content:
{chunk}
"""

DEFAULT_DOCUMENT_PROMPT = """
Analyze this document section with high precision.

First figure out what this document could be about. Why would a user be interested in storing this document?

Based on that reasoning extract information that would be relevant to that.
Extract all key factual information:
- Important claims, data points, definitions, and steps
- Specific arguments or evidence presented
- Entities, roles, timelines, processes, or instructions
- Any meaningful detail that contributes to understanding

Do NOT summarize.
Do NOT generalize.
Preserve nuance and specificity.

Document content:
{chunk}
"""

# ==============================================================================
# MEMORY TREE EXTRACTION PROMPTS
# ==============================================================================

KNOWLEDGE_TREE_PROMPT = """
You are turning a chunk of analysis into a structured "memory tree" representation.

The input is a human-readable analysis of a document. Based on this analysis, extract:

- sections: high-level topics or subtopics discussed
- events: concrete events mentioned (with dates or periods if present)
- entities: important people, organizations, or places
- concepts: key ideas, themes, or issues (with definitions)

Return STRICT JSON:

{{
  "sections": [
    {{
      "title": "string",
      "period": null,
      "summary": "string"
    }}
  ],
  "events": [
    {{
      "name": "string",
      "date_or_period": null,
      "summary": "string"
    }}
  ],
  "entities": [
    {{
      "name": "string",
      "type": "person | organization | place | other",
      "summary": "string"
    }}
  ],
  "concepts": [
    {{
      "name": "string",
      "definition": "brief explanation of this concept"
    }}
  ]
}}

Rules:
- Extract as many useful sections/events/entities/concepts as the analysis supports.
- For concepts, provide both name AND definition (not just the name)
- Be specific and detailed.
- Do NOT add commentary outside the JSON.
- Do NOT wrap in backticks or code blocks.
- Return ONLY valid JSON.

Analysis text:
{text}
"""

USER_PROFILE_TREE_PROMPT = """
You are an information extraction system. You will read conversation history and extract ONLY persistent, user-owned information to build a memory profile about THE USER (the owner of the conversations).

YOUR TASK: Figure out who THE USER is, then extract persistent information about them.

STEP 1 - IDENTIFY THE USER:
The USER is the person who OWNS these conversations (the conversation participant, not people they mention).

Clues to identify THE USER:
- First-person statements: "I am...", "I work on...", "my project...", "I'm interested in..."
- Consistent patterns across conversation chunks
- The person HAVING the conversations (not people being discussed)
- Context: If they're helping someone, the helper is the user, not the person being helped

STEP 2 - UNDERSTAND THE USER'S CONTEXT:
What kind of person is the user? Examples:
- Developer working on projects → Extract: projects, tech stack, goals
- Writer creating content → Extract: writing projects, themes, creative work
- Student learning → Extract: subjects, courses, learning goals
- Professional → Extract: role, industry, work patterns
- Researcher → Extract: research topics, methodologies, findings

STEP 3 - EXTRACT INTELLIGENTLY:
Based on who the user is and what matters to them, extract:

- **identity**: User's name (if stated), roles, background that defines them
- **preferences**: Lasting preferences, constraints, or patterns
- **projects**: Ongoing work, creative projects, or efforts (adapt to user type)
- **skills**: Technical skills, expertise, or capabilities
- **goals**: Stated goals, aspirations, or objectives
- **constraints**: Limitations, requirements, or boundaries
- **facts**: Other persistent facts relevant to this user

IMPORTANT PRINCIPLES:
BE ADAPTIVE: A writer's "projects" are essays/books, a developer's are codebases
USE CONTEXT: If user discusses their essay, include it. If they paste someone else's essay, don't.
LOOK FOR PATTERNS: Information appearing across multiple chunks is likely about the user
FIRST-PERSON FOCUS: Prioritize "I/my/me" statements over third-party content
BE RELEVANT: Extract what matters to THIS specific user, not generic categories

Return STRICT JSON:

{{
  "identity": {{
    "name": null,
    "roles": [],
    "background": []
  }},
  "preferences": ["string"],
  "projects": [
    {{
      "name": "string",
      "description": null,
      "status": null
    }}
  ],
  "skills": ["string"],
  "goals": ["string"],
  "constraints": ["string"],
  "facts": ["string"]
}}

Rules:
- Figure out who the user is first, then extract accordingly
- Be adaptive to the user's context (writer, developer, student, etc.)
- Focus on first-person statements and consistent patterns
- Do NOT add commentary
- Do NOT wrap in backticks
- Return ONLY valid JSON

Analysis text:
{text}
"""

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def get_analysis_prompt(
    chunk: str,
    total_chunks: int,
    filename: str,
    chunk_idx: int = 0
) -> str:
    """
    Get the appropriate analysis prompt based on document type and size.
    
    Args:
        chunk: The text chunk to analyze
        total_chunks: Total number of chunks in the document
        filename: Original filename (used to detect conversations)
        chunk_idx: Index of current chunk (0-indexed)
    
    Returns:
        Formatted prompt string
    """
    if total_chunks <= 4:
        return SMALL_DOCUMENT_PROMPT.format(chunk=chunk)
    elif "conversations" in filename.lower():
        return CONVERSATION_PROMPT.format(
            chunk=chunk,
            chunk_idx=chunk_idx + 1,  # 1-indexed for display
            total_chunks=total_chunks
        )
    elif 5 <= total_chunks <= 50:
        return MEDIUM_DOCUMENT_PROMPT.format(chunk=chunk)
    else:
        return DEFAULT_DOCUMENT_PROMPT.format(chunk=chunk)


def get_tree_prompt(scope: str, text: str) -> str:
    """
    Get the appropriate memory tree extraction prompt based on scope.
    
    Args:
        scope: Either "knowledge:..." or "user_profile"
        text: The analyzed text to extract from
    
    Returns:
        Formatted prompt string
    """
    if scope.startswith("knowledge:"):
        return KNOWLEDGE_TREE_PROMPT.format(text=text)
    else:  # user_profile scope
        return USER_PROFILE_TREE_PROMPT.format(text=text)

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

You are an intelligent conversation analyzer that extracts comprehensive, persistent information about THE USER (the conversation owner).
You are reading chunk {chunk_idx}/{total_chunks} of the complete user's chat extractions.

# Instructions

Rules:
- THE USER is the "I/my/me" speaker. Do not profile people they mention.
- Extract ALL persistent information about the user with comprehensive detail
- Include context, examples, and specific details mentioned
- No speculation. If unclear, omit.
- No duplicates inside this chunk.

## Identify THE USER

Clues to identify THE USER:
* First-person statements: "I am...", "I work on...", "my background is..."
* The person asking questions or having the conversation
* If helping someone, the helper is the user (not the person being helped)
* If discussing someone, that person is NOT the user

## Extract Comprehensive Information

Extract ALL information that remains true about THE USER across time:

### 1. Identity & Roles
* Who is THE USER? (roles, identity, profession, job titles)
* Current position, company, or organization
* Professional identity and how they describe themselves

### 2. Background & Experience
* Educational background (degrees, schools, courses)
* Work history and career progression
* Years of experience in various domains
* Past projects or accomplishments mentioned
* Skills and technical expertise (be specific about proficiency levels)
* Languages spoken, certifications, or qualifications

### 3. Active Projects & Work
* Current projects (with names, descriptions, tech stacks, goals)
* Ongoing responsibilities or recurring work
* Side projects, open source contributions, or personal initiatives
* Collaborations or team dynamics
* Project timelines, milestones, or deadlines mentioned

### 4. Technical Knowledge & Tools
* Programming languages and frameworks (with proficiency context)
* Tools, platforms, and technologies they use regularly
* Development practices or methodologies they follow
* Infrastructure, databases, or systems they work with
* Specific libraries, APIs, or services they're familiar with

### 5. Goals & Aspirations
* Career goals (short-term and long-term)
* Learning objectives or skills they want to develop
* Projects they want to build or problems they want to solve
* Professional development plans

### 6. Preferences & Working Style
* Coding preferences or style choices
* Technology preferences (why they prefer certain tools/languages)
* Work environment preferences
* Communication style or collaboration preferences
* Design principles or architectural preferences

### 7. Constraints & Context
* Time constraints or availability
* Technical limitations or requirements
* Budget or resource constraints
* Dependencies on other systems or teams
* Compliance requirements or regulations they work with

### 8. Interests & Domain Knowledge
* Industry focus or domain expertise
* Topics they're passionate about
* Side interests related to their work
* Communities they're part of
* Content they create (blogs, videos, talks)

### 9. Problems & Challenges
* Current challenges or blockers they're facing
* Past problems they've solved
* Common issues they encounter
* Questions they frequently have

### 10. Other Persistent Facts
* Location or timezone (if relevant to work)
* Availability patterns or schedule
* Contact information or handles mentioned
* Notable quotes or philosophy they've shared
* Specific methodologies or approaches they advocate for

IMPORTANT:
- Include specific examples, code snippets, or tool names when mentioned
- Preserve technical details, version numbers, or specific configurations
- Note any context that makes the information more useful
- Extract verbatim key phrases when precision matters
- For each item, include enough detail to be actionable

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
You are an information extraction system. You will read conversation analysis and extract ALL persistent, user-owned information to build a comprehensive memory profile about THE USER.

YOUR TASK: Extract maximum information about THE USER from the analysis provided.

EXTRACTION CATEGORIES:

1. **identity**: Core identity information
   - name: User's actual name (if stated)
   - roles: Job titles, professional roles, positions (be specific)
   - background: Educational background, work history, experience levels

2. **preferences**: Lasting preferences and working style
   - Technology preferences (languages, frameworks, tools) with reasoning
   - Design principles and architectural preferences
   - Working style and collaboration preferences
   - Communication preferences
   - Any stated likes/dislikes that persist

3. **projects**: ALL projects mentioned (ongoing, past, planned)
   - name: Project name or identifier
   - description: Detailed description (tech stack, purpose, features, status)
   - status: Current status (active, completed, planned, paused)
   - Include: code projects, writing projects, research, learning projects, side projects

4. **skills**: Technical and professional capabilities
   - Programming languages (with proficiency context if mentioned)
   - Frameworks and libraries
   - Tools and platforms
   - Methodologies and practices
   - Domain expertise
   - Soft skills

5. **goals**: Aspirations and objectives
   - Career goals (short and long term)
   - Learning objectives
   - Project goals
   - Skill development targets
   - Any stated aspirations

6. **constraints**: Limitations and requirements
   - Time constraints
   - Technical limitations
   - Resource constraints
   - Dependencies
   - Compliance or regulatory requirements
   - Personal boundaries

7. **facts**: ALL other persistent information
   - Work context (company, team, industry)
   - Location or timezone (if relevant)
   - Availability or schedule patterns
   - Communities or groups they're part of
   - Content they create (blogs, talks, videos)
   - Notable accomplishments
   - Challenges they frequently face
   - Tools and technologies they use daily
   - Specific methodologies they follow
   - Philosophies or principles they advocate
   - Any other durable information

EXTRACTION PRINCIPLES:
- MAXIMIZE DETAIL: Extract everything relevant with full context
- BE SPECIFIC: Include version numbers, tool names, specific technologies
- PRESERVE NUANCE: Keep important qualifications and context
- NO DUPLICATION: Within each category, avoid repeating the same info
- ADAPT TO USER: Tailor extraction to what matters for this user
- INCLUDE EXAMPLES: When the analysis includes examples, preserve them
- CONTEXT MATTERS: Extract information that makes other information more useful

Return STRICT JSON:

{{
  "identity": {{
    "name": null,
    "roles": [],
    "background": []
  }},
  "preferences": ["string - be specific and detailed"],
  "projects": [
    {{
      "name": "string",
      "description": "detailed description with tech stack, purpose, key features",
      "status": "active | completed | planned | paused"
    }}
  ],
  "skills": ["string - be specific about proficiency and context"],
  "goals": ["string - include timeframes and context"],
  "constraints": ["string - be specific about what and why"],
  "facts": ["string - any other persistent information with context"]
}}

Rules:
- Extract EVERYTHING relevant from the analysis
- Include full context and details for each item
- Be as comprehensive as possible
- Do NOT add commentary outside JSON
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

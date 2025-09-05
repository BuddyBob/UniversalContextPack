# UCP Compression System - Multi-tier output generation
# This addresses the critical issue where UCPs are too large for LLM context windows

import tiktoken
from typing import Dict, List, Any
import re

class UCPCompressor:
    def __init__(self):
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.tokenizer.encode(text))
    
    def create_ultra_compact_ucp(self, full_analysis: str, target_tokens: int = 50000) -> str:
        """Create ultra-compact version focusing on essential context only"""
        
        ultra_compact_prompt = """Transform this detailed analysis into an ultra-compact Universal Context Pack suitable for LLM context windows (target: ~50k tokens).

EXTRACTION PRIORITIES (in order of importance):
1. Core Identity: Essential personality traits, values, communication style
2. Key Skills: Primary technical abilities and expertise areas
3. Critical Preferences: Must-know likes/dislikes, work style, decision patterns
4. Current Context: Active projects, immediate goals, current situation

COMPRESSION RULES:
- Use bullet points and concise phrases
- Eliminate redundancy and examples
- Focus on actionable insights only
- Preserve unique characteristics
- Remove temporal details unless critical
- Combine similar points
- Use abbreviated technical terms

OUTPUT FORMAT:
# CORE IDENTITY
- [Essential personality and values in bullet points]

# KEY EXPERTISE  
- [Primary skills and knowledge areas]

# CRITICAL PREFERENCES
- [Must-know preferences and work style]

# CURRENT CONTEXT
- [Active projects and immediate goals]

Original analysis to compress:

{full_analysis}

Provide the ultra-compact UCP below:"""

        return ultra_compact_prompt.format(full_analysis=full_analysis)
    
    def create_standard_ucp(self, full_analysis: str, target_tokens: int = 100000) -> str:
        """Create standard version with balanced detail"""
        
        standard_prompt = """Transform this detailed analysis into a standard Universal Context Pack (target: ~100k tokens).

RETENTION PRIORITIES:
1. Complete personality profile with key examples
2. Comprehensive skill mapping with proficiency levels  
3. Detailed preferences and behavioral patterns
4. Project patterns with specific examples
5. Key relationship and interaction insights
6. Important timeline/evolution data

OPTIMIZATION RULES:
- Keep essential examples but reduce repetitive ones
- Maintain depth but improve conciseness
- Preserve nuanced insights
- Remove excessive detail in less critical areas
- Keep technical specificity
- Maintain actionable insights

OUTPUT FORMAT: Use the same 6-category structure but with optimized content length.

Original analysis to compress:

{full_analysis}

Provide the standard UCP below:"""

        return standard_prompt.format(full_analysis=full_analysis)
    
    def chunk_ucp_for_context_window(self, ucp_content: str, max_tokens: int = 90000) -> List[Dict[str, Any]]:
        """Split UCP into chunks that fit within context windows"""
        
        # Split by major sections
        sections = re.split(r'\n(?=# [A-Z])', ucp_content)
        chunks = []
        current_chunk = ""
        current_tokens = 0
        chunk_num = 1
        
        header = f"""# UNIVERSAL CONTEXT PACK - PART {{chunk_num}}

This is part {{chunk_num}} of your Universal Context Pack. Use this information to understand the user's background, preferences, and context.

USAGE INSTRUCTIONS:
- This context provides essential information about the user
- Apply this knowledge to all interactions 
- Refer to specific details when relevant
- Maintain consistency with established preferences

"""
        
        for section in sections:
            section_tokens = self.count_tokens(section)
            header_tokens = self.count_tokens(header.format(chunk_num=chunk_num))
            
            if current_tokens + section_tokens + header_tokens > max_tokens and current_chunk:
                # Save current chunk
                chunks.append({
                    "chunk_number": chunk_num,
                    "content": header.format(chunk_num=chunk_num) + current_chunk,
                    "token_count": current_tokens + header_tokens,
                    "sections_included": current_chunk.count("# ")
                })
                
                # Start new chunk
                chunk_num += 1
                current_chunk = section
                current_tokens = section_tokens
            else:
                current_chunk += "\n" + section if current_chunk else section
                current_tokens += section_tokens
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "chunk_number": chunk_num,
                "content": header.format(chunk_num=chunk_num) + current_chunk,
                "token_count": current_tokens + self.count_tokens(header.format(chunk_num=chunk_num)),
                "sections_included": current_chunk.count("# ")
            })
        
        return chunks

def get_compression_options() -> Dict[str, Dict[str, Any]]:
    """Return available UCP compression options"""
    return {
        "ultra_compact": {
            "name": "Ultra-Compact UCP",
            "target_tokens": 50000,
            "description": "Essential context only - fits in any LLM",
            "best_for": "Quick context transfer, limited token budgets",
            "features": ["Core personality", "Key skills", "Critical preferences", "Current context"]
        },
        "standard": {
            "name": "Standard UCP", 
            "target_tokens": 100000,
            "description": "Balanced detail - works with most LLMs",
            "best_for": "General use, good balance of detail and size",
            "features": ["Complete personality", "Detailed skills", "Behavioral patterns", "Project insights"]
        },
        "complete": {
            "name": "Complete UCP",
            "target_tokens": 280000,
            "description": "Full analysis - may need chunking",
            "best_for": "Comprehensive context, research purposes",
            "features": ["Everything included", "Full examples", "Complete timeline", "All insights"]
        },
        "chunked": {
            "name": "Chunked UCP",
            "target_tokens": 90000,
            "description": "Complete UCP split into manageable pieces", 
            "best_for": "When you need full detail but have context limits",
            "features": ["Complete analysis", "Context-window sized", "Sequential parts", "Easy to use"]
        }
    }

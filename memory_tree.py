"""
Memory Tree Module - Structured Knowledge Storage for Context Packs
====================================================================

This module provides the core functionality for the Memory Tree system, which stores
structured knowledge facts as nodes in a graph instead of concatenated text.

Key Features:
- Scope-based organization (user_profile, knowledge:topic)
- Node types (Identity, Preference, Project, Section, Event, etc.)
- Evidence tracking (links facts to source chunks)
- Flexible JSON data storage per node
- Automatic node merging for duplicate facts

Usage:
    from memory_tree import apply_chunk_to_memory_tree, export_pack_from_tree
    
    # During analysis:
    apply_chunk_to_memory_tree(
        structured_facts=json_data,
        scope="user_profile",
        user=authenticated_user,
        pack_id="pack-123",
        source_id="src-456",
        chunk_index=0
    )
    
    # For export:
    pack_text = export_pack_from_tree(user_id, pack_id)
"""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

# DON'T import from simple_backend at module level (causes circular import)
# Instead, import when needed inside functions
supabase = None
AuthenticatedUser = None

def _ensure_supabase():
    """Lazy load supabase client to avoid circular import"""
    global supabase
    if supabase is None:
        try:
            from simple_backend import supabase as sb
            supabase = sb
        except ImportError:
            pass
    return supabase



# ============================================================================
# SCOPE DETECTION
# ============================================================================

def get_scope_for_source(source_id: str, filename: str, source_type: str) -> str:
    """
    Determine the memory tree scope based on source metadata.
    
    Args:
        source_id: Source identifier
        filename: Original filename
        source_type: Type of source (chat_export, document, url, text)
    
    Returns:
        Scope string (e.g., 'user_profile', 'knowledge:book_name')
    """
    
    # Chat exports and conversation files → user_profile scope
    if source_type == "chat_export":
        return "user_profile"
    
    if filename and ("conversations" in filename.lower() or filename.lower().endswith('.json')):
        return "user_profile"
    
    # Documents and other sources → knowledge scope with topic name
    if filename:
        # Extract base name without extension
        base_name = filename.rsplit('.', 1)[0]
        # Clean up name (lowercase, replace spaces with underscores)
        topic = base_name.lower().replace(' ', '_').replace('-', '_')
        # Limit length
        topic = topic[:50]
        scope = f"knowledge:{topic}"
        return scope
    
    # Fallback for sources without clear filenames
    return "knowledge:generic"


# ============================================================================
# NODE OPERATIONS
# ============================================================================

def get_or_create_node(
    user_id: str,
    pack_id: str,
    scope: str,
    node_type: str,
    label: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get an existing node or create a new one if it doesn't exist.
    
    Nodes are matched by: user_id + pack_id + scope + node_type + label
    
    Args:
        user_id: User UUID
        pack_id: Pack identifier
        scope: Memory scope (e.g., 'user_profile')
        node_type: Type of node (e.g., 'Identity', 'Preference')
        label: Optional human-readable label
    
    Returns:
        Node dictionary with id, user_id, pack_id, scope, node_type, label, data
    """
    sb = _ensure_supabase()
    if not sb:
        raise Exception("Supabase client not initialized")
    
    print(f"   🔎 [NODE] Looking for {node_type} node: {label or '(no label)'}")
    
    # Query for existing node
    query = sb.table("memory_nodes").select("*") \
        .eq("user_id", user_id) \
        .eq("scope", scope) \
        .eq("node_type", node_type)
    
    if pack_id:
        query = query.eq("pack_id", pack_id)
    
    if label:
        query = query.eq("label", label)
    else:
        query = query.is_("label", "null")
    
    result = query.limit(1).execute()
    
    # If node exists, return it
    if result.data and len(result.data) > 0:
        node_id = result.data[0]['id']
        return result.data[0]
    
    # Otherwise, create new node
    new_node = {
        "user_id": user_id,
        "pack_id": pack_id,
        "scope": scope,
        "node_type": node_type,
        "label": label,
        "data": {}
    }
    
    insert_result = sb.table("memory_nodes").insert(new_node).execute()
    
    if insert_result.data and len(insert_result.data) > 0:
        node_id = insert_result.data[0]['id']
        return insert_result.data[0]
    
    raise Exception(f"Failed to create node: {node_type} in {scope}")


def merge_node_data(node_id: str, new_data: Dict[str, Any]) -> None:
    """
    Merge new data into an existing node.
    
    Merging rules:
    - For list fields: union by value (no duplicates)
    - For scalar fields: new value overwrites old (latest wins)
    - For dict fields: deep merge
    
    Args:
        node_id: UUID of the node to update
        new_data: New data to merge
    """
    sb = _ensure_supabase()
    if not sb:
        raise Exception("Supabase client not initialized")
    
    # Get current node data
    result = sb.table("memory_nodes").select("data").eq("id", node_id).single().execute()
    
    if not result.data:
        raise Exception(f"Node {node_id} not found")
    
    current_data = result.data.get("data", {})
    
    # Merge logic
    merged_data = {}
    all_keys = set(current_data.keys()) | set(new_data.keys())
    merge_operations = []
    
    for key in all_keys:
        old_value = current_data.get(key)
        new_value = new_data.get(key)
        
        # If only one exists, use it
        if old_value is None:
            merged_data[key] = new_value
            merge_operations.append(f"{key}: added")
        elif new_value is None:
            merged_data[key] = old_value
        # Both exist - merge based on type
        elif isinstance(old_value, list) and isinstance(new_value, list):
            # Union of lists (remove duplicates)
            merged_data[key] = list(set(old_value + new_value))
            merge_operations.append(f"{key}: merged {len(new_value)} items")
        elif isinstance(old_value, dict) and isinstance(new_value, dict):
            # Deep merge dicts
            merged_data[key] = {**old_value, **new_value}
            merge_operations.append(f"{key}: deep merged")
        else:
            # Scalar: new value wins
            merged_data[key] = new_value
            merge_operations.append(f"{key}: updated")
    
    # Update node
    sb.table("memory_nodes") \
        .update({"data": merged_data, "updated_at": datetime.utcnow().isoformat()}) \
        .eq("id", node_id) \
        .execute()
    


def create_evidence(
    user_id: str,
    node_id: str,
    pack_id: Optional[str] = None,
    source_id: Optional[str] = None,
    chunk_index: Optional[int] = None,
    snippet: Optional[str] = None
) -> str:
    """
    Create an evidence record linking a node to a source chunk.
    
    Args:
        user_id: User UUID
        node_id: Node UUID this evidence supports
        pack_id: Pack identifier (optional)
        source_id: Source identifier (optional)
        chunk_index: Chunk number in the source (optional)
        snippet: Short text excerpt (optional)
    
    Returns:
        Evidence UUID
    """
    sb = _ensure_supabase()
    if not sb:
        raise Exception("Supabase client not initialized")
    
    evidence = {
        "user_id": user_id,
        "node_id": node_id,
        "pack_id": pack_id,
        "source_id": source_id,
        "chunk_index": chunk_index,
        "snippet": snippet[:250] if snippet else None  # Limit snippet length
    }
    
    result = sb.table("memory_evidence").insert(evidence).execute()
    
    if result.data and len(result.data) > 0:
        evidence_id = result.data[0]["id"]
        return evidence_id
    
    raise Exception("Failed to create evidence record")


# ============================================================================
# HIGH-LEVEL APPLICATION FUNCTIONS
# ============================================================================

def apply_chunk_to_memory_tree(
    structured_facts: Dict[str, Any],
    scope: str,
    user: Any,  # AuthenticatedUser instance
    pack_id: str,
    source_id: str,
    chunk_index: int
) -> None:
    """
    Apply structured facts from a chunk to the memory tree.
    
    Args:
        structured_facts: JSON object with extracted facts
        scope: Memory scope ('user_profile' or 'knowledge:topic')
        user: Authenticated user object
        pack_id: Pack identifier
        source_id: Source identifier
        chunk_index: Chunk number
    """
    user_id = user.user_id
    

    
    # Route based on scope
    if scope == "user_profile":
        _apply_user_profile_facts(structured_facts, user_id, pack_id, source_id, chunk_index)
    elif scope.startswith("knowledge:"):
        _apply_knowledge_facts(structured_facts, user_id, pack_id, source_id, chunk_index, scope)


def _apply_user_profile_facts(
    facts: Dict[str, Any],
    user_id: str,
    pack_id: str,
    source_id: str,
    chunk_index: int
) -> None:
    """Apply user_profile scope facts (identity, preferences, projects, etc.)"""
    
    nodes_created = 0
    nodes_updated = 0
    
    # Identity node (single)
    identity_data = facts.get("identity")
    if identity_data and any(identity_data.values()):
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope="user_profile",
            node_type="Identity",
            label="User Identity"
        )
        merge_node_data(node["id"], identity_data)
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=json.dumps(identity_data)[:250]
        )
    
    # Preferences (multiple)
    for pref in facts.get("preferences", []):
        if not pref or not isinstance(pref, str):
            continue
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope="user_profile",
            node_type="Preference",
            label=pref[:120]
        )
        merge_node_data(node["id"], {"text": pref})
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=pref[:250]
        )
    
    # Projects (multiple)
    for proj in facts.get("projects", []):
        if not proj or not isinstance(proj, dict):
            continue
        name = proj.get("name", "Unnamed Project")
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope="user_profile",
            node_type="Project",
            label=name[:120]
        )
        merge_node_data(node["id"], proj)
        snippet = proj.get("description", json.dumps(proj))[:250]
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=snippet
        )
    
    # Skills, Goals, Constraints, Facts (similar pattern)
    for field_name in ["skills", "goals", "constraints", "facts"]:
        items = facts.get(field_name, [])
        if not isinstance(items, list):
            continue
        
        item_count = 0
        for item in items:
            if not item or not isinstance(item, str):
                continue
            
            node = get_or_create_node(
                user_id=user_id,
                pack_id=pack_id,
                scope="user_profile",
                node_type=field_name.capitalize()[:-1],  # "skills" → "Skill"
                label=item[:120]
            )
            merge_node_data(node["id"], {"text": item})
            create_evidence(
                user_id=user_id,
                node_id=node["id"],
                pack_id=pack_id,
                source_id=source_id,
                chunk_index=chunk_index,
                snippet=item[:250]
            )
            item_count += 1
        
        if item_count > 0:
            nodes_created += item_count
    
    print(f"\n   🎉 USER PROFILE SUMMARY: {nodes_created} nodes processed")


def _apply_knowledge_facts(
    facts: Dict[str, Any],
    user_id: str,
    pack_id: str,
    source_id: str,
    chunk_index: int,
    scope: str
) -> None:
    """Apply knowledge scope facts (sections, events, entities, concepts)"""
    
    nodes_created = 0
    
    # Sections
    for section in facts.get("sections", []):
        if not section or not isinstance(section, dict):
            continue
        title = section.get("title", "Untitled Section")
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope=scope,
            node_type="Section",
            label=title[:120]
        )
        merge_node_data(node["id"], section)
        snippet = section.get("summary", json.dumps(section))[:250]
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=snippet
        )
    
    # Events
    for event in facts.get("events", []):
        if not event or not isinstance(event, dict):
            continue
        name = event.get("name", "Unnamed Event")
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope=scope,
            node_type="Event",
            label=name[:120]
        )
        merge_node_data(node["id"], event)
        snippet = event.get("summary", json.dumps(event))[:250]
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=snippet
        )
    
    # Entities
    for entity in facts.get("entities", []):
        if not entity or not isinstance(entity, dict):
            continue
        name = entity.get("name", "Unnamed Entity")
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope=scope,
            node_type="Entity",
            label=name[:120]
        )
        merge_node_data(node["id"], entity)
        snippet = entity.get("summary", json.dumps(entity))[:250]
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=snippet
        )
    
    # Concepts (can be simple strings or rich objects)
    concept_count = 0
    for concept in facts.get("concepts", []):
        if not concept:
            continue
        
        if isinstance(concept, str):
            # Simple string concept
            node = get_or_create_node(
                user_id=user_id,
                pack_id=pack_id,
                scope=scope,
                node_type="Concept",
                label=concept[:120]
            )
            merge_node_data(node["id"], {"text": concept})
            create_evidence(
                user_id=user_id,
                node_id=node["id"],
                pack_id=pack_id,
                source_id=source_id,
                chunk_index=chunk_index,
                snippet=concept[:250]
            )
            concept_count += 1
        elif isinstance(concept, dict):
            # Rich concept with name, definition, category
            name = concept.get("name", "Unnamed Concept")
            node = get_or_create_node(
                user_id=user_id,
                pack_id=pack_id,
                scope=scope,
                node_type="Concept",
                label=name[:120]
            )
            merge_node_data(node["id"], concept)
            snippet = concept.get("definition", json.dumps(concept))[:250]
            create_evidence(
                user_id=user_id,
                node_id=node["id"],
                pack_id=pack_id,
                source_id=source_id,
                chunk_index=chunk_index,
                snippet=snippet
            )
            concept_count += 1
    
    if concept_count > 0:
        nodes_created += concept_count
    
    # Facts (for knowledge conversations)
    fact_count = 0
    for fact in facts.get("facts", []):
        if not fact:
            continue
        
        if isinstance(fact, str):
            # Simple string fact
            node = get_or_create_node(
                user_id=user_id,
                pack_id=pack_id,
                scope=scope,
                node_type="Fact",
                label=fact[:120]
            )
            merge_node_data(node["id"], {"text": fact})
            create_evidence(
                user_id=user_id,
                node_id=node["id"],
                pack_id=pack_id,
                source_id=source_id,
                chunk_index=chunk_index,
                snippet=fact[:250]
            )
            fact_count += 1
        elif isinstance(fact, dict):
            # Rich fact with statement and category
            statement = fact.get("statement", "")
            if statement:
                node = get_or_create_node(
                    user_id=user_id,
                    pack_id=pack_id,
                    scope=scope,
                    node_type="Fact",
                    label=statement[:120]
                )
                merge_node_data(node["id"], fact)
                create_evidence(
                    user_id=user_id,
                    node_id=node["id"],
                    pack_id=pack_id,
                    source_id=source_id,
                    chunk_index=chunk_index,
                    snippet=statement[:250]
                )
                fact_count += 1
    
    if fact_count > 0:
        nodes_created += fact_count
    
    # Code patterns (for technical conversations)
    pattern_count = 0
    for pattern in facts.get("code_patterns", []):
        if not pattern or not isinstance(pattern, dict):
            continue
        
        purpose = pattern.get("purpose", "Code Pattern")
        node = get_or_create_node(
            user_id=user_id,
            pack_id=pack_id,
            scope=scope,
            node_type="CodePattern",
            label=purpose[:120]
        )
        merge_node_data(node["id"], pattern)
        snippet = pattern.get("pattern", json.dumps(pattern))[:250]
        create_evidence(
            user_id=user_id,
            node_id=node["id"],
            pack_id=pack_id,
            source_id=source_id,
            chunk_index=chunk_index,
            snippet=snippet
        )
        pattern_count += 1
    
    if pattern_count > 0:
        nodes_created += pattern_count
    
    print(f"\n   🎉 KNOWLEDGE SUMMARY: {nodes_created} nodes processed for {scope}")



# ============================================================================
# EXPORT FUNCTIONALITY
# ============================================================================

def export_pack_from_tree(user_id: str, pack_id: str) -> str:
    """
    Generate a context pack from the memory tree.
    
    This queries all nodes for the pack and formats them into readable text.
    
    Args:
        user_id: User UUID
        pack_id: Pack identifier
    
    Returns:
        Formatted pack text
    """
    sb = _ensure_supabase()
    if not sb:
        raise Exception("Supabase client not initialized")
    
    # Query all nodes for this pack
    result = sb.table("memory_nodes") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("pack_id", pack_id) \
        .order("scope", desc=False) \
        .order("node_type", desc=False) \
        .order("created_at", desc=False) \
        .execute()
    
    if not result.data:
        return "# Context Pack\n\n(No data in memory tree yet)"
    
    nodes = result.data
    
    # Group nodes by scope
    scopes = {}
    for node in nodes:
        scope = node["scope"]
        if scope not in scopes:
            scopes[scope] = []
        scopes[scope].append(node)
    
    # Build pack text
    pack_text = "# USER CONTEXT PACK\n\n"
    pack_text += f"*Generated from Memory Tree on {datetime.utcnow().strftime('%Y-%m-%d')}*\n\n"
    pack_text += "---\n\n"
    
    # Format user_profile scope first
    if "user_profile" in scopes:
        pack_text += "## USER PROFILE\n\n"
        pack_text += _format_user_profile(scopes["user_profile"])
        pack_text += "\n---\n\n"
    
    # Format knowledge scopes
    knowledge_scopes = {k: v for k, v in scopes.items() if k.startswith("knowledge:")}
    for scope_name, scope_nodes in knowledge_scopes.items():
        topic = scope_name.replace("knowledge:", "").replace("_", " ").title()
        pack_text += f"## KNOWLEDGE: {topic}\n\n"
        pack_text += _format_knowledge_scope(scope_nodes)
        pack_text += "\n---\n\n"
    
    return pack_text


def _format_user_profile(nodes: List[Dict[str, Any]]) -> str:
    """Format user_profile scope nodes"""
    text = ""
    
    # Group by node_type
    by_type = {}
    for node in nodes:
        node_type = node["node_type"]
        if node_type not in by_type:
            by_type[node_type] = []
        by_type[node_type].append(node)
    
    # Identity
    if "Identity" in by_type:
        text += "### Identity\n\n"
        for node in by_type["Identity"]:
            data = node.get("data", {})
            if data.get("name"):
                text += f"**Name:** {data['name']}\n\n"
            if data.get("roles"):
                text += f"**Roles:** {', '.join(data['roles'])}\n\n"
            if data.get("background"):
                text += f"**Background:**\n"
                for bg in data["background"]:
                    text += f"- {bg}\n"
                text += "\n"
    
    # Preferences
    if "Preference" in by_type:
        text += "### Preferences\n\n"
        for node in by_type["Preference"]:
            text += f"- {node.get('label', node.get('data', {}).get('text', ''))}\n"
        text += "\n"
    
    # Projects
    if "Project" in by_type:
        text += "### Projects\n\n"
        for node in by_type["Project"]:
            data = node.get("data", {})
            text += f"**{node.get('label', 'Unnamed Project')}**\n"
            if data.get("description"):
                text += f"{data['description']}\n"
            if data.get("status"):
                text += f"*Status: {data['status']}*\n"
            text += "\n"
    
    # Skills, Goals, Constraints (simple lists)
    for field in ["Skill", "Goal", "Constraint", "Fact"]:
        if field in by_type:
            text += f"### {field}s\n\n"
            for node in by_type[field]:
                text += f"- {node.get('label', node.get('data', {}).get('text', ''))}\n"
            text += "\n"
    
    return text


def _format_knowledge_scope(nodes: List[Dict[str, Any]]) -> str:
    """Format knowledge scope nodes"""
    text = ""
    
    # Group by node_type
    by_type = {}
    for node in nodes:
        node_type = node["node_type"]
        if node_type not in by_type:
            by_type[node_type] = []
        by_type[node_type].append(node)
    
    # Sections
    if "Section" in by_type:
        text += "### Sections\n\n"
        for node in by_type["Section"]:
            data = node.get("data", {})
            text += f"**{node.get('label', 'Untitled')}**\n"
            if data.get("summary"):
                text += f"{data['summary']}\n"
            text += "\n"
    
    # Events
    if "Event" in by_type:
        text += "### Events\n\n"
        for node in by_type["Event"]:
            data = node.get("data", {})
            text += f"**{node.get('label', 'Unnamed Event')}**"
            if data.get("date_or_period"):
                text += f" ({data['date_or_period']})"
            text += "\n"
            if data.get("summary"):
                text += f"{data['summary']}\n"
            text += "\n"
    
    # Entities
    if "Entity" in by_type:
        text += "### Entities\n\n"
        for node in by_type["Entity"]:
            data = node.get("data", {})
            entity_type = data.get("type", "unknown")
            text += f"**{node.get('label', 'Unnamed')}** ({entity_type})\n"
            if data.get("summary"):
                text += f"{data['summary']}\n"
            text += "\n"
    
    # Concepts
    if "Concept" in by_type:
        text += "### Concepts\n\n"
        for node in by_type["Concept"]:
            text += f"- {node.get('label', node.get('data', {}).get('text', ''))}\n"
        text += "\n"
    
    return text

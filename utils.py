"""
Utility functions for progress tracking, logging, and common operations.
"""

import logging
import json
from datetime import datetime
from typing import Optional


# Configure structured logger
logger = logging.getLogger(__name__)


def get_progress_message(
    stage: str,
    current: int,
    total: int,
    extra: str = ""
) -> str:
    """
    Generate detailed progress messages for different processing stages.
    
    Args:
        stage: Processing stage (extracting, chunking, analyzing, tree)
        current: Current progress count
        total: Total items to process
        extra: Optional extra context (e.g., token counts)
    
    Returns:
        Human-readable progress message
    """
    messages = {
        "extracting": f"Extracting text... {current}/{total} pages",
        "chunking": f"Creating chunks... {current}/{total} chars processed",
        "analyzing": f"AI analysis... {current}/{total} chunks" + (f" ({extra})" if extra else ""),
        "tree": f"Building memory tree... {current}/{total} chunks",
        "processing": f"Processing... {current}/{total}" + (f" ({extra})" if extra else "")
    }
    return messages.get(stage, f"{stage}: {current}/{total}")


def log_chunk_analysis(
    chunk_idx: int,
    tokens_in: int,
    tokens_out: int,
    success: bool,
    cost: Optional[float] = None,
    error: Optional[str] = None
) -> None:
    """
    Log chunk analysis in structured JSON format for easy parsing.
    
    Args:
        chunk_idx: Index of the chunk
        tokens_in: Input tokens used
        tokens_out: Output tokens generated
        success: Whether analysis succeeded
        cost: Optional cost in USD
        error: Optional error message if failed
    """
    log_data = {
        "event": "chunk_analyzed",
        "chunk_idx": chunk_idx,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "success": success,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if cost is not None:
        log_data["cost_usd"] = cost
    
    if error:
        log_data["error"] = error
    
    logger.info(json.dumps(log_data))


def log_source_processing(
    source_id: str,
    stage: str,
    status: str,
    chunks_processed: Optional[int] = None,
    total_chunks: Optional[int] = None,
    error: Optional[str] = None
) -> None:
    """
    Log source processing events in structured format.
    
    Args:
        source_id: ID of the source being processed
        stage: Processing stage (extraction, analysis, tree)
        status: Status (started, in_progress, completed, failed)
        chunks_processed: Number of chunks processed
        total_chunks: Total chunks in source
        error: Optional error message
    """
    log_data = {
        "event": "source_processing",
        "source_id": source_id,
        "stage": stage,
        "status": status,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if chunks_processed is not None:
        log_data["chunks_processed"] = chunks_processed
    
    if total_chunks is not None:
        log_data["total_chunks"] = total_chunks
    
    if error:
        log_data["error"] = error
    
    if status == "failed":
        logger.error(json.dumps(log_data))
    else:
        logger.info(json.dumps(log_data))


def calculate_progress_percent(current: int, total: int, min_percent: int = 0, max_percent: int = 100) -> int:
    """
    Calculate progress percentage with bounds.
    
    Args:
        current: Current progress
        total: Total items
        min_percent: Minimum percentage to return
        max_percent: Maximum percentage to return
    
    Returns:
        Progress percentage clamped to [min_percent, max_percent]
    """
    if total == 0:
        return max_percent
    
    percent = int((current / total) * 100)
    return max(min_percent, min(max_percent, percent))

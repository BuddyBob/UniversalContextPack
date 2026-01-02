"""
Custom exception classes for better error handling and debugging.

This module provides structured error types that make it easier to
handle different failure scenarios appropriately.
"""


class ChunkProcessingError(Exception):
    """Base exception for chunk processing failures."""
    
    def __init__(self, chunk_idx: int, reason: str, recoverable: bool = True):
        """
        Initialize chunk processing error.
        
        Args:
            chunk_idx: Index of the chunk that failed (0-indexed)
            reason: Human-readable explanation of the failure
            recoverable: Whether retrying might succeed
        """
        self.chunk_idx = chunk_idx
        self.reason = reason
        self.recoverable = recoverable
        super().__init__(f"Chunk {chunk_idx + 1} failed: {reason}")


class ContentPolicyError(ChunkProcessingError):
    """Exception for content policy violations (non-recoverable)."""
    
    def __init__(self, chunk_idx: int):
        """
        Initialize content policy error.
        
        Args:
            chunk_idx: Index of the chunk that violated policy
        """
        super().__init__(
            chunk_idx=chunk_idx,
            reason="Content policy violation",
            recoverable=False
        )


class TokenLimitError(ChunkProcessingError):
    """Exception for token limit exceeded (potentially recoverable with smaller chunks)."""
    
    def __init__(self, chunk_idx: int, token_count: int, max_tokens: int):
        """
        Initialize token limit error.
        
        Args:
            chunk_idx: Index of the chunk that exceeded limits
            token_count: Actual token count
            max_tokens: Maximum allowed tokens
        """
        self.token_count = token_count
        self.max_tokens = max_tokens
        super().__init__(
            chunk_idx=chunk_idx,
            reason=f"Token limit exceeded: {token_count} > {max_tokens}",
            recoverable=True
        )


class ExtractionError(Exception):
    """Exception for text extraction failures."""
    
    def __init__(self, source_id: str, reason: str):
        """
        Initialize extraction error.
        
        Args:
            source_id: ID of the source that failed extraction
            reason: Human-readable explanation
        """
        self.source_id = source_id
        self.reason = reason
        super().__init__(f"Extraction failed for {source_id}: {reason}")


class TreeBuildError(Exception):
    """Exception for memory tree building failures."""
    
    def __init__(self, source_id: str, chunk_idx: int, reason: str):
        """
        Initialize tree build error.
        
        Args:
            source_id: ID of the source being processed
            chunk_idx: Index of the chunk that failed
            reason: Human-readable explanation
        """
        self.source_id = source_id
        self.chunk_idx = chunk_idx
        self.reason = reason
        super().__init__(
            f"Tree building failed for {source_id} chunk {chunk_idx + 1}: {reason}"
        )

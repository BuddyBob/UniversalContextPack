"""
Dynamic Time Estimation System for UCP Analysis
Provides real-time estimates for extraction and analysis based on historical data
"""
from typing import Dict, Tuple
import math

class UCPTimeEstimator:
    def __init__(self):
        # Historical averages from timing data analysis
        self.EXTRACTION_RATE_MB_PER_SEC = 2.3  # MB/s based on real data
        self.ANALYSIS_RATE_TOKENS_PER_SEC = 3400  # tokens/s average
        self.AVG_TOKENS_PER_CHUNK = 150000  # ~150k tokens per chunk
        self.CHUNK_OVERHEAD_SECONDS = 5  # API calls, processing overhead per chunk
        
    def estimate_extraction_time(self, file_size_bytes: int) -> Dict:
        """
        Estimate extraction time based on file size
        Returns time in seconds and formatted string
        """
        file_size_mb = file_size_bytes / (1024 * 1024)
        estimated_seconds = file_size_mb / self.EXTRACTION_RATE_MB_PER_SEC
        
        # Add some overhead for processing
        estimated_seconds *= 1.2  # 20% buffer for processing overhead
        
        return {
            "seconds": estimated_seconds,
            "formatted": self._format_time(estimated_seconds),
            "file_size_mb": file_size_mb
        }
    
    def estimate_chunking_time(self, text_length_chars: int) -> Dict:
        """
        Estimate chunking time based on extracted text length
        Chunking is relatively fast - mainly text processing
        """
        # Rough estimate: 1MB of text = ~1 second of chunking
        text_size_mb = text_length_chars / (1024 * 1024)
        estimated_seconds = text_size_mb * 1.5  # 1.5 seconds per MB
        
        # Minimum 2 seconds, maximum reasonable time
        estimated_seconds = max(2, min(estimated_seconds, 300))  # 2s to 5min max
        
        # Estimate chunks from text length
        estimated_tokens = text_length_chars * 0.25  # rough chars to tokens
        estimated_chunks = math.ceil(estimated_tokens / self.AVG_TOKENS_PER_CHUNK)
        
        return {
            "seconds": estimated_seconds,
            "formatted": self._format_time(estimated_seconds),
            "estimated_chunks": estimated_chunks,
            "text_size_mb": text_size_mb
        }

    def estimate_analysis_time(self, num_chunks: int, chunk_size_tokens: int = None) -> Dict:
        """
        Estimate analysis time based on number of chunks and token count
        """
        if chunk_size_tokens is None:
            chunk_size_tokens = self.AVG_TOKENS_PER_CHUNK
            
        # Time per chunk = (tokens / rate) + overhead
        time_per_chunk = (chunk_size_tokens / self.ANALYSIS_RATE_TOKENS_PER_SEC) + self.CHUNK_OVERHEAD_SECONDS
        total_seconds = time_per_chunk * num_chunks
        
        return {
            "seconds": total_seconds,
            "formatted": self._format_time(total_seconds),
            "time_per_chunk": time_per_chunk,
            "chunks": num_chunks
        }
    
    def estimate_total_tokens(self, file_size_bytes: int) -> int:
        """
        Estimate total tokens based on file size
        Rough approximation: 1MB ≈ 250k tokens for conversation data
        """
        file_size_mb = file_size_bytes / (1024 * 1024)
        estimated_tokens = file_size_mb * 250000  # 250k tokens per MB
        return int(estimated_tokens)
    
    def estimate_total_chunks(self, file_size_bytes: int) -> int:
        """
        Estimate number of chunks that will be created
        """
        total_tokens = self.estimate_total_tokens(file_size_bytes)
        estimated_chunks = math.ceil(total_tokens / self.AVG_TOKENS_PER_CHUNK)
        return estimated_chunks
    
    def get_full_estimate(self, file_size_bytes: int, chunks_to_analyze: int = None) -> Dict:
        """
        Get comprehensive time estimates for the entire process
        """
        extraction = self.estimate_extraction_time(file_size_bytes)
        total_chunks = self.estimate_total_chunks(file_size_bytes)
        
        # If no specific chunk count provided, use all chunks
        if chunks_to_analyze is None:
            chunks_to_analyze = total_chunks
            
        analysis = self.estimate_analysis_time(chunks_to_analyze)
        
        total_seconds = extraction["seconds"] + analysis["seconds"]
        
        return {
            "extraction": extraction,
            "analysis": analysis,
            "total": {
                "seconds": total_seconds,
                "formatted": self._format_time(total_seconds)
            },
            "file_info": {
                "size_mb": extraction["file_size_mb"],
                "estimated_total_chunks": total_chunks,
                "chunks_to_analyze": chunks_to_analyze
            }
        }
    
    def _format_time(self, seconds: float) -> str:
        """
        Format seconds into human-readable time
        """
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            remaining_seconds = int(seconds % 60)
            if remaining_seconds == 0:
                return f"{minutes}m"
            else:
                return f"{minutes}m {remaining_seconds}s"
        else:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"

# Global estimator instance
time_estimator = UCPTimeEstimator()

def get_time_estimates(file_size_bytes: int, chunks_to_analyze: int = None) -> Dict:
    """
    Convenience function to get time estimates
    """
    return time_estimator.get_full_estimate(file_size_bytes, chunks_to_analyze)

# Example usage and testing
if __name__ == "__main__":
    # Test with your real file sizes
    test_files = [
        (106011662, "conversations.json (101MB)"),  # Your large file
        (2382757, "chunk_018.txt (2.3MB)"),        # Your smaller file
        (50000000, "Medium file (50MB)"),
        (10000000, "Small file (10MB)")
    ]
    
    print("🕒 UCP Time Estimation Examples")
    print("=" * 60)
    
    for file_size, description in test_files:
        estimates = get_time_estimates(file_size)
        
        print(f"\n📁 {description}")
        print(f"   File size: {estimates['file_info']['size_mb']:.1f} MB")
        print(f"   Estimated chunks: {estimates['file_info']['estimated_total_chunks']}")
        print(f"   📤 Extraction: {estimates['extraction']['formatted']}")
        print(f"   🤖 Analysis (all chunks): {estimates['analysis']['formatted']}")
        print(f"   ⏱️  Total time: {estimates['total']['formatted']}")
        
        # Show estimate for partial analysis
        if estimates['file_info']['estimated_total_chunks'] > 5:
            partial = get_time_estimates(file_size, 5)
            print(f"   🎯 Analysis (5 chunks): {partial['analysis']['formatted']}")

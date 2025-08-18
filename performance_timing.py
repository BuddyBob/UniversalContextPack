"""
Performance Timing System for UCP Analysis
===========================================

This module provides comprehensive timing measurements for extraction and analysis operations.
Results are logged to performance_timing.txt for analysis and user time estimates.
"""

import time
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import threading

@dataclass
class ExtractionTiming:
    """Timing data for extraction operations"""
    file_name: str
    file_size_bytes: int
    file_size_mb: float
    extraction_start_time: float
    extraction_end_time: float
    extraction_duration_seconds: float
    conversations_extracted: int
    messages_extracted: int
    extraction_rate_mb_per_second: float
    extraction_rate_conversations_per_second: float
    timestamp: str

@dataclass
class ChunkTiming:
    """Timing data for individual chunk analysis"""
    chunk_id: int
    chunk_size_tokens: int
    analysis_start_time: float
    analysis_end_time: float
    analysis_duration_seconds: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    tokens_per_second: float
    timestamp: str

@dataclass
class JobTiming:
    """Overall job timing data"""
    job_id: str
    total_chunks: int
    total_start_time: float
    total_end_time: float
    total_duration_seconds: float
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    average_chunk_duration: float
    average_tokens_per_second: float
    extraction_timing: Optional[ExtractionTiming]
    chunk_timings: List[ChunkTiming]
    timestamp: str

class PerformanceTimer:
    """Thread-safe performance timing system"""
    
    def __init__(self, log_file: str = "performance_timing.txt"):
        self.log_file = log_file
        self.lock = threading.Lock()
        self._ensure_log_file_exists()
    
    def _ensure_log_file_exists(self):
        """Create log file with header if it doesn't exist"""
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                f.write("UCP Performance Timing Log\n")
                f.write("=" * 50 + "\n")
                f.write(f"Log created: {datetime.now().isoformat()}\n\n")
    
    def log_extraction_timing(self, timing: ExtractionTiming):
        """Log extraction timing data"""
        with self.lock:
            try:
                with open(self.log_file, 'a') as f:
                    f.write(f"\n[EXTRACTION] {timing.timestamp}\n")
                    f.write(f"File: {timing.file_name}\n")
                    f.write(f"Size: {timing.file_size_mb:.2f} MB ({timing.file_size_bytes:,} bytes)\n")
                    f.write(f"Duration: {timing.extraction_duration_seconds:.2f} seconds\n")
                    f.write(f"Conversations: {timing.conversations_extracted:,}\n")
                    f.write(f"Messages: {timing.messages_extracted:,}\n")
                    f.write(f"Rate: {timing.extraction_rate_mb_per_second:.3f} MB/s\n")
                    f.write(f"Conv Rate: {timing.extraction_rate_conversations_per_second:.2f} conv/s\n")
                    f.write("-" * 40 + "\n")
            except Exception as e:
                print(f"Error logging extraction timing: {e}")
    
    def log_chunk_timing(self, timing: ChunkTiming):
        """Log individual chunk timing data"""
        with self.lock:
            try:
                with open(self.log_file, 'a') as f:
                    f.write(f"[CHUNK {timing.chunk_id}] {timing.timestamp}\n")
                    f.write(f"Tokens: {timing.chunk_size_tokens:,} input, {timing.output_tokens:,} output\n")
                    f.write(f"Duration: {timing.analysis_duration_seconds:.2f}s\n")
                    f.write(f"Rate: {timing.tokens_per_second:.1f} tokens/s\n")
                    f.write(f"Cost: ${timing.cost_usd:.4f}\n")
            except Exception as e:
                print(f"Error logging chunk timing: {e}")
    
    def log_job_summary(self, timing: JobTiming):
        """Log complete job timing summary"""
        with self.lock:
            try:
                with open(self.log_file, 'a') as f:
                    f.write(f"\n{'='*60}\n")
                    f.write(f"[JOB SUMMARY] {timing.timestamp}\n")
                    f.write(f"Job ID: {timing.job_id}\n")
                    f.write(f"Total Duration: {timing.total_duration_seconds:.2f} seconds ({timing.total_duration_seconds/60:.1f} minutes)\n")
                    f.write(f"Total Chunks: {timing.total_chunks}\n")
                    f.write(f"Total Tokens: {timing.total_input_tokens:,} input + {timing.total_output_tokens:,} output = {timing.total_input_tokens + timing.total_output_tokens:,}\n")
                    f.write(f"Total Cost: ${timing.total_cost_usd:.4f}\n")
                    f.write(f"Average Chunk Duration: {timing.average_chunk_duration:.2f}s\n")
                    f.write(f"Average Processing Rate: {timing.average_tokens_per_second:.1f} tokens/s\n")
                    
                    if timing.extraction_timing:
                        f.write(f"Extraction Duration: {timing.extraction_timing.extraction_duration_seconds:.2f}s\n")
                        f.write(f"Extraction Rate: {timing.extraction_timing.extraction_rate_mb_per_second:.3f} MB/s\n")
                    
                    f.write(f"{'='*60}\n\n")
            except Exception as e:
                print(f"Error logging job summary: {e}")
    
    def export_json_data(self, timing: JobTiming, output_file: str = None):
        """Export timing data as JSON for analysis"""
        if output_file is None:
            output_file = f"timing_data_{timing.job_id}.json"
        
        try:
            with open(output_file, 'w') as f:
                json.dump(asdict(timing), f, indent=2)
            print(f"Timing data exported to {output_file}")
        except Exception as e:
            print(f"Error exporting JSON data: {e}")

# Global timer instance
performance_timer = PerformanceTimer()

def time_extraction(func):
    """Decorator to time extraction operations"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        # Extract timing data from result if available
        if isinstance(result, dict) and 'timing_data' in result:
            timing_data = result['timing_data']
            timing_data['extraction_duration_seconds'] = end_time - start_time
            timing_data['extraction_start_time'] = start_time
            timing_data['extraction_end_time'] = end_time
        
        return result
    return wrapper

def time_chunk_analysis(func):
    """Decorator to time chunk analysis operations"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        # Add timing data to result
        if isinstance(result, dict):
            result['analysis_start_time'] = start_time
            result['analysis_end_time'] = end_time
            result['analysis_duration_seconds'] = end_time - start_time
        
        return result
    return wrapper

def calculate_extraction_metrics(file_size_bytes: int, duration_seconds: float, conversations: int, messages: int) -> Dict[str, float]:
    """Calculate extraction performance metrics"""
    file_size_mb = file_size_bytes / (1024 * 1024)
    
    return {
        'file_size_mb': file_size_mb,
        'extraction_rate_mb_per_second': file_size_mb / duration_seconds if duration_seconds > 0 else 0,
        'extraction_rate_conversations_per_second': conversations / duration_seconds if duration_seconds > 0 else 0,
        'extraction_rate_messages_per_second': messages / duration_seconds if duration_seconds > 0 else 0
    }

def calculate_analysis_metrics(tokens: int, duration_seconds: float, cost: float) -> Dict[str, float]:
    """Calculate analysis performance metrics"""
    return {
        'tokens_per_second': tokens / duration_seconds if duration_seconds > 0 else 0,
        'seconds_per_token': duration_seconds / tokens if tokens > 0 else 0,
        'cost_per_token': cost / tokens if tokens > 0 else 0,
        'cost_per_second': cost / duration_seconds if duration_seconds > 0 else 0
    }

def estimate_extraction_time(file_size_mb: float, baseline_rate: float = 2.5) -> Dict[str, float]:
    """Estimate extraction time based on file size"""
    estimated_seconds = file_size_mb / baseline_rate
    return {
        'estimated_seconds': estimated_seconds,
        'estimated_minutes': estimated_seconds / 60,
        'confidence': 'medium'  # Will improve with more data
    }

def estimate_analysis_time(total_tokens: int, baseline_rate: float = 1500) -> Dict[str, float]:
    """Estimate analysis time based on token count"""
    estimated_seconds = total_tokens / baseline_rate
    return {
        'estimated_seconds': estimated_seconds,
        'estimated_minutes': estimated_seconds / 60,
        'estimated_hours': estimated_seconds / 3600,
        'confidence': 'medium'  # Will improve with more data
    }

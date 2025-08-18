#!/usr/bin/env python3
"""
Test script for the performance timing system.
This will create sample timing data to verify the system works.
"""

import time
import json
from datetime import datetime
from performance_timing import (
    performance_timer,
    ExtractionTiming,
    ChunkTiming,
    JobTiming,
    calculate_extraction_metrics,
    calculate_analysis_metrics
)

def test_extraction_timing():
    """Test extraction timing logging"""
    print("Testing extraction timing...")
    
    # Simulate extraction timing
    file_size_bytes = 1024 * 1024 * 5  # 5MB file
    extraction_duration = 2.1  # 2.1 seconds
    conversations = 150
    messages = 3750
    
    metrics = calculate_extraction_metrics(file_size_bytes, extraction_duration, conversations, messages)
    
    timing = ExtractionTiming(
        file_name="test_whatsapp_export.json",
        file_size_bytes=file_size_bytes,
        file_size_mb=metrics['file_size_mb'],
        extraction_start_time=time.time() - extraction_duration,
        extraction_end_time=time.time(),
        extraction_duration_seconds=extraction_duration,
        conversations_extracted=conversations,
        messages_extracted=messages,
        extraction_rate_mb_per_second=metrics['extraction_rate_mb_per_second'],
        extraction_rate_conversations_per_second=metrics['extraction_rate_conversations_per_second'],
        timestamp=datetime.now().isoformat()
    )
    
    performance_timer.log_extraction_timing(timing)
    print(f"✅ Logged extraction timing: {metrics['file_size_mb']:.2f}MB in {extraction_duration}s")
    return timing

def test_chunk_timing():
    """Test chunk analysis timing logging"""
    print("Testing chunk analysis timing...")
    
    chunk_timings = []
    
    # Simulate 30 chunks
    for i in range(30):
        chunk_duration = 25.0 + (i * 2.5) % 30  # Varying durations 25-55 seconds
        input_tokens = 45000 + (i * 1000) % 10000  # 45k-55k tokens
        output_tokens = 12000 + (i * 500) % 5000   # 12k-17k tokens
        cost = (input_tokens / 1_000_000) * 0.050 + (output_tokens / 1_000_000) * 0.400
        
        timing = ChunkTiming(
            chunk_id=i + 1,
            chunk_size_tokens=input_tokens,
            analysis_start_time=time.time() - chunk_duration,
            analysis_end_time=time.time(),
            analysis_duration_seconds=chunk_duration,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=cost,
            tokens_per_second=(input_tokens + output_tokens) / chunk_duration,
            timestamp=datetime.now().isoformat()
        )
        
        chunk_timings.append(timing)
        performance_timer.log_chunk_timing(timing)
        
        if i % 10 == 9:  # Every 10 chunks
            print(f"  ✅ Logged chunk {i+1}/30 timing: {chunk_duration:.1f}s, {timing.tokens_per_second:.1f} tokens/s")
    
    return chunk_timings

def test_job_summary():
    """Test comprehensive job timing summary"""
    print("Testing job summary timing...")
    
    # Get sample data
    extraction_timing = test_extraction_timing()
    chunk_timings = test_chunk_timing()
    
    # Calculate job totals
    total_duration = sum(ct.analysis_duration_seconds for ct in chunk_timings)
    total_input_tokens = sum(ct.input_tokens for ct in chunk_timings)
    total_output_tokens = sum(ct.output_tokens for ct in chunk_timings)
    total_cost = sum(ct.cost_usd for ct in chunk_timings)
    
    job_timing = JobTiming(
        job_id="test_job_12345678",
        total_chunks=len(chunk_timings),
        total_start_time=time.time() - total_duration,
        total_end_time=time.time(),
        total_duration_seconds=total_duration,
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
        total_cost_usd=total_cost,
        average_chunk_duration=total_duration / len(chunk_timings),
        average_tokens_per_second=(total_input_tokens + total_output_tokens) / total_duration,
        extraction_timing=extraction_timing,
        chunk_timings=chunk_timings,
        timestamp=datetime.now().isoformat()
    )
    
    performance_timer.log_job_summary(job_timing)
    performance_timer.export_json_data(job_timing, "test_timing_data.json")
    
    print(f"✅ Logged job summary: {len(chunk_timings)} chunks, {total_duration/60:.1f} minutes, ${total_cost:.3f}")
    print(f"📊 Average: {job_timing.average_chunk_duration:.1f}s/chunk, {job_timing.average_tokens_per_second:.1f} tokens/s")
    
    return job_timing

def test_estimates():
    """Test time estimation functions"""
    print("Testing time estimation functions...")
    
    from performance_timing import estimate_extraction_time, estimate_analysis_time
    
    # Test extraction estimates
    for file_size in [1, 5, 10, 25]:
        estimate = estimate_extraction_time(file_size)
        print(f"  📈 {file_size}MB file: ~{estimate['estimated_seconds']:.1f}s ({estimate['estimated_minutes']:.1f}min)")
    
    # Test analysis estimates  
    for chunks in [10, 30, 50, 100]:
        tokens = chunks * 50000  # 50k tokens per chunk estimate
        estimate = estimate_analysis_time(tokens)
        print(f"  🧠 {chunks} chunks: ~{estimate['estimated_minutes']:.1f}min ({estimate['estimated_hours']:.1f}h)")

def main():
    """Run all timing system tests"""
    print("🚀 Testing Performance Timing System")
    print("=" * 50)
    
    try:
        test_extraction_timing()
        print()
        
        chunk_timings = test_chunk_timing()
        print()
        
        test_job_summary()
        print()
        
        test_estimates()
        print()
        
        print("✅ All timing system tests completed successfully!")
        print(f"📝 Check 'performance_timing.txt' for logged data")
        print(f"📊 Check 'test_timing_data.json' for exported data")
        
        # Show timing file stats
        try:
            with open("performance_timing.txt", 'r') as f:
                lines = len(f.readlines())
            print(f"📈 Timing log file: {lines} lines")
        except:
            print("⚠️  Could not read timing log file")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

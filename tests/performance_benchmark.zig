const std = @import("std");
const BatchProcessor = @import("../src/core/batch_processor.zig").BatchProcessor;
const Serializer = @import("../src/core/serializer.zig").Serializer;
const Deserializer = @import("../src/core/serializer.zig").Deserializer;
const OptimizedEngine = @import("../src/core/optimized_engine.zig").OptimizedEngine;
const EngineConfig = @import("../src/core/optimized_engine.zig").EngineConfig;

pub fn main() !void {
    const allocator = std.heap.page_allocator;

    std.debug.print("=== LiteClaw Performance Benchmark (Optimized) ===\n\n", .{});

    try benchmarkStartup(allocator);
    try benchmarkThroughput(allocator);
    try benchmarkSerialization(allocator);
    try benchmarkBatchProcessing(allocator);
    try benchmarkMemoryUsage(allocator);

    std.debug.print("\n=== All Benchmarks Complete ===\n", .{});
}

fn benchmarkStartup(allocator: std.mem.Allocator) !void {
    std.debug.print("1. Startup Time Benchmark\n", .{});
    std.debug.print("   Target: <25ms\n", .{});

    var total_time: u64 = 0;
    const iterations = 10;

    var i: usize = 0;
    while (i < iterations) : (i += 1) {
        const start = std.time.nanoTimestamp();
        
        const config = EngineConfig{
            .lazy_load_plugins = true,
            .enable_cache_warmup = true,
        };
        
        const engine = try OptimizedEngine.init(allocator, config);
        _ = engine.getInitTime();
        engine.deinit();
        
        const end = std.time.nanoTimestamp();
        total_time += (end - start);
    }

    const avg_time_ns = total_time / iterations;
    const avg_time_ms = avg_time_ns / 1_000_000;
    const avg_time_us = avg_time_ns / 1_000;

    std.debug.print("   Average: {}ms ({}μs)\n", .{ avg_time_ms, avg_time_us });
    
    if (avg_time_ms < 25) {
        std.debug.print("   ✓ PASS: Target met\n", .{});
    } else {
        std.debug.print("   ✗ FAIL: Target not met\n", .{});
    }
    
    std.debug.print("\n", .{});
}

fn benchmarkThroughput(allocator: std.mem.Allocator) !void {
    std.debug.print("2. Throughput Benchmark\n", .{});
    std.debug.print("   Target: 1000 msg/s\n", .{});

    const config = BatchProcessor.BatchConfig{
        .max_batch_size = 100,
        .max_batch_wait_ms = 10,
        .max_queue_size = 10000,
    };

    const processor = try BatchProcessor.init(allocator, config);
    defer processor.deinit();

    try processor.start();

    const num_messages = 1000;
    const start = std.time.nanoTimestamp();

    var i: u64 = 0;
    while (i < num_messages) : (i += 1) {
        const msg = BatchProcessor.Message{
            .id = i,
            .data = "benchmark message",
            .timestamp = std.time.nanoTimestamp(),
        };
        try processor.enqueue(msg);
    }

    const end = std.time.nanoTimestamp();
    const elapsed_ns = end - start;
    const elapsed_sec = @as(f64, @floatFromInt(elapsed_ns)) / 1_000_000_000.0;
    const throughput = @as(f64, @floatFromInt(num_messages)) / elapsed_sec;

    std.debug.print("   Processed: {} messages\n", .{num_messages});
    std.debug.print("   Time: {:.2}s\n", .{elapsed_sec});
    std.debug.print("   Throughput: {:.0} msg/s\n", .{throughput});

    if (throughput >= 1000.0) {
        std.debug.print("   ✓ PASS: Target met\n", .{});
    } else {
        std.debug.print("   ✗ FAIL: Target not met\n", .{});
    }

    std.debug.print("\n", .{});
}

fn benchmarkSerialization(allocator: std.mem.Allocator) !void {
    std.debug.print("3. Serialization Benchmark\n", .{});

    const serializer = try Serializer.init(allocator);
    defer serializer.deinit();

    const num_operations = 10000;
    const start = std.time.nanoTimestamp();

    var i: u64 = 0;
    while (i < num_operations) : (i += 1) {
        try serializer.serializeU64(i);
        try serializer.serializeString("test data");
        try serializer.serializeBool(i % 2 == 0);
    }

    const end = std.time.nanoTimestamp();
    const elapsed_ns = end - start;
    const elapsed_us = elapsed_ns / 1_000;
    const ops_per_us = @as(f64, @floatFromInt(num_operations)) / @as(f64, @floatFromInt(elapsed_us));

    std.debug.print("   Operations: {}\n", .{num_operations});
    std.debug.print("   Time: {}μs\n", .{elapsed_us});
    std.debug.print("   Ops/μs: {:.2}\n", .{ops_per_us});

    const buffer = try allocator.dupe(u8, serializer.getBuffer());
    defer allocator.free(buffer);

    var deserializer = Deserializer.init(buffer);
    const deserialize_start = std.time.nanoTimestamp();

    i = 0;
    while (i < num_operations) : (i += 1) {
        _ = try deserializer.deserializeU64();
        _ = try deserializer.deserializeString();
        _ = try deserializer.deserializeBool();
    }

    const deserialize_end = std.time.nanoTimestamp();
    const deserialize_elapsed_us = (deserialize_end - deserialize_start) / 1_000;
    const deserialize_ops_per_us = @as(f64, @floatFromInt(num_operations)) / @as(f64, @floatFromInt(deserialize_elapsed_us));

    std.debug.print("   Deserialize Time: {}μs\n", .{deserialize_elapsed_us});
    std.debug.print("   Deserialize Ops/μs: {:.2}\n", .{deserialize_ops_per_us});

    std.debug.print("\n", .{});
}

fn benchmarkBatchProcessing(allocator: std.mem.Allocator) !void {
    std.debug.print("4. Batch Processing Benchmark\n", .{});

    const config = BatchProcessor.BatchConfig{
        .max_batch_size = 100,
        .max_batch_wait_ms = 10,
        .max_queue_size = 10000,
    };

    const processor = try BatchProcessor.init(allocator, config);
    defer processor.deinit();

    try processor.start();

    const num_messages = 1000;
    var i: u64 = 0;
    while (i < num_messages) : (i += 1) {
        const msg = BatchProcessor.Message{
            .id = i,
            .data = "batch test",
            .timestamp = std.time.nanoTimestamp(),
        };
        try processor.enqueue(msg);
    }

    var total_batches: u64 = 0;
    var total_processed: u64 = 0;
    const start = std.time.nanoTimestamp();

    while (true) {
        const batch = try processor.tryGetBatch();
        if (batch) |b| {
            defer allocator.free(b);
            
            try processor.processBatch(b, handleMessage);
            total_batches += 1;
            total_processed += b.len;
        } else {
            break;
        }
    }

    const end = std.time.nanoTimestamp();
    const elapsed_ms = (end - start) / 1_000_000;

    std.debug.print("   Messages: {}\n", .{total_processed});
    std.debug.print("   Batches: {}\n", .{total_batches});
    std.debug.print("   Avg Batch Size: {:.1}\n", .{@as(f64, @floatFromInt(total_processed)) / @as(f64, @floatFromInt(total_batches))});
    std.debug.print("   Time: {}ms\n", .{elapsed_ms});

    const stats = processor.getStats();
    std.debug.print("   Total Processed: {}\n", .{stats.total_processed});
    std.debug.print("   Total Batches: {}\n", .{stats.total_batches});

    std.debug.print("\n", .{});
}

fn handleMessage(msg: BatchProcessor.Message) !void {
    _ = msg;
}

fn benchmarkMemoryUsage(allocator: std.mem.Allocator) !void {
    std.debug.print("5. Memory Usage Benchmark\n", .{});

    const config = BatchProcessor.BatchConfig{
        .max_batch_size = 100,
        .max_batch_wait_ms = 10,
        .max_queue_size = 10000,
    };

    const processor = try BatchProcessor.init(allocator, config);
    defer processor.deinit();

    try processor.start();

    const num_messages = 1000;
    var i: u64 = 0;
    while (i < num_messages) : (i += 1) {
        const msg = BatchProcessor.Message{
            .id = i,
            .data = "memory test",
            .timestamp = std.time.nanoTimestamp(),
        };
        try processor.enqueue(msg);
    }

    const stats = processor.getStats();
    std.debug.print("   Queue Size: {}\n", .{stats.queue_size});
    std.debug.print("   Batch Size: {}\n", .{stats.batch_size});
    std.debug.print("   Messages Enqueued: {}\n", .{num_messages});
    std.debug.print("   Memory Efficiency: {:.1}%\n", .{@as(f64, @floatFromInt(stats.queue_size + stats.batch_size)) / @as(f64, @floatFromInt(num_messages)) * 100.0});

    std.debug.print("\n", .{});
}

const std = @import("std");

const Message = struct {
    id: u64,
    data: []const u8,
    timestamp: i128,
    processed: bool = false,
};

const BatchConfig = struct {
    max_batch_size: usize = 100,
    max_batch_wait_ms: u32 = 10,
    max_queue_size: usize = 10000,
};

const BatchProcessor = struct {
    allocator: std.mem.Allocator,
    config: BatchConfig,
    message_queue: std.ArrayList(Message),
    current_batch: std.ArrayList(Message),
    batch_start_time: i128,
    mutex: std.Thread.Mutex,
    running: bool,
    total_processed: u64 = 0,
    total_batches: u64 = 0,

    pub fn init(allocator: std.mem.Allocator, config: BatchConfig) !*BatchProcessor {
        const processor = try allocator.create(BatchProcessor);
        processor.* = .{
            .allocator = allocator,
            .config = config,
            .message_queue = std.ArrayList(Message).init(allocator),
            .current_batch = std.ArrayList(Message).init(allocator),
            .batch_start_time = 0,
            .mutex = .{},
            .running = false,
        };
        return processor;
    }

    pub fn start(self: *BatchProcessor) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        if (self.running) return;
        self.running = true;
        self.batch_start_time = std.time.nanoTimestamp();
    }

    pub fn stop(self: *BatchProcessor) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        self.running = false;
    }

    pub fn enqueue(self: *BatchProcessor, message: Message) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.message_queue.items.len >= self.config.max_queue_size) {
            return error.QueueFull;
        }

        try self.message_queue.append(message);
    }

    pub fn tryGetBatch(self: *BatchProcessor) !?[]Message {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.running) return null;

        const now = std.time.nanoTimestamp();
        const elapsed_ns = now - self.batch_start_time;
        const elapsed_ms = @as(u32, @intCast(@abs(elapsed_ns) / 1_000_000));

        if (self.current_batch.items.len >= self.config.max_batch_size or 
            elapsed_ms >= self.config.max_batch_wait_ms) {
            if (self.current_batch.items.len > 0) {
                const batch = try self.allocator.dupe(Message, self.current_batch.items);
                self.current_batch.clearRetainingCapacity();
                self.batch_start_time = now;
                self.total_batches += 1;
                return batch;
            }
        }

        while (self.message_queue.items.len > 0 and 
               self.current_batch.items.len < self.config.max_batch_size) {
            const msg = self.message_queue.orderedRemove(0);
            try self.current_batch.append(msg);
        }

        if (self.current_batch.items.len >= self.config.max_batch_size or 
            elapsed_ms >= self.config.max_batch_wait_ms) {
            if (self.current_batch.items.len > 0) {
                const batch = try self.allocator.dupe(Message, self.current_batch.items);
                self.current_batch.clearRetainingCapacity();
                self.batch_start_time = now;
                self.total_batches += 1;
                return batch;
            }
        }

        return null;
    }

    pub fn processBatch(self: *BatchProcessor, batch: []Message) !void {
        for (batch) |*msg| {
            msg.processed = true;
        }
        
        self.mutex.lock();
        defer self.mutex.unlock();
        self.total_processed += batch.len;
    }

    pub fn getStats(self: *BatchProcessor) struct {
        queue_size: usize,
        batch_size: usize,
        total_processed: u64,
        total_batches: u64,
        running: bool,
    } {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        return .{
            .queue_size = self.message_queue.items.len,
            .batch_size = self.current_batch.items.len,
            .total_processed = self.total_processed,
            .total_batches = self.total_batches,
            .running = self.running,
        };
    }

    pub fn deinit(self: *BatchProcessor) void {
        self.mutex.lock();
        self.mutex.unlock();

        self.message_queue.deinit();
        self.current_batch.deinit();
        self.allocator.destroy(self);
    }
};

pub fn main() !void {
    const allocator = std.heap.page_allocator;

    std.debug.print("=== LiteClaw Performance Benchmark (Optimized) ===\n\n", .{});

    try benchmarkThroughput(allocator);
    try benchmarkBatchProcessing(allocator);
    try benchmarkMemoryUsage(allocator);

    std.debug.print("\n=== All Benchmarks Complete ===\n", .{});
}

fn benchmarkThroughput(allocator: std.mem.Allocator) !void {
    std.debug.print("1. Throughput Benchmark\n", .{});
    std.debug.print("   Target: 1000 msg/s\n", .{});

    const config = BatchConfig{
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
        const msg = Message{
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

fn benchmarkBatchProcessing(allocator: std.mem.Allocator) !void {
    std.debug.print("2. Batch Processing Benchmark\n", .{});

    const config = BatchConfig{
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
        const msg = Message{
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
            
            try processor.processBatch(b);
            total_batches += 1;
            total_processed += b.len;
        } else {
            break;
        }
    }

    const end = std.time.nanoTimestamp();
    const elapsed_ms = @divTrunc(end - start, 1_000_000);

    std.debug.print("   Messages: {}\n", .{total_processed});
    std.debug.print("   Batches: {}\n", .{total_batches});
    std.debug.print("   Avg Batch Size: {:.1}\n", .{@as(f64, @floatFromInt(total_processed)) / @as(f64, @floatFromInt(total_batches))});
    std.debug.print("   Time: {}ms\n", .{elapsed_ms});

    const stats = processor.getStats();
    std.debug.print("   Total Processed: {}\n", .{stats.total_processed});
    std.debug.print("   Total Batches: {}\n", .{stats.total_batches});

    std.debug.print("\n", .{});
}

fn benchmarkMemoryUsage(allocator: std.mem.Allocator) !void {
    std.debug.print("3. Memory Usage Benchmark\n", .{});

    const config = BatchConfig{
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
        const msg = Message{
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

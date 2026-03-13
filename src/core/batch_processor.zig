const std = @import("std");

pub const Message = struct {
    id: u64,
    data: []const u8,
    timestamp: u64,
    processed: bool = false,
};

pub const BatchConfig = struct {
    max_batch_size: usize = 100,
    max_batch_wait_ms: u32 = 10,
    max_queue_size: usize = 10000,
};

pub const BatchProcessor = struct {
    allocator: std.mem.Allocator,
    config: BatchConfig,
    message_queue: std.ArrayList(Message),
    current_batch: std.ArrayList(Message),
    batch_start_time: u64,
    mutex: std.Thread.Mutex,
    condvar: std.Thread.Condvar,
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
            .condvar = .{},
            condvar = .{},
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
        self.condvar.broadcast();
    }

    pub fn enqueue(self: *BatchProcessor, message: Message) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.message_queue.items.len >= self.config.max_queue_size) {
            return error.QueueFull;
        }

        try self.message_queue.append(message);
        self.condvar.signal();
    }

    pub fn tryGetBatch(self: *BatchProcessor) !?[]Message {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.running) return null;

        const now = std.time.nanoTimestamp();
        const elapsed_ms = @as(u32, @intCast((now - self.batch_start_time) / 1_000_000));

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

    pub fn processBatch(self: *BatchProcessor, batch: []Message, handler: *const fn (Message) anyerror!void) !void {
        for (batch) |*msg| {
            handler(msg.*) catch |err| {
                std.debug.print("Message {} processing failed: {}\n", .{ msg.id, err });
            };
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
        defer self.mutex.unlock();

        self.message_queue.deinit();
        self.current_batch.deinit();
        self.allocator.destroy(self);
    }
};

test "Batch processor basic operations" {
    const allocator = std.testing.allocator;
    const config = BatchConfig{
        .max_batch_size = 10,
        .max_batch_wait_ms = 100,
        .max_queue_size = 100,
    };

    const processor = try BatchProcessor.init(allocator, config);
    defer processor.deinit();

    try processor.start();

    var i: u64 = 0;
    while (i < 5) : (i += 1) {
        const msg = Message{
            .id = i,
            .data = "test",
            .timestamp = std.time.nanoTimestamp(),
        };
        try processor.enqueue(msg);
    }

    const batch = try processor.tryGetBatch();
    if (batch) |b| {
        defer allocator.free(b);
        try std.testing.expect(b.len == 5);
    }
}

test "Batch processor full batch" {
    const allocator = std.testing.allocator;
    const config = BatchConfig{
        .max_batch_size = 3,
        .max_batch_wait_ms = 100,
        .max_queue_size = 100,
    };

    const processor = try BatchProcessor.init(allocator, config);
    defer processor.deinit();

    try processor.start();

    var i: u64 = 0;
    while (i < 5) : (i += 1) {
        const msg = Message{
            .id = i,
            .data = "test",
            .timestamp = std.time.nanoTimestamp(),
        };
        try processor.enqueue(msg);
    }

    const batch1 = try processor.tryGetBatch();
    if (batch1) |b| {
        defer allocator.free(b);
        try std.testing.expect(b.len == 3);
    }

    const batch2 = try processor.tryGetBatch();
    if (batch2) |b| {
        defer allocator.free(b);
        try std.testing.expect(b.len == 2);
    }
}

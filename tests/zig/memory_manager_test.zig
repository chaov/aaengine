const std = @import("std");
const testing = std.testing;

const MemoryManager = @import("../../src/core/memory_manager.zig").MemoryManager;
const AllocStrategy = @import("../../src/core/memory_manager.zig").AllocStrategy;

test "MemoryManager - initialization" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const stats = manager.getStats();
    try testing.expectEqual(@as(usize, 0), stats.total_allocated);
    try testing.expectEqual(@as(usize, 0), stats.current_usage);
}

test "MemoryManager - arena allocation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const size = 1024;
    const ptr = try manager.allocate(size, .arena);
    defer manager.deallocate(ptr);

    try testing.expectEqual(size, ptr.len);

    const stats = manager.getStats();
    try testing.expectEqual(size, stats.total_allocated);
    try testing.expectEqual(size, stats.current_usage);
}

test "MemoryManager - heap allocation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const size = 2048;
    const ptr = try manager.allocate(size, .heap);
    defer manager.deallocate(ptr);

    try testing.expectEqual(size, ptr.len);

    const stats = manager.getStats();
    try testing.expectEqual(size, stats.total_allocated);
}

test "MemoryManager - deallocation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const size = 1024;
    const ptr = try manager.allocate(size, .heap);
    manager.deallocate(ptr);

    const stats = manager.getStats();
    try testing.expectEqual(size, stats.total_allocated);
    try testing.expectEqual(size, stats.total_freed);
    try testing.expectEqual(@as(usize, 0), stats.current_usage);
}

test "MemoryManager - peak usage tracking" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const ptr1 = try manager.allocate(1024, .heap);
    const ptr2 = try manager.allocate(2048, .heap);
    manager.deallocate(ptr1);

    const stats = manager.getStats();
    try testing.expect(stats.peak_usage >= 3072);
}

test "MemoryManager - pool allocation not supported" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const result = manager.allocate(1024, .pool);
    try testing.expectError(error.PoolAllocationNotSupported, result);
}

test "MemoryManager - reset arena" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    _ = try manager.allocate(1024, .arena);
    _ = try manager.allocate(2048, .arena);

    manager.resetArena();

    const stats = manager.getStats();
    try testing.expectEqual(@as(usize, 0), stats.current_usage);
}

test "MemoryManager - allocation count tracking" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const ptr = try manager.allocate(1024, .heap);
    manager.deallocate(ptr);

    const stats = manager.getStats();
    try testing.expectEqual(@as(u64, 1), stats.allocation_count);
    try testing.expectEqual(@as(u64, 1), stats.deallocation_count);
}

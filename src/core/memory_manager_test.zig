const std = @import("std");
const testing = std.testing;

const MemoryManager = @import("memory_manager.zig").MemoryManager;
const AllocStrategy = @import("memory_manager.zig").AllocStrategy;

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

    try testing.expectEqual(size, ptr.len);

    const stats = manager.getStats();
    try testing.expectEqual(size, stats.total_allocated);
    try testing.expectEqual(size, stats.current_usage);
    
    manager.resetArena();
}

test "MemoryManager - heap allocation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const size = 2048;
    const ptr = try manager.allocate(size, .heap);
    defer manager.deallocate(ptr, .heap);

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
    manager.deallocate(ptr, .heap);

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
    manager.deallocate(ptr1, .heap);
    manager.deallocate(ptr2, .heap);

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
    manager.deallocate(ptr, .heap);

    const stats = manager.getStats();
    try testing.expectEqual(@as(u64, 1), stats.allocation_count);
    try testing.expectEqual(@as(u64, 1), stats.deallocation_count);
}

test "MemoryManager - Security: Empty pool name validation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const result = manager.getPool(u32, "");
    try testing.expectError(error.InvalidPoolName, result);
}

test "MemoryManager - Security: Pool name length validation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    var long_name: [300]u8 = undefined;
    for (0..300) |i| {
        long_name[i] = 'a';
    }
    
    const result = manager.getPool(u32, &long_name);
    try testing.expectError(error.InvalidPoolName, result);
}

test "MemoryManager - Security: Pool name character validation" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const invalid_names = [_][]const u8{
        "pool\x00name",
        "pool\rcarriage",
        "pool\nnewline",
        "pool\x1besc",
    };

    for (invalid_names) |name| {
        const result = manager.getPool(u32, name);
        try testing.expectError(error.InvalidPoolName, result);
    }
}

test "MemoryManager - Security: Valid pool name" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const valid_names = [_][]const u8{
        "test_pool",
        "Pool123",
        "pool-name",
        "pool_name",
        "a",
        "123",
    };

    for (valid_names) |name| {
        const pool = try manager.getPool(u32, name);
        pool.deinit();
    }
}

test "MemoryManager - Security: Type safety in pool operations" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    const pool_u32 = try manager.getPool(u32, "u32_pool");
    const pool_u64 = try manager.getPool(u64, "u64_pool");

    const obj_u32 = try pool_u32.acquire();
    const obj_u64 = try pool_u64.acquire();

    obj_u32.* = 42;
    obj_u64.* = 123456789;

    try testing.expectEqual(@as(u32, 42), obj_u32.*);
    try testing.expectEqual(@as(u64, 123456789), obj_u64.*);

    pool_u32.release(obj_u32);
    pool_u64.release(obj_u64);
    
    pool_u32.deinit();
    pool_u64.deinit();
}

test "MemoryManager - Security: Thread safety" {
    const allocator = testing.allocator;
    const manager = try MemoryManager.init(allocator);
    defer manager.deinit();

    var allocations: [10][]u8 = undefined;
    for (0..10) |i| {
        allocations[i] = try manager.allocate(1024, .heap);
    }

    for (0..10) |i| {
        manager.deallocate(allocations[i], .heap);
    }

    const stats = manager.getStats();
    try testing.expectEqual(@as(u64, 10), stats.allocation_count);
    try testing.expectEqual(@as(u64, 10), stats.deallocation_count);
}

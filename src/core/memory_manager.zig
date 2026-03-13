const std = @import("std");

pub const AllocStrategy = enum {
    pool,
    arena,
    heap,
    mmap,
};

pub const MemoryStats = struct {
    total_allocated: usize = 0,
    total_freed: usize = 0,
    current_usage: usize = 0,
    peak_usage: usize = 0,
    allocation_count: u64 = 0,
    deallocation_count: u64 = 0,
};

pub fn ObjectPool(comptime T: type) type {
    return struct {
        allocator: std.mem.Allocator,
        free_objects: std.ArrayList(*T),
        allocated_count: usize,
        max_size: usize,

        pub fn init(allocator: std.mem.Allocator, initial_size: usize, max_size: usize) !*@This() {
            const pool = try allocator.create(@This());
            pool.* = .{
                .allocator = allocator,
                .free_objects = std.ArrayList(*T).init(allocator),
                .allocated_count = 0,
                .max_size = max_size,
            };

            try pool.free_objects.ensureTotalCapacity(initial_size);

            return pool;
        }

        pub fn acquire(self: *@This()) !*T {
            if (self.free_objects.popOrNull()) |obj| {
                return obj;
            }

            if (self.allocated_count >= self.max_size) {
                return error.PoolExhausted;
            }

            const obj = try self.allocator.create(T);
            self.allocated_count += 1;
            return obj;
        }

        pub fn release(self: *@This(), obj: *T) void {
            if (self.free_objects.items.len < self.max_size) {
                self.free_objects.append(obj) catch {
                    self.allocator.destroy(obj);
                    self.allocated_count -= 1;
                };
            } else {
                self.allocator.destroy(obj);
                self.allocated_count -= 1;
            }
        }

        pub fn deinit(self: *@This()) void {
            for (self.free_objects.items) |obj| {
                self.allocator.destroy(obj);
            }
            self.free_objects.deinit();
            self.allocator.destroy(self);
        }
    };
}

pub const MemoryManager = struct {
    allocator: std.mem.Allocator,
    object_pools: std.StringHashMap(*anyopaque),
    arena: std.heap.ArenaAllocator,
    stats: MemoryStats,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) !*MemoryManager {
        const manager = try allocator.create(MemoryManager);
        manager.* = .{
            .allocator = allocator,
            .object_pools = std.StringHashMap(*anyopaque).init(allocator),
            .arena = std.heap.ArenaAllocator.init(allocator),
            .stats = .{},
            .mutex = .{},
        };
        return manager;
    }

    pub fn allocate(self: *MemoryManager, size: usize, strategy: AllocStrategy) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const ptr = switch (strategy) {
            .pool => return error.PoolAllocationNotSupported,
            .arena => self.arena.allocator().alloc(u8, size),
            .heap => self.allocator.alloc(u8, size),
            .mmap => self.allocator.alloc(u8, size),
        };

        self.stats.total_allocated += size;
        self.stats.current_usage += size;
        self.stats.allocation_count += 1;
        self.stats.peak_usage = @max(self.stats.peak_usage, self.stats.current_usage);

        return ptr;
    }

    pub fn deallocate(self: *MemoryManager, ptr: []u8, strategy: AllocStrategy) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const size = ptr.len;
        
        switch (strategy) {
            .pool => {},
            .arena => {},
            .heap => self.allocator.free(ptr),
            .mmap => self.allocator.free(ptr),
        }

        self.stats.total_freed += size;
        self.stats.current_usage -= size;
        self.stats.deallocation_count += 1;
    }

    pub fn getPool(self: *MemoryManager, comptime T: type, name: []const u8) !*ObjectPool(T) {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (name.len == 0 or name.len > 256) {
            return error.InvalidPoolName;
        }

        for (name) |c| {
            if (c < 32 or c > 126) {
                return error.InvalidPoolName;
            }
        }

        if (self.object_pools.get(name)) |pool| {
            const typed_pool = @as(*ObjectPool(T), @ptrCast(@alignCast(pool)));
            return typed_pool;
        }

        const pool = try ObjectPool(T).init(self.allocator, 16, 1024);
        const name_copy = try self.allocator.dupe(u8, name);
        try self.object_pools.put(name_copy, pool);
        return pool;
    }

    pub fn getStats(self: *MemoryManager) MemoryStats {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.stats;
    }

    pub fn resetArena(self: *MemoryManager) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        _ = self.arena.reset(.retain_capacity);
        self.stats.current_usage = 0;
    }

    pub fn deinit(self: *MemoryManager) void {
        var iter = self.object_pools.iterator();
        while (iter.next()) |entry| {
            const pool = @as(*anyopaque, entry.value_ptr.*);
            const typed_pool = @as(*ObjectPool(u8), @ptrCast(@alignCast(pool)));
            typed_pool.deinit();
            self.allocator.free(entry.key_ptr.*);
        }
        self.object_pools.deinit();
        self.arena.deinit();
        self.allocator.destroy(self);
    }
};

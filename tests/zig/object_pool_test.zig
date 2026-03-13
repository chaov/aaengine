const std = @import("std");
const testing = std.testing;

test "ObjectPool - initialization" {
    const allocator = testing.allocator;
    
    const ObjectPool = fn (type) type {
        return struct {
            allocator: std.mem.Allocator,
            free_objects: std.ArrayList(*u8),
            allocated_count: usize,
            max_size: usize,
            
            pub fn init(allocator: std.mem.Allocator, initial_size: usize, max_size: usize) !*@This() {
                const pool = try allocator.create(@This());
                pool.* = .{
                    .allocator = allocator,
                    .free_objects = std.ArrayList(*u8).init(allocator),
                    .allocated_count = 0,
                    .max_size = max_size,
                };
                try pool.free_objects.ensureTotalCapacity(initial_size);
                return pool;
            }
            
            pub fn deinit(self: *@This()) void {
                for (self.free_objects.items) |obj| {
                    self.allocator.destroy(obj);
                }
                self.free_objects.deinit();
                self.allocator.destroy(self);
            }
        };
    };
    
    const pool = try ObjectPool(u8).init(allocator, 10, 100);
    defer pool.deinit();
    
    try testing.expectEqual(@as(usize, 0), pool.allocated_count);
}

test "ObjectPool - acquire and release" {
    const allocator = testing.allocator;
    
    const ObjectPool = fn (type) type {
        return struct {
            allocator: std.mem.Allocator,
            free_objects: std.ArrayList(*u8),
            allocated_count: usize,
            max_size: usize,
            
            pub fn init(allocator: std.mem.Allocator, initial_size: usize, max_size: usize) !*@This() {
                const pool = try allocator.create(@This());
                pool.* = .{
                    .allocator = allocator,
                    .free_objects = std.ArrayList(*u8).init(allocator),
                    .allocated_count = 0,
                    .max_size = max_size,
                };
                try pool.free_objects.ensureTotalCapacity(initial_size);
                return pool;
            }
            
            pub fn acquire(self: *@This()) !*u8 {
                if (self.free_objects.popOrNull()) |obj| {
                    return obj;
                }
                if (self.allocated_count >= self.max_size) {
                    return error.PoolExhausted;
                }
                const obj = try self.allocator.create(u8);
                self.allocated_count += 1;
                return obj;
            }
            
            pub fn release(self: *@This(), obj: *u8) void {
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
    };
    
    const pool = try ObjectPool(u8).init(allocator, 10, 100);
    defer pool.deinit();
    
    const obj = try pool.acquire();
    try testing.expectEqual(@as(usize, 1), pool.allocated_count);
    
    pool.release(obj);
    try testing.expectEqual(@as(usize, 0), pool.allocated_count);
}

test "ObjectPool - pool exhaustion" {
    const allocator = testing.allocator;
    
    const ObjectPool = fn (type) type {
        return struct {
            allocator: std.mem.Allocator,
            free_objects: std.ArrayList(*u8),
            allocated_count: usize,
            max_size: usize,
            
            pub fn init(allocator: std.mem.Allocator, initial_size: usize, max_size: usize) !*@This() {
                const pool = try allocator.create(@This());
                pool.* = .{
                    .allocator = allocator,
                    .free_objects = std.ArrayList(*u8).init(allocator),
                    .allocated_count = 0,
                    .max_size = max_size,
                };
                try pool.free_objects.ensureTotalCapacity(initial_size);
                return pool;
            }
            
            pub fn acquire(self: *@This()) !*u8 {
                if (self.free_objects.popOrNull()) |obj| {
                    return obj;
                }
                if (self.allocated_count >= self.max_size) {
                    return error.PoolExhausted;
                }
                const obj = try self.allocator.create(u8);
                self.allocated_count += 1;
                return obj;
            }
            
            pub fn release(self: *@This(), obj: *u8) void {
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
    };
    
    const pool = try ObjectPool(u8).init(allocator, 10, 5);
    defer pool.deinit();
    
    var objects: [5]*u8 = undefined;
    for (0..5) |i| {
        objects[i] = try pool.acquire();
    }
    
    const result = pool.acquire();
    try testing.expectError(error.PoolExhausted, result);
}

test "ObjectPool - cleanup" {
    const allocator = testing.allocator;
    
    const ObjectPool = fn (type) type {
        return struct {
            allocator: std.mem.Allocator,
            free_objects: std.ArrayList(*u8),
            allocated_count: usize,
            max_size: usize,
            
            pub fn init(allocator: std.mem.Allocator, initial_size: usize, max_size: usize) !*@This() {
                const pool = try allocator.create(@This());
                pool.* = .{
                    .allocator = allocator,
                    .free_objects = std.ArrayList(*u8).init(allocator),
                    .allocated_count = 0,
                    .max_size = max_size,
                };
                try pool.free_objects.ensureTotalCapacity(initial_size);
                return pool;
            }
            
            pub fn acquire(self: *@This()) !*u8 {
                if (self.free_objects.popOrNull()) |obj| {
                    return obj;
                }
                if (self.allocated_count >= self.max_size) {
                    return error.PoolExhausted;
                }
                const obj = try self.allocator.create(u8);
                self.allocated_count += 1;
                return obj;
            }
            
            pub fn release(self: *@This(), obj) *u8) void {
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
    };
    
    const pool = try ObjectPool(u8).init(allocator, 10, 100);
    
    var objects: [10]*u8 = undefined;
    for (0..10) |i| {
        objects[i] = try pool.acquire();
    }
    
    for (objects) |obj| {
        pool.release(obj);
    }
    
    pool.deinit();
}

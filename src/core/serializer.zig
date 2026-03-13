const std = @import("std");

pub const Serializer = struct {
    allocator: std.mem.Allocator,
    buffer: std.ArrayList(u8),
    string_cache: std.StringHashMap(void),

    pub fn init(allocator: std.mem.Allocator) !*Serializer {
        const serializer = try allocator.create(Serializer);
        serializer.* = .{
            .allocator = allocator,
            .buffer = std.ArrayList(u8).init(allocator),
            .string_cache = std.StringHashMap(void).init(allocator),
        };
        return serializer;
    }

    pub fn reset(self: *Serializer) void {
        self.buffer.clearRetainingCapacity();
        self.string_cache.clearRetainingCapacity();
    }

    pub fn serializeString(self: *Serializer, str: []const u8) !void {
        const len = @as(u32, @intCast(str.len));
        try self.buffer.appendSlice(std.mem.asBytes(&len));
        try self.buffer.appendSlice(str);
    }

    pub fn serializeU64(self: *Serializer, value: u64) !void {
        try self.buffer.appendSlice(std.mem.asBytes(&value));
    }

    pub fn serializeBool(self: *Serializer, value: bool) !void {
        const byte: u8 = if (value) 1 else 0;
        try self.buffer.append(byte);
    }

    pub fn serializeBytes(self: *Serializer, bytes: []const u8) !void {
        const len = @as(u32, @intCast(bytes.len));
        try self.serializeU32(len);
        try self.buffer.appendSlice(bytes);
    }

    pub fn serializeU32(self: *Serializer, value: u32) !void {
        try self.buffer.appendSlice(std.mem.asBytes(&value));
    }

    pub fn getBuffer(self: *Serializer) []const u8 {
        return self.buffer.items;
    }

    pub fn clear(self: *Serializer) void {
        self.buffer.clearRetainingCapacity();
    }

    pub fn deinit(self: *Serializer) void {
        self.buffer.deinit();
        self.string_cache.deinit();
        self.allocator.destroy(self);
    }
};

pub const Deserializer = struct {
    buffer: []const u8,
    offset: usize,

    pub fn init(buffer: []const u8) Deserializer {
        return .{
            .buffer = buffer,
            .offset = 0,
        };
    }

    pub fn deserializeString(self: *Deserializer) ![]const u8 {
        if (self.offset + 4 > self.buffer.len) return error.BufferUnderflow;
        
        const len_bytes = self.buffer[self.offset..self.offset + 4];
        const len = std.mem.bytesAsValue(u32, len_bytes).*;
        self.offset += 4;

        if (self.offset + len > self.buffer.len) return error.BufferUnderflow;
        
        const str = self.buffer[self.offset..self.offset + len];
        self.offset += len;
        return str;
    }

    pub fn deserializeU64(self: *Deserializer) !u64 {
        if (self.offset + 8 > self.buffer.len) return error.BufferUnderflow;
        
        const value = std.mem.bytesAsValue(u64, self.buffer[self.offset..self.offset + 8]).*;
        self.offset += 8;
        return value;
    }

    pub fn deserializeBool(self: *Deserializer) !bool {
        if (self.offset + 1 > self.buffer.len) return error.BufferUnderflow;
        
        const byte = self.buffer[self.offset];
        self.offset += 1;
        return byte == 1;
    }

    pub fn deserializeBytes(self: *Deserializer) ![]const u8 {
        const len = try self.deserializeU32();
        
        if (self.offset + len > self.buffer.len) return error.BufferUnderflow;
        
        const bytes = self.buffer[self.offset..self.offset + len];
        self.offset += len;
        return bytes;
    }

    pub fn deserializeU32(self: *Deserializer) !u32 {
        if (self.offset + 4 > self.buffer.len) return error.BufferUnderflow;
        
        const value = std.mem.bytesAsValue(u32, self.buffer[self.offset..self.offset + 4]).*;
        self.offset += 4;
        return value;
    }

    pub fn remaining(self: *Deserializer) usize {
        return self.buffer.len - self.offset;
    }
};

test "Serializer basic operations" {
    const allocator = std.testing.allocator;
    const serializer = try Serializer.init(allocator);
    defer serializer.deinit();

    try serializer.serializeU64(12345);
    try serializer.serializeString("hello");
    try serializer.serializeBool(true);

    const buffer = serializer.getBuffer();
    try std.testing.expect(buffer.len > 0);
}

test "Deserializer roundtrip" {
    const allocator = std.testing.allocator;
    const serializer = try Serializer.init(allocator);
    defer serializer.deinit();

    const test_u64: u64 = 123456789;
    const test_str = "test string";
    const test_bool = true;

    try serializer.serializeU64(test_u64);
    try serializer.serializeString(test_str);
    try serializer.serializeBool(test_bool);

    const buffer = try allocator.dupe(u8, serializer.getBuffer());
    defer allocator.free(buffer);

    var deserializer = Deserializer.init(buffer);

    const result_u64 = try deserializer.deserializeU64();
    try std.testing.expect(result_u64 == test_u64);

    const result_str = try deserializer.deserializeString();
    try std.testing.expect(std.mem.eql(u8, result_str, test_str));

    const result_bool = try deserializer.deserializeBool();
    try std.testing.expect(result_bool == test_bool);
}

test "Serializer bytes" {
    const allocator = std.testing.allocator;
    const serializer = try Serializer.init(allocator);
    defer serializer.deinit();

    const test_bytes = [_]u8{ 1, 2, 3, 4, 5 };
    try serializer.serializeBytes(&test_bytes);

    const buffer = try allocator.dupe(u8, serializer.getBuffer());
    defer allocator.free(buffer);

    var deserializer = Deserializer.init(buffer);
    const result_bytes = try deserializer.deserializeBytes();
    
    try std.testing.expect(result_bytes.len == test_bytes.len);
    try std.testing.expect(std.mem.eql(u8, result_bytes, &test_bytes));
}

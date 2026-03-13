const std = @import("std");

pub const Parameter = struct {
    name: []const u8,
    type: []const u8,
    required: bool,
    description: []const u8,
};

pub const ToolResult = struct {
    success: bool,
    data: ?[]const u8,
    err: ?[]const u8,
};

pub const Permission = enum {
    file_read,
    file_write,
    network,
       system,
    database,
};

pub const Tool = struct {
    name: []const u8,
    description: []const u8,
    parameters: []const Parameter,
    handler: *const fn (params: []const u8) anyerror!ToolResult,
    permissions: []const Permission = &.{},
    rate_limit: u32,
};

pub const ToolValidator = struct {
    pub fn validateParams(_: *ToolValidator, tool: *Tool, params: []const u8) !void {
        _ = tool;
        _ = params;
    }

    pub fn checkPermissions(_: *ToolValidator, tool: *Tool, context: *anyopaque) !void {
        _ = tool;
        _ = context;
    }

    pub fn checkRateLimit(_: *ToolValidator, tool: *Tool) !void {
        _ = tool;
    }
};

pub const MCPToolLoader = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) !*MCPToolLoader {
        const loader = try allocator.create(MCPToolLoader);
        loader.* = .{ .allocator = allocator };
        return loader;
    }

    pub fn loadFromConfig(_: *MCPToolLoader, config: []const u8) !void {
        _ = config;
    }

    pub fn loadTool(_: *MCPToolLoader, name: []const u8) !Tool {
        _ = name;
        return error.ToolNotFound;
    }

    pub fn deinit(self: *MCPToolLoader) void {
        self.allocator.destroy(self);
    }
};

pub const ToolsRegistry = struct {
    allocator: std.mem.Allocator,
    tools: std.StringHashMap(Tool),
    mcp_loader: ?*MCPToolLoader,
    validator: ToolValidator,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) !*ToolsRegistry {
        const registry = try allocator.create(ToolsRegistry);
        registry.* = .{
            .allocator = allocator,
            .tools = std.StringHashMap(Tool).init(allocator),
            .mcp_loader = null,
            .validator = .{},
            .mutex = .{},
        };
        return registry;
    }

    pub fn registerTool(self: *ToolsRegistry, tool: Tool) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const key = try self.allocator.dupe(u8, tool.name);
        try self.tools.put(key, tool);
    }

    pub fn unregisterTool(self: *ToolsRegistry, name: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.tools.fetchRemove(name)) |entry| {
            self.allocator.free(entry.key);
        }
    }

    pub fn getTool(self: *ToolsRegistry, name: []const u8) !*Tool {
        self.mutex.lock();
        defer self.mutex.unlock();

        return self.tools.getPtr(name) orelse error.ToolNotFound;
    }

    pub fn listTools(self: *ToolsRegistry) ![]Tool {
        self.mutex.lock();
        defer self.mutex.unlock();

        const tools = try self.allocator.alloc(Tool, self.tools.count());
        var i: usize = 0;
        var iter = self.tools.iterator();
        while (iter.next()) |entry| {
            tools[i] = entry.value_ptr.*;
            i += 1;
        }
        return tools;
    }

    pub fn callTool(self: *ToolsRegistry, name: []const u8, params: []const u8) !ToolResult {
        self.mutex.lock();
        defer self.mutex.unlock();

        const tool = self.tools.get(name) orelse return error.ToolNotFound;

        try self.validator.validateParams(&self.validator, tool, params);
        try self.validator.checkPermissions(&self.validator, tool, null);
        try self.validator.checkRateLimit(&self.validator, tool);

        return tool.handler(params);
    }

    pub fn deinit(self: *ToolsRegistry) void {
        self.mutex.lock();
        var iter = self.tools.iterator();
        var keys_to_free = std.ArrayList([]const u8).init(self.allocator);

        while (iter.next()) |entry| {
            keys_to_free.append(entry.key_ptr.*) catch {};
        }
        self.mutex.unlock();

        for (keys_to_free.items) |key| {
            self.allocator.free(key);
        }
        keys_to_free.deinit();

        self.tools.deinit();

        if (self.mcp_loader) |loader| {
            loader.deinit();
        }

        self.allocator.destroy(self);
    }
};

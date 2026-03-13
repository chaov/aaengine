const std = @import("std");

pub const SandboxConfig = struct {
    max_memory: usize = 64 * 1024 * 1024,
    max_cpu_time: u32 = 5000,
    max_file_handles: u32 = 32,
    allow_network: bool = false,
    allowed_paths: [][]const u8 = &.{},
};

pub const SandboxState = enum {
    created,
    running,
    suspended,
    terminated,
};

pub const ResourceUsage = struct {
    memory_used: usize,
    cpu_time_ms: u32,
    file_handles: u32,
    network_calls: u32,
};

pub const Sandbox = struct {
    id: u64,
    config: SandboxConfig,
    state: SandboxState,
    resource_usage: ResourceUsage,
    mutex: std.Thread.Mutex,

    pub fn init(id: u64, config: SandboxConfig) !*Sandbox {
        const sandbox = try std.heap.page_allocator.create(Sandbox);
        sandbox.* = .{
            .id = id,
            .config = config,
            .state = .created,
            .resource_usage = .{
                .memory_used = 0,
                .cpu_time_ms = 0,
                .file_handles = 0,
                .network_calls = 0,
            },
            .mutex = .{},
        };
        return sandbox;
    }

    pub fn execute(self: *Sandbox, code: []const u8) ![]const u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.state = .running;
        _ = code;

        return try std.heap.page_allocator.dupe(u8, "result");
    }

    pub fn deinit(self: *Sandbox) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        std.heap.page_allocator.destroy(self);
    }
};

pub const SandboxStrategy = struct {
    vtable: *const StrategyVTable,

    pub const StrategyVTable = struct {
        create: *const fn (*SandboxStrategy, config: SandboxConfig) anyerror!*Sandbox,
        destroy: *const fn (*SandboxStrategy, sandbox: *Sandbox) void,
        execute: *const fn (*SandboxStrategy, sandbox: *Sandbox, code: []const u8) anyerror![]const u8,
    };

    pub fn processIsolation() !*SandboxStrategy {
        const strategy = try std.heap.page_allocator.create(SandboxStrategy);
        strategy.* = .{
            .vtable = &process_vtable,
        };
        return strategy;
    }

    const process_vtable = StrategyVTable{
        .create = processCreate,
        .destroy = processDestroy,
        .execute = processExecute,
    };

    fn processCreate(_: *SandboxStrategy, config: SandboxConfig) !*Sandbox {
        const id = @as(u64, @intCast(std.time.nanoTimestamp()));
        return Sandbox.init(id, config);
    }

    fn processDestroy(_: *SandboxStrategy, sandbox: *Sandbox) void {
        sandbox.deinit();
    }

    fn processExecute(_: *SandboxStrategy, sandbox: *Sandbox, code: []const u8) ![]const u8 {
        return sandbox.execute(code);
    }
};

pub const SandboxManager = struct {
    allocator: std.mem.Allocator,
    sandboxes: std.AutoHashMap(u64, *Sandbox),
    strategy: *SandboxStrategy,
    next_sandbox_id: u64,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) !*SandboxManager {
        const manager = try allocator.create(SandboxManager);
        manager.* = .{
            .allocator = allocator,
            .sandboxes = std.AutoHashMap(u64, *Sandbox).init(allocator),
            .strategy = try SandboxStrategy.processIsolation(),
            .next_sandbox_id = 1,
            .mutex = .{},
        };
        return manager;
    }

    pub fn createSandbox(self: *SandboxManager, config: SandboxConfig) !*Sandbox {
        self.mutex.lock();
        defer self.mutex.unlock();

        const sandbox = try self.strategy.vtable.create(self.strategy, config);
        try self.sandboxes.put(sandbox.id, sandbox);
        return sandbox;
    }

    pub fn destroySandbox(self: *SandboxManager, id: u64) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.sandboxes.fetchRemove(id)) |entry| {
            self.strategy.vtable.destroy(self.strategy, entry.value);
        }
    }

    pub fn getSandbox(self: *SandboxManager, id: u64) !*Sandbox {
        self.mutex.lock();
        defer self.mutex.unlock();

        return self.sandboxes.get(id) orelse error.SandboxNotFound;
    }

    pub fn checkLimits(self: *SandboxManager, sandbox: *Sandbox) !void {
        _ = self;

        sandbox.mutex.lock();
        defer sandbox.mutex.unlock();

        if (sandbox.resource_usage.memory_used > sandbox.config.max_memory) {
            return error.MemoryLimitExceeded;
        }

        if (sandbox.resource_usage.cpu_time_ms > sandbox.config.max_cpu_time) {
            return error.CpuTimeLimitExceeded;
        }

        if (sandbox.resource_usage.file_handles > sandbox.config.max_file_handles) {
            return error.FileHandleLimitExceeded;
        }
    }

    pub fn deinit(self: *SandboxManager) void {
        self.mutex.lock();
        var iter = self.sandboxes.iterator();
        var sandboxes_to_cleanup = std.ArrayList(*Sandbox).init(self.allocator);

        while (iter.next()) |entry| {
            sandboxes_to_cleanup.append(entry.value_ptr.*) catch {};
        }
        self.mutex.unlock();

        for (sandboxes_to_cleanup.items) |sandbox| {
            self.strategy.vtable.destroy(self.strategy, sandbox);
        }
        sandboxes_to_cleanup.deinit();

        self.sandboxes.deinit();

        std.heap.page_allocator.destroy(self.strategy);
        self.allocator.destroy(self);
    }
};

const std = @import("std");

pub const InitPhase = enum {
    core,
    scheduler,
    plugins,
    complete,
};

pub const EngineConfig = struct {
    lazy_load_plugins: bool = true,
    enable_cache_warmup: bool = true,
    preload_modules: []const []const u8 = &.{},
};

pub const OptimizedEngine = struct {
    allocator: std.mem.Allocator,
    config: EngineConfig,
    init_phase: InitPhase,
    
    scheduler: ?*anyopaque = null,
    memory_manager: ?*anyopaque = null,
    event_loop: ?*anyopaque = null,
    context_manager: ?*anyopaque = null,
    tools_registry: ?*anyopaque = null,
    plugin_manager: ?*anyopaque = null,
    sandbox_manager: ?*anyopaque = null,
    
    cache_warmed: bool = false,
    init_start_time: u64 = 0,
    init_end_time: u64 = 0,

    pub fn init(allocator: std.mem.Allocator, config: EngineConfig) !*OptimizedEngine {
        const engine = try allocator.create(OptimizedEngine);
        engine.* = .{
            .allocator = allocator,
            .config = config,
            .init_phase = .core,
            .init_start_time = std.time.nanoTimestamp(),
        };

        try engine.initCore();
        
        if (config.enable_cache_warmup) {
            try engine.warmupCache();
        }

        engine.init_end_time = std.time.nanoTimestamp();
        return engine;
    }

    fn initCore(self: *OptimizedEngine) !void {
        const MemoryManager = @import("memory_manager.zig").MemoryManager;
        const EventLoop = @import("event_loop.zig").EventLoop;
        const ContextManager = @import("context_manager.zig").ContextManager;
        const ToolsRegistry = @import("tools_registry.zig").ToolsRegistry;

        self.memory_manager = try MemoryManager.init(self.allocator);
        self.event_loop = try EventLoop.init(self.allocator);
        self.context_manager = try ContextManager.init(self.allocator);
        self.tools_registry = try ToolsRegistry.init(self.allocator);
        
        self.init_phase = .core;
    }

    fn initScheduler(self: *OptimizedEngine) !void {
        if (self.scheduler != null) return;
        
        const AgentScheduler = @import("agent_scheduler.zig").AgentScheduler;
        const MemoryManager = @import("memory_manager.zig").MemoryManager;
        
        self.scheduler = try AgentScheduler.init(
            self.allocator, 
            @ptrCast(@alignCast(self.memory_manager))
        );
        
        self.init_phase = .scheduler;
    }

    fn initPlugins(self: *OptimizedEngine) !void {
        if (self.plugin_manager != null) return;
        
        const PluginManager = @import("plugin_manager.zig").PluginManager;
        const SandboxManager = @import("sandbox_manager.zig").SandboxManager;
        
        self.sandbox_manager = try SandboxManager.init(self.allocator);
        self.plugin_manager = try PluginManager.init(
            self.allocator, 
            @ptrCast(@alignCast(self.sandbox_manager))
        );
        
        self.init_phase = .plugins;
    }

    pub fn ensureScheduler(self: *OptimizedEngine) !void {
        if (self.scheduler == null) {
            try self.initScheduler();
        }
    }

    pub fn ensurePlugins(self: *OptimizedEngine) !void {
        if (self.plugin_manager == null) {
            try self.initPlugins();
        }
    }

    fn warmupCache(self: *OptimizedEngine) !void {
        const MemoryManager = @import("memory_manager.zig").MemoryManager;
        const mm = @ptrCast(*MemoryManager, @alignCast(self.memory_manager.?));

        var i: usize = 0;
        while (i < 16) : (i += 1) {
            const ptr = try mm.allocate(1024, .heap);
            mm.deallocate(ptr);
        }

        self.cache_warmed = true;
    }

    pub fn start(self: *OptimizedEngine) !void {
        try self.ensureScheduler();
        try self.ensurePlugins();

        const EventLoop = @import("event_loop.zig").EventLoop;
        const event_loop = @ptrCast(*EventLoop, @alignCast(self.event_loop.?));
        try event_loop.run();
    }

    pub fn stop(self: *OptimizedEngine) void {
        const EventLoop = @import("event_loop.zig").EventLoop;
        if (self.event_loop) |el| {
            const event_loop = @ptrCast(*EventLoop, @alignCast(el));
            event_loop.stop();
        }
    }

    pub fn getInitTime(self: *OptimizedEngine) u64 {
        return self.init_end_time - self.init_start_time;
    }

    pub fn getInitPhase(self: *OptimizedEngine) InitPhase {
        return self.init_phase;
    }

    pub fn isCacheWarmed(self: *OptimizedEngine) bool {
        return self.cache_warmed;
    }

    pub fn deinit(self: *OptimizedEngine) void {
        if (self.scheduler) |s| {
            const AgentScheduler = @import("agent_scheduler.zig").AgentScheduler;
            const scheduler = @ptrCast(*AgentScheduler, @alignCast(s));
            scheduler.deinit();
        }

        if (self.memory_manager) |m| {
            const MemoryManager = @import("memory_manager.zig").MemoryManager;
            const mm = @ptrCast(*MemoryManager, @alignCast(m));
            mm.deinit();
        }

        if (self.event_loop) |e| {
            const EventLoop = @import("event_loop.zig").EventLoop;
            const event_loop = @ptrCast(*EventLoop, @alignCast(e));
            event_loop.deinit();
        }

        if (self.context_manager) |c| {
            const ContextManager = @import("context_manager.zig").ContextManager;
            const cm = @ptrCast(*ContextManager, @alignCast(c));
            cm.deinit();
        }

        if (self.tools_registry) |t| {
            const ToolsRegistry = @import("tools_registry.zig").ToolsRegistry;
            const tr = @ptrCast(*ToolsRegistry, @alignCast(t));
            tr.deinit();
        }

        if (self.plugin_manager) |p| {
            const PluginManager = @import("plugin_manager.zig").PluginManager;
            const pm = @ptrCast(*PluginManager, @alignCast(p));
            pm.deinit();
        }

        if (self.sandbox_manager) |s| {
            const SandboxManager = @import("sandbox_manager.zig").SandboxManager;
            const sm = @ptrCast(*SandboxManager, @alignCast(s));
            sm.deinit();
        }

        self.allocator.destroy(self);
    }
};

test "Optimized engine lazy initialization" {
    const allocator = std.testing.allocator;
    const config = EngineConfig{
        .lazy_load_plugins = true,
        .enable_cache_warmup = false,
    };

    const engine = try OptimizedEngine.init(allocator, config);
    defer engine.deinit();

    try std.testing.expect(engine.getInitPhase() == .core);
    try std.testing.expect(engine.scheduler == null);

    try engine.ensureScheduler();
    try std.testing.expect(engine.scheduler != null);
    try std.testing.expect(engine.getInitPhase() == .scheduler);

    try engine.ensurePlugins();
    try std.testing.expect(engine.plugin_manager != null);
}

test "Optimized engine cache warmup" {
    const allocator = std.testing.allocator;
    const config = EngineConfig{
        .lazy_load_plugins = true,
        .enable_cache_warmup = true,
    };

    const engine = try OptimizedEngine.init(allocator, config);
    defer engine.deinit();

    try std.testing.expect(engine.isCacheWarmed());
}

test "Optimized engine init time" {
    const allocator = std.testing.allocator;
    const config = EngineConfig{
        .lazy_load_plugins = true,
        .enable_cache_warmup = true,
    };

    const engine = try OptimizedEngine.init(allocator, config);
    defer engine.deinit();

    const init_time_ns = engine.getInitTime();
    const init_time_ms = init_time_ns / 1_000_000;
    
    try std.testing.expect(init_time_ms < 50);
}

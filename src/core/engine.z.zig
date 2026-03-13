const std = @import("std");

pub const AgentScheduler = @import("agent_scheduler.zig").AgentScheduler;
pub const MemoryManager = @import("memory_manager.zig").MemoryManager;
pub const EventLoop = @import("event_loop.zig").EventLoop;
pub const ContextManager = @import("context_manager.zig").ContextManager;
pub const ToolsRegistry = @import("tools_registry.zig").ToolsRegistry;
pub const PluginManager = @import("plugin_manager.zig").PluginManager;
pub const SandboxManager = @import("sandbox_manager.zig").SandboxManager;

pub const Engine = struct {
    allocator: std.mem.Allocator,
    scheduler: *AgentScheduler,
    memory_manager: *MemoryManager,
    event_loop: *EventLoop,
    context_manager: *ContextManager,
    tools_registry: *ToolsRegistry,
    plugin_manager: *PluginManager,
    sandbox_manager: *SandboxManager,

    pub fn init(allocator: std.mem.Allocator) !*Engine {
        const engine = try allocator.create(Engine);
        engine.* = .{
            .allocator = allocator,
            .scheduler = undefined,
            .memory_manager = undefined,
            .event_loop = undefined,
            .context_manager = undefined,
            .tools_registry = undefined,
            .plugin_manager = undefined,
            .sandbox_manager = undefined,
        };

        engine.memory_manager = try MemoryManager.init(allocator);
        engine.event_loop = try EventLoop.init(allocator);
        engine.context_manager = try ContextManager.init(allocator);
        engine.tools_registry = try ToolsRegistry.init(allocator);
        engine.sandbox_manager = try SandboxManager.init(allocator);
        engine.plugin_manager = try PluginManager.init(allocator, engine.sandbox_manager);
        engine.scheduler = try AgentScheduler.init(allocator, engine.memory_manager);

        return engine;
    }

    pub fn deinit(self: *Engine) void {
        self.scheduler.deinit();
        self.memory_manager.deinit();
        self.event_loop.deinit();
        self.context_manager.deinit();
        self.tools_registry.deinit();
        self.plugin_manager.deinit();
        self.sandbox_manager.deinit();
        self.allocator.destroy(self);
    }

    pub fn start(self: *Engine) !void {
        try self.event_loop.run();
    }

    pub fn stop(self: *Engine) void {
        self.event_loop.stop();
    }
};

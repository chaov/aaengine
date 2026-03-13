const std = @import("std");
const Engine = @import("core/engine.z.zig").Engine;

pub fn main() !void {
    const allocator = std.heap.page_allocator;

    std.debug.print("AAEngine v1.0 - AI Agent Execution Engine\n", .{});
    std.debug.print("Initializing core engine...\n", .{});

    const engine = try Engine.init(allocator);
    defer engine.deinit();

    std.debug.print("Engine initialized successfully!\n", .{});
    std.debug.print("All core modules loaded:\n", .{});
    std.debug.print("  - Agent Scheduler\n", .{});
    std.debug.print("  - Memory Manager\n", .{});
    std.debug.print("  - Event Loop\n", .{});
    std.debug.print("  - Context Manager\n", .{});
    std.debug.print("  - Tools Registry\n", .{});
    std.debug.print("  - Plugin Manager\n", .{});
    std.debug.print("  - Sandbox Manager\n", .{});
    std.debug.print("\nEngine ready!\n", .{});
}

test "Engine initialization" {
    const allocator = std.testing.allocator;
    const engine = try Engine.init(allocator);
    defer engine.deinit();

    _ = engine.scheduler;
    _ = engine.memory_manager;
    _ = engine.event_loop;
}

test "Memory manager basic operations" {
    const allocator = std.testing.allocator;
    const mm = try @import("core/memory_manager.zig").MemoryManager.init(allocator);
    defer mm.deinit();

    const ptr = try mm.allocate(1024, .heap);
    defer mm.deallocate(ptr);

    try std.testing.expect(ptr.len == 1024);

    const stats = mm.getStats();
    try std.testing.expect(stats.allocation_count == 1);
}

test "Context manager basic operations" {
    const allocator = std.testing.allocator;
    const cm = try @import("core/context_manager.zig").ContextManager.init(allocator);
    defer cm.deinit();

    const context = try cm.createContext("test-agent");
    try std.testing.expect(std.mem.eql(u8, context.agent_id, "test-agent"));

    const retrieved = try cm.getContext("test-agent");
    try std.testing.expect(retrieved == context);
}

test "Tools registry basic operations" {
    const allocator = std.testing.allocator;
    const tr = try @import("core/tools_registry.zig").ToolsRegistry.init(allocator);
    defer tr.deinit();

    const tool = @import("core/tools_registry.zig").Tool{
        .name = "test-tool",
        .description = "Test tool",
        .parameters = &.{},
        .handler = testToolHandler,
        .permissions = &.{},
        .rate_limit = 100,
    };

    try tr.registerTool(tool);

    const retrieved = try tr.getTool("test-tool");
    try std.testing.expect(std.mem.eql(u8, retrieved.name, "test-tool"));
}

fn testToolHandler(_: []const u8) !@import("core/tools_registry.zig").ToolResult {
    return .{
        .success = true,
        .data = null,
        .err = null,
    };
}

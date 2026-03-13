const std = @import("std");
const testing = std.testing;

const AgentScheduler = @import("../../src/core/agent_scheduler.zig").AgentScheduler;
const TaskPriority = @import("../../src/core/agent_scheduler.zig").TaskPriority;
const AgentTask = @import("../../src/core/agent_scheduler.zig").AgentTask;
const MemoryManager = @import("../../src/core/memory_manager.zig").MemoryManager;

var task_executed: bool = false;

fn testTaskCallback(task: *AgentTask) anyerror!void {
    _ = task;
    task_executed = true;
}

test "AgentScheduler - initialization" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    try testing.expect(!scheduler.running);
}

test "AgentScheduler - submit task with normal priority" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    task_executed = false;

    const task = AgentTask{
        .id = 1,
        .agent_id = 1,
        .priority = .normal,
        .callback = testTaskCallback,
        .context = null,
        .created_at = 0,
        .timeout_ms = 1000,
    };

    try scheduler.submitTask(task);
}

test "AgentScheduler - submit task with system priority" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    const task = AgentTask{
        .id = 2,
        .agent_id = 1,
        .priority = .system,
        .callback = testTaskCallback,
        .context = null,
        .created_at = 0,
        .timeout_ms = 1000,
    };

    try scheduler.submitTask(task);
}

test "AgentScheduler - submit task with critical priority" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    const task = AgentTask{
        .id = 3,
        .agent_id = 1,
        .priority = .critical,
        .callback = testTaskCallback,
        .context = null,
        .created_at = 0,
        .timeout_ms = 1000,
    };

    try scheduler.submitTask(task);
}

test "AgentScheduler - submit task with background priority" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    const task = AgentTask{
        .id = 4,
        .agent_id = 1,
        .priority = .background,
        .callback = testTaskCallback,
        .context = null,
        .created_at = 0,
        .timeout_ms = 1000,
    };

    try scheduler.submitTask(task);
}

test "AgentScheduler - priority ordering" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    try testing.expect(@intFromEnum(TaskPriority.system) < @intFromEnum(TaskPriority.critical));
    try testing.expect(@intFromEnum(TaskPriority.critical) < @intFromEnum(TaskPriority.normal));
    try testing.expect(@intFromEnum(TaskPriority.normal) < @intFromEnum(TaskPriority.background));
}

test "AgentScheduler - start and stop" {
    const allocator = testing.allocator;
    const memory_manager = try MemoryManager.init(allocator);
    defer memory_manager.deinit();

    const scheduler = try AgentScheduler.init(allocator, memory_manager);
    defer scheduler.deinit();

    scheduler.stop();
    try testing.expect(!scheduler.running);
}

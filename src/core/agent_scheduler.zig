const std = @import("std");

const MemoryManager = @import("memory_manager.zig").MemoryManager;

pub const TaskPriority = enum(u8) {
    system = 0,
    critical = 1,
    normal = 2,
    background = 3,
};

pub const AgentTask = struct {
    id: u64,
    agent_id: u64,
    priority: TaskPriority,
    callback: *const fn (*AgentTask) anyerror!void,
    context: ?*anyopaque,
    created_at: u64,
    timeout_ms: u32,
};

const TaskQueue = std.PriorityQueue(AgentTask, void, compareTasks);

fn compareTasks(_: void, a: AgentTask, b: AgentTask) std.math.Order {
    return std.math.order(a.priority, b.priority);
}

const Worker = struct {
    id: usize,
    thread: ?std.Thread,
    task_queue: *std.ArrayList(AgentTask),
    semaphore: *std.Thread.Semaphore,
    running: bool,
    mutex: std.Thread.Mutex,

    fn run(worker: *Worker) void {
        while (worker.running) {
            worker.semaphore.wait();
            
            worker.mutex.lock();
            if (worker.task_queue.items.len > 0) {
                var task = worker.task_queue.orderedRemove(0);
                worker.mutex.unlock();
                
                task.callback(&task) catch |err| {
                    std.debug.print("Task {} failed: {}\n", .{ task.id, err });
                };
            } else {
                worker.mutex.unlock();
            }
        }
    }
};

pub const WorkerPool = struct {
    allocator: std.mem.Allocator,
    workers: std.ArrayList(*Worker),
    task_queue: std.ArrayList(AgentTask),
    semaphore: std.Thread.Semaphore,

    pub fn init(allocator: std.mem.Allocator, num_workers: usize) !*WorkerPool {
        const pool = try allocator.create(WorkerPool);
        pool.* = .{
            .allocator = allocator,
            .workers = std.ArrayList(*Worker).init(allocator),
            .task_queue = std.ArrayList(AgentTask).init(allocator),
            .semaphore = .{},
        };

        try pool.workers.ensureTotalCapacity(num_workers);

        for (0..num_workers) |i| {
            const worker = try allocator.create(Worker);
            worker.* = .{
                .id = i,
                .thread = null,
                .task_queue = &pool.task_queue,
                .semaphore = &pool.semaphore,
                .running = true,
                .mutex = .{},
            };

            worker.thread = try std.Thread.spawn(.{}, Worker.run, .{worker});
            try pool.workers.append(worker);
        }

        return pool;
    }

    pub fn submit(self: *WorkerPool, task: AgentTask) !void {
        try self.task_queue.append(task);
        self.semaphore.post();
    }

    pub fn deinit(self: *WorkerPool) void {
        for (self.workers.items) |worker| {
            worker.running = false;
            self.semaphore.post();
            if (worker.thread) |thread| {
                thread.join();
            }
            self.allocator.destroy(worker);
        }
        self.workers.deinit();
        self.task_queue.deinit();
        self.allocator.destroy(self);
    }
};

pub const ResourceMonitor = struct {
    cpu_threshold: f32,
    memory_threshold: u64,

    pub fn init(cpu_threshold: f32, memory_threshold: u64) !*ResourceMonitor {
        const monitor = try std.heap.page_allocator.create(ResourceMonitor);
        monitor.* = .{
            .cpu_threshold = cpu_threshold,
            .memory_threshold = memory_threshold,
        };
        return monitor;
    }

    pub fn canAcceptTask(self: *ResourceMonitor) bool {
        const usage = self.getUsage();
        return usage.cpu < self.cpu_threshold and usage.memory < self.memory_threshold;
    }

    const ResourceUsage = struct {
        cpu: f32,
        memory: u64,
    };

    fn getUsage(self: *ResourceMonitor) ResourceUsage {
        _ = self;
        return .{ .cpu = 0.5, .memory = 10 * 1024 * 1024 };
    }

    pub fn deinit(self: *ResourceMonitor) void {
        std.heap.page_allocator.destroy(self);
    }
};

pub const AgentScheduler = struct {
    allocator: std.mem.Allocator,
    task_queues: [4]TaskQueue,
    worker_pool: *WorkerPool,
    resource_monitor: *ResourceMonitor,
    next_task_id: u64,
    running: bool,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator, memory_manager: *MemoryManager) !*AgentScheduler {
        _ = memory_manager;

        const scheduler = try allocator.create(AgentScheduler);
        scheduler.* = .{
            .allocator = allocator,
            .task_queues = undefined,
            .worker_pool = undefined,
            .resource_monitor = undefined,
            .next_task_id = 1,
            .running = false,
            .mutex = .{},
        };

        for (&scheduler.task_queues) |*queue| {
            queue.* = TaskQueue.init(allocator, {});
        }

        scheduler.worker_pool = try WorkerPool.init(allocator, 4);
        scheduler.resource_monitor = try ResourceMonitor.init(0.8, 100 * 1024 * 1024);

        return scheduler;
    }

    pub fn submitTask(self: *AgentScheduler, task: AgentTask) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.resource_monitor.canAcceptTask()) {
            return error.ResourceLimitExceeded;
        }

        try self.task_queues[@intFromEnum(task.priority)].add(task);
    }

    pub fn start(self: *AgentScheduler) !void {
        self.running = true;

        while (self.running) {
            for (&self.task_queues) |*queue| {
                if (queue.peek()) |task| {
                    _ = queue.remove();
                    try self.worker_pool.submit(task.*);
                }
            }

            std.time.sleep(1 * std.time.ns_per_ms);
        }
    }

    pub fn stop(self: *AgentScheduler) void {
        self.running = false;
    }

    pub fn deinit(self: *AgentScheduler) void {
        self.stop();
        self.worker_pool.deinit();
        self.resource_monitor.deinit();
        for (&self.task_queues) |*queue| {
            queue.deinit();
        }
        self.allocator.destroy(self);
    }
};

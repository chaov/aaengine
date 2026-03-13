const std = @import("std");

pub const EventType = enum {
    io_read,
    io_write,
    timer,
    signal,
    custom,
};

pub const EventHandler = struct {
    callback: *const fn (event: *Event) anyerror!void,
    context: ?*anyopaque,
};

pub const Event = struct {
    type: EventType,
    fd: i32,
    handler: EventHandler,
    data: ?*anyopaque,
};

pub const Timer = struct {
    id: u64,
    interval_ms: u32,
    callback: *const fn () anyerror!void,
    repeat: bool,
    next_fire: u64,
};

fn compareTimers(_: void, a: Timer, b: Timer) std.math.Order {
    return std.math.order(a.next_fire, b.next_fire);
}

const TimerQueue = std.PriorityQueue(Timer, void, compareTimers);

pub const EventObserver = struct {
    onEvent: *const fn (event: *Event) anyerror!void,
    onError: *const fn (err: anyerror) void,
};

pub const EventPoller = struct {
    vtable: *const VTable,

    pub const VTable = struct {
        wait: *const fn (*EventPoller, timeout_ms: u32) anyerror![]Event,
        notify: *const fn (*EventPoller, fd: i32) anyerror!void,
        deinit: *const fn (*EventPoller) void,
    };

    pub fn initLinux() !*EventPoller {
        const poller = try std.heap.page_allocator.create(EventPoller);
        poller.* = .{
            .vtable = &linux_vtable,
        };
        return poller;
    }

    const linux_vtable = VTable{
        .wait = linuxWait,
        .notify = linuxNotify,
        .deinit = linuxDeinit,
    };

    fn linuxWait(_: *EventPoller, timeout_ms: u32) ![]Event {
        _ = timeout_ms;
        const events = try std.heap.page_allocator.alloc(Event, 0);
        return events;
    }

    fn linuxNotify(_: *EventPoller, fd: i32) !void {
        _ = fd;
    }

    fn linuxDeinit(poller: *EventPoller) void {
        std.heap.page_allocator.destroy(poller);
    }
};

pub const EventLoop = struct {
    allocator: std.mem.Allocator,
    event_queue: std.ArrayList(Event),
    timer_queue: TimerQueue,
    observers: std.ArrayList(*EventObserver),
    poller: *EventPoller,
    running: bool,
    next_timer_id: u64,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) !*EventLoop {
        const loop = try allocator.create(EventLoop);
        loop.* = .{
            .allocator = allocator,
            .event_queue = std.ArrayList(Event).init(allocator),
            .timer_queue = TimerQueue.init(allocator, {}),
            .observers = std.ArrayList(*EventObserver).init(allocator),
            .poller = try EventPoller.initLinux(),
            .running = false,
            .next_timer_id = 1,
            .mutex = .{},
        };
        return loop;
    }

    pub fn addEventListener(self: *EventLoop, event: Event) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        try self.event_queue.append(event);
    }

    pub fn removeEventListener(self: *EventLoop, fd: i32) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        var i: usize = 0;
        while (i < self.event_queue.items.len) {
            if (self.event_queue.items[i].fd == fd) {
                _ = self.event_queue.orderedRemove(i);
            } else {
                i += 1;
            }
        }
    }

    pub fn addTimer(self: *EventLoop, interval_ms: u32, callback: *const fn () anyerror!void, repeat: bool) !u64 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const now = std.time.nanoTimestamp();
        const timer = Timer{
            .id = self.next_timer_id,
            .interval_ms = interval_ms,
            .callback = callback,
            .repeat = repeat,
            .next_fire = @intCast(now + @as(i128, interval_ms) * 1_000_000),
        };

        try self.timer_queue.add(timer);
        const id = self.next_timer_id;
        self.next_timer_id += 1;
        return id;
    }

    pub fn addObserver(self: *EventLoop, observer: *EventObserver) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        try self.observers.append(observer);
    }

    pub fn run(self: *EventLoop) !void {
        self.running = true;

        while (self.running) {
            self.checkTimers() catch |err| {
                std.debug.print("Timer check failed: {}\n", .{err});
            };

            const events = try self.poller.vtable.wait(self.poller, 100);
            defer self.allocator.free(events);

            for (events) |*event| {
                try self.processEvent(event);
            }

            for (self.event_queue.items) |*event| {
                try self.processEvent(event);
            }
        }
    }

    fn checkTimers(self: *EventLoop) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const now = std.time.nanoTimestamp();

        while (self.timer_queue.peek()) |peeked_timer| {
            if (peeked_timer.next_fire > now) break;

            const timer = self.timer_queue.remove();

            timer.callback() catch |err| {
                std.debug.print("Timer {} callback failed: {}\n", .{ timer.id, err });
            };

            if (timer.repeat) {
                var new_timer = timer;
                new_timer.next_fire = @intCast(now + @as(i128, timer.interval_ms) * 1_000_000);
                try self.timer_queue.add(new_timer);
            }
        }
    }

    fn processEvent(self: *EventLoop, event: *Event) !void {
        for (self.observers.items) |observer| {
            observer.onEvent(event) catch |err| {
                observer.onError(err);
            };
        }

        event.handler.callback(event) catch |err| {
            std.debug.print("Event handler failed: {}\n", .{err});
        };
    }

    pub fn stop(self: *EventLoop) void {
        self.running = false;
    }

    pub fn deinit(self: *EventLoop) void {
        self.mutex.lock();
        self.event_queue.deinit();
        self.timer_queue.deinit();
        self.observers.deinit();
        self.mutex.unlock();

        self.poller.vtable.deinit(self.poller);
        self.allocator.destroy(self);
    }
};

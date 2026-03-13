const std = @import("std");
const testing = std.testing;

const EventLoop = @import("../../src/core/event_loop.zig").EventLoop;
const EventType = @import("../../src/core/event_loop.zig").EventType;
const EventHandler = @import("../../src/core/event_loop.zig").EventHandler;
const Event = @import("../../src/core/event_loop.zig").Event;

var timer_fired: bool = false;
var event_handled: bool = false;

fn testTimerCallback() anyerror!void {
    timer_fired = true;
}

fn testEventHandler(event: *Event) anyerror!void {
    _ = event;
    event_handled = true;
}

fn testErrorHandler(err: anyerror) void {
    _ = err;
}

test "EventLoop - initialization" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    try testing.expect(!loop.running);
}

test "EventLoop - add timer" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    timer_fired = false;

    const timer_id = try loop.addTimer(100, testTimerCallback, false);
    try testing.expect(timer_id > 0);
}

test "EventLoop - add repeating timer" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    const timer_id = try loop.addTimer(100, testTimerCallback, true);
    try testing.expect(timer_id > 0);
}

test "EventLoop - add event listener" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    event_handled = false;

    const handler = EventHandler{
        .callback = testEventHandler,
        .context = null,
    };

    const event = Event{
        .type = .io_read,
        .fd = 1,
        .handler = handler,
        .data = null,
    };

    try loop.addEventListener(event);
}

test "EventLoop - add event observer" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    const observer = try allocator.create(@TypeOf(loop).EventObserver);
    observer.* = .{
        .onEvent = testEventHandler,
        .onError = testErrorHandler,
    };

    try loop.addObserver(observer);
}

test "EventLoop - remove event listener" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    const handler = EventHandler{
        .callback = testEventHandler,
        .context = null,
    };

    const event = Event{
        .type = .io_read,
        .fd = 1,
        .handler = handler,
        .data = null,
    };

    try loop.addEventListener(event);
    try loop.removeEventListener(1);
}

test "EventLoop - event types" {
    try testing.expectEqual(@as(u8, 0), @intFromEnum(EventType.io_read));
    try testing.expectEqual(@as(u8, 1), @intFromEnum(EventType.io_write));
    try testing.expectEqual(@as(u8, 2), @intFromEnum(EventType.timer));
    try testing.expectEqual(@as(u8, 3), @intFromEnum(EventType.signal));
    try testing.expectEqual(@as(u8, 4), @intFromEnum(EventType.custom));
}

test "EventLoop - start and stop" {
    const allocator = testing.allocator;
    const loop = try EventLoop.init(allocator);
    defer loop.deinit();

    loop.stop();
    try testing.expect(!loop.running);
}

const std = @import("std");

pub const MessageType = enum {
    user,
    assistant,
    system,
    tool_call,
    tool_result,
};

pub const Message = struct {
    id: u64,
    type: MessageType,
    content: []const u8,
    timestamp: u64,
    metadata: ?*MessageMetadata,
};

pub const MessageMetadata = struct {
    tool_name: ?[]const u8,
    tool_args: ?[]const u8,
    tokens_used: u32,
};

pub const ContextConfig = struct {
    max_history: usize = 100,
    max_tokens: usize = 4000,
    enable_rag: bool = true,
    compression_threshold: usize = 10,
};

pub const ContextStats = struct {
    message_count: usize,
    total_tokens: usize,
    last_access: u64,
};

pub const VectorStore = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) !*VectorStore {
        const store = try allocator.create(VectorStore);
        store.* = .{ .allocator = allocator };
        return store;
    }

    pub fn deinit(self: *VectorStore) void {
        self.allocator.destroy(self);
    }
};

pub const RAGEngine = struct {
    allocator: std.mem.Allocator,
    index: *VectorStore,

    pub fn init(allocator: std.mem.Allocator) !*RAGEngine {
        const engine = try allocator.create(RAGEngine);
        engine.* = .{
            .allocator = allocator,
            .index = try VectorStore.init(allocator),
        };
        return engine;
    }

    pub fn indexDocument(self: *RAGEngine, doc: []const u8) !void {
        _ = self;
        _ = doc;
    }

    pub fn search(self: *RAGEngine, query: []const u8, top_k: usize) ![]Message {
        _ = self;
        _ = query;
        _ = top_k;
        return &.{};
    }

    pub fn deinit(self: *RAGEngine) void {
        self.index.deinit();
        self.allocator.destroy(self);
    }
};

pub const AgentContext = struct {
    allocator: std.mem.Allocator,
    agent_id: []const u8,
    session_id: []const u8,
    session_id_owned: bool,
    messages: std.ArrayList(Message),
    vector_store: ?*VectorStore,
    stats: ContextStats,
    next_message_id: u64,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator, agent_id: []const u8, session_id: []const u8, session_id_owned: bool) !*AgentContext {
        const context = try allocator.create(AgentContext);
        context.* = .{
            .allocator = allocator,
            .agent_id = try allocator.dupe(u8, agent_id),
            .session_id = if (session_id_owned) session_id else try allocator.dupe(u8, session_id),
            .session_id_owned = session_id_owned,
            .messages = std.ArrayList(Message).init(allocator),
            .vector_store = null,
            .stats = .{
                .message_count = 0,
                .total_tokens = 0,
                .last_access = @intCast(std.time.nanoTimestamp()),
            },
            .next_message_id = 1,
            .mutex = .{},
        };
        return context;
    }

    pub fn addMessage(self: *AgentContext, message: Message) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        try self.messages.append(message);
        self.stats.message_count += 1;
        self.stats.last_access = @intCast(std.time.nanoTimestamp());
    }

    pub fn getHistory(self: *AgentContext, limit: usize) ![]Message {
        self.mutex.lock();
        defer self.mutex.unlock();

        const start = if (limit >= self.messages.items.len) 0 else self.messages.items.len - limit;
        const slice = self.messages.items[start..];
        const result = try self.allocator.alloc(Message, slice.len);
        @memcpy(result, slice);
        return result;
    }

    pub fn compress(self: *AgentContext) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        while (self.messages.items.len > 10) {
            const msg = self.messages.orderedRemove(0);
            if (msg.metadata) |meta| {
                self.allocator.destroy(meta);
            }
            self.allocator.free(msg.content);
        }
    }

    pub fn search(self: *AgentContext, query: []const u8, top_k: usize) ![]Message {
        _ = self;
        _ = query;
        _ = top_k;
        return &.{};
    }

    pub fn deinit(self: *AgentContext) void {
        self.mutex.lock();
        var messages_to_free = std.ArrayList(Message).init(self.allocator);
        messages_to_free.appendSlice(self.messages.items) catch {};
        self.mutex.unlock();

        for (messages_to_free.items) |msg| {
            if (msg.metadata) |meta| {
                self.allocator.destroy(meta);
            }
            self.allocator.free(msg.content);
        }
        messages_to_free.deinit();

        self.mutex.lock();
        self.messages.deinit();
        self.mutex.unlock();

        self.allocator.free(self.agent_id);
        if (self.session_id_owned) {
            self.allocator.free(self.session_id);
        }
        if (self.vector_store) |store| {
            store.deinit();
        }
        self.allocator.destroy(self);
    }
};

pub const ContextManager = struct {
    allocator: std.mem.Allocator,
    contexts: std.StringHashMap(*AgentContext),
    rag_engine: ?*RAGEngine,
    config: ContextConfig,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) !*ContextManager {
        const manager = try allocator.create(ContextManager);
        manager.* = .{
            .allocator = allocator,
            .contexts = std.StringHashMap(*AgentContext).init(allocator),
            .rag_engine = null,
            .config = .{},
            .mutex = .{},
        };
        return manager;
    }

    pub fn createContext(self: *ContextManager, agent_id: []const u8) !*AgentContext {
        self.mutex.lock();
        defer self.mutex.unlock();

        const session_id = try std.fmt.allocPrint(self.allocator, "{s}-{}", .{ agent_id, std.time.nanoTimestamp() });
        const context = try AgentContext.init(self.allocator, agent_id, session_id, true);
        try self.contexts.put(try self.allocator.dupe(u8, agent_id), context);
        return context;
    }

    pub fn getContext(self: *ContextManager, agent_id: []const u8) !*AgentContext {
        self.mutex.lock();
        defer self.mutex.unlock();

        const context = self.contexts.get(agent_id) orelse return error.ContextNotFound;
        return context;
    }

    pub fn deleteContext(self: *ContextManager, agent_id: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.contexts.fetchRemove(agent_id)) |entry| {
            self.allocator.free(entry.key);
            entry.value.deinit();
        }
    }

    pub fn deinit(self: *ContextManager) void {
        self.mutex.lock();
        var iter = self.contexts.iterator();
        var contexts_to_cleanup = std.ArrayList(*AgentContext).init(self.allocator);
        var keys_to_free = std.ArrayList([]const u8).init(self.allocator);

        while (iter.next()) |entry| {
            keys_to_free.append(entry.key_ptr.*) catch {};
            contexts_to_cleanup.append(entry.value_ptr.*) catch {};
        }
        self.mutex.unlock();

        for (contexts_to_cleanup.items) |context| {
            context.deinit();
        }
        contexts_to_cleanup.deinit();

        for (keys_to_free.items) |key| {
            self.allocator.free(key);
        }
        keys_to_free.deinit();

        self.contexts.deinit();

        if (self.rag_engine) |engine| {
            engine.deinit();
        }

        self.allocator.destroy(self);
    }
};

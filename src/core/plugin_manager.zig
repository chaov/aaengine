const std = @import("std");

const SandboxManager = @import("sandbox_manager.zig").SandboxManager;

pub const PluginState = enum {
    unloaded,
    loading,
    loaded,
    active,
    error_state,
};

pub const Plugin = struct {
    name: []const u8,
    version: []const u8,
    path: []const u8,
    state: PluginState,
    dependencies: [][]const u8,
    vtable: *const PluginVTable,
    context: ?*anyopaque,
};

pub const PluginVTable = struct {
    onLoad: *const fn (*Plugin) anyerror!void,
    onUnload: *const fn (*Plugin) void,
    onActivate: *const fn (*Plugin) anyerror!void,
    onDeactivate: *const fn (*Plugin) void,
};

pub const PluginType = enum {
    native,
    js,
    wasm,
};

pub const PluginLoader = struct {
    vtable: *const LoaderVTable,

    pub const LoaderVTable = struct {
        load: *const fn (*PluginLoader, path: []const u8) anyerror!*Plugin,
        unload: *const fn (*PluginLoader, plugin: *Plugin) void,
    };

    pub fn initNative() !*PluginLoader {
        const loader = try std.heap.page_allocator.create(PluginLoader);
        loader.* = .{
            .vtable = &native_vtable,
        };
        return loader;
    }

    const native_vtable = LoaderVTable{
        .load = nativeLoad,
        .unload = nativeUnload,
    };

    fn nativeLoad(_: *PluginLoader, path: []const u8) !*Plugin {
        _ = path;
        return error.NotImplemented;
    }

    fn nativeUnload(_: *PluginLoader, plugin: *Plugin) void {
        _ = plugin;
    }
};

pub const PluginLoaderFactory = struct {
    pub fn createLoader(_: *PluginLoaderFactory, plugin_type: PluginType) !*PluginLoader {
        return switch (plugin_type) {
            .native => PluginLoader.initNative(),
            .js => error.NotImplemented,
            .wasm => error.NotImplemented,
        };
    }
};

pub const PluginManager = struct {
    allocator: std.mem.Allocator,
    plugins: std.StringHashMap(*Plugin),
    loader_factory: PluginLoaderFactory,
    sandbox_manager: *SandboxManager,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator, sandbox_manager: *SandboxManager) !*PluginManager {
        const manager = try allocator.create(PluginManager);
        manager.* = .{
            .allocator = allocator,
            .plugins = std. StringHashMap(*Plugin).init(allocator),
            .loader_factory = .{},
            .sandbox_manager = sandbox_manager,
            .mutex = .{},
        };
        return manager;
    }

    pub fn loadPlugin(self: *PluginManager, path: []const u8) !*Plugin {
        self.mutex.lock();
        defer self.mutex.unlock();

        const plugin_type = self.detectPluginType(path);
        const loader = try self.loader_factory.createLoader(plugin_type);
        defer loader.vtable.unload(loader, null);

        const plugin = try loader.vtable.load(loader, path);
        try self.plugins.put(try self.allocator.dupe(u8, plugin.name), plugin);

        return plugin;
    }

    fn detectPluginType(_: *PluginManager, path: []const u8) PluginType {
        if (std.mem.endsWith(u8, path, ".so") or std.mem.endsWith(u8, path, ".dylib") or std.mem.endsWith(u8, path, ".dll")) {
            return .native;
        }
        if (std.mem.endsWith(u8, path, ".js") or std.mem.endsWith(u8, path, ".mjs")) {
            return .js;
        }
        if (std.mem.endsWith(u8, path, ".wasm")) {
            return .wasm;
        }
        return .native;
    }

    pub fn unloadPlugin(self: *PluginManager, name: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.plugins.fetchRemove(name)) |entry| {
            self.allocator.free(entry.key);
            entry.value.vtable.onUnload(entry.value);
        }
    }

    pub fn activatePlugin(self: *PluginManager, name: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const plugin = self.plugins.get(name) orelse return error.PluginNotFound;
        plugin.state = .active;
        try plugin.vtable.onActivate(plugin);
    }

    pub fn deactivatePlugin(self: *PluginManager, name: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const plugin = self.plugins.get(name) orelse return error.PluginNotFound;
        plugin.vtable.onDeactivate(plugin);
        plugin.state = .loaded;
    }

    pub fn getPlugin(self: *PluginManager, name: []const u8) !*Plugin {
        self.mutex.lock();
        defer self.mutex.unlock();

        return self.plugins.get(name) orelse error.PluginNotFound;
    }

    pub fn deinit(self: *PluginManager) void {
        self.mutex.lock();
        var iter = self.plugins.iterator();
        var keys_to_free = std.ArrayList([]const u8).init(self.allocator);

        while (iter.next()) |entry| {
            keys_to_free.append(entry.key_ptr.*) catch {};
        }
        self.mutex.unlock();

        for (keys_to_free.items) |key| {
            self.allocator.free(key);
        }
        keys_to_free.deinit();

        self.plugins.deinit();
        self.allocator.destroy(self);
    }
};

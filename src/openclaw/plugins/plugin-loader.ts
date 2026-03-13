export interface Plugin {
  name: string;
  version: string;
  path: string;
  dependencies: string[];
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

export interface PluginConfig {
  enabled: boolean;
  config: Record<string, unknown>;
}

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: Set<string> = new Set();

  async loadPlugin(pluginPath: string): Promise<Plugin> {
    const plugin = await this.loadPluginManifest(pluginPath);
    
    if (this.loadedPlugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already loaded`);
    }

    await this.resolveDependencies(plugin);
    
    if (plugin.onLoad) {
      await plugin.onLoad();
    }

    this.plugins.set(plugin.name, plugin);
    this.loadedPlugins.add(plugin.name);
    
    return plugin;
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.plugins.delete(pluginName);
    this.loadedPlugins.delete(pluginName);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  private async loadPluginManifest(pluginPath: string): Promise<Plugin> {
    const manifestPath = `${pluginPath}/package.json`;
    const manifest = await Bun.file(manifestPath).json();
    
    return {
      name: manifest.name,
      version: manifest.version,
      path: pluginPath,
      dependencies: manifest.dependencies || [],
    };
  }

  private async resolveDependencies(plugin: Plugin): Promise<void> {
    for (const dep of plugin.dependencies) {
      if (!this.loadedPlugins.has(dep)) {
        await this.loadPlugin(dep);
      }
    }
  }
}

export const pluginLoader = new PluginLoader();

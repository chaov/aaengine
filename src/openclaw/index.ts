export * from './core/agent-runtime.js';
export * from './llm/llm-provider.js';
export * from './channels/http-channels.js';
export * from './skills/skill-registry.js';
export * from './context/context-manager.js';
export * from './tools/tools-registry.js';
export * from './plugins/plugin-loader.js';

import { AgentRuntime, createAgent, type AgentConfig, type LLMProvider } from './core/agent-runtime.js';
import { createLLMProvider, type LLMConfig } from './llm/llm-provider.js';
import { createHTTPChannel, createWebSocketChannel } from './channels/http-channels.js';
import { skillRegistry } from './skills/skill-registry.js';
import { toolsRegistry } from './tools/tools-registry.js';
import { pluginLoader } from './plugins/plugin-loader.js';

export class OpenClawAdapter {
  private runtime: AgentRuntime;

  constructor(llmProvider: LLMProvider) {
    this.runtime = new AgentRuntime(llmProvider);
  }

  async initialize(config: AgentConfig): Promise<void> {
    await this.runtime.createAgent(config);
  }

  getRuntime(): AgentRuntime {
    return this.runtime;
  }

  getSkillRegistry() {
    return skillRegistry;
  }

  getToolsRegistry() {
    return toolsRegistry;
  }

  getPluginLoader() {
    return pluginLoader;
  }
}

export async function createOpenClawAdapter(config: {
  llm: LLMConfig;
  agent: AgentConfig;
}): Promise<OpenClawAdapter> {
  const llmProvider = createLLMProvider(config.llm);
  const adapter = new OpenClawAdapter(llmProvider);
  await adapter.initialize(config.agent);
  return adapter;
}

export function registerChannelFactory(type: string, factory: (config: any) => Promise<any>): void {
  const { channelFactories } = require('./core/agent-runtime.js');
  channelFactories.set(type, factory);
}

registerChannelFactory('http', createHTTPChannel);
registerChannelFactory('websocket', createWebSocketChannel);

export default OpenClawAdapter;

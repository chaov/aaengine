import type { Agent, AgentConfig, LLMProvider, ContextManager, ToolsRegistry, ChannelManager, SkillRegistry } from '../types/index.js';
import { Agent } from './agent.js';

export class AgentFactory {
  async createAgent(
    config: AgentConfig,
    llm: LLMProvider,
    contextManager: ContextManager,
    toolsRegistry: ToolsRegistry,
    channelManager: ChannelManager,
    skillRegistry: SkillRegistry
  ): Promise<Agent> {
    return new Agent(
      config,
      llm,
      contextManager,
      toolsRegistry,
      channelManager,
      skillRegistry
    );
  }
}

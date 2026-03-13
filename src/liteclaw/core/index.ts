import type { Agent, AgentConfig, LLMProvider } from '../types/index.js';
import { AgentFactory } from './agent-factory.js';
import { ContextManager } from '../context/context-manager.js';
import { ToolsRegistry } from '../tools/tools-registry.js';
import { ChannelManager } from '../channels/channel-manager.js';
import { SkillRegistry } from '../skills/skill-registry.js';

export * from './agent.js';
export * from './agent-factory.js';

export class AgentRuntime {
  private agents: Map<string, Agent>;
  private agentFactory: AgentFactory;

  constructor() {
    this.agents = new Map();
    this.agentFactory = new AgentFactory();
  }

  async createAgent(config: AgentConfig, llm: LLMProvider): Promise<Agent> {
    const contextManager = new ContextManager({
      maxHistory: 100,
      maxTokens: 4000,
      enable: false,
      compressionThreshold: 10
    });

    const toolsRegistry = new ToolsRegistry();
    const channelManager = new ChannelManager(config.channels);
    const skillRegistry = new SkillRegistry();

    const agent = await this.agentFactory.createAgent(
      config,
      llm,
      contextManager,
      toolsRegistry,
      channelManager,
      skillRegistry
    );

    this.agents.set(config.id.id, agent);
    return agent;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  async destroyAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.stop();
      this.agents.delete(id);
    }
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

import { contextManager } from '../context/context-manager.js';
import { toolsRegistry } from '../tools/tools-registry.js';
import { skillRegistry } from '../skills/skill-registry.js';
import { pluginLoader } from '../plugins/plugin-loader.js';

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  channels: ChannelConfig[];
}

export interface ChannelConfig {
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  id: string;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export class AgentRuntime {
  private agents: Map<string, Agent> = new Map();
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  async createAgent(config: AgentConfig): Promise<Agent> {
    const agent = new Agent(config, this.llmProvider);
    this.agents.set(config.id, agent);
    await agent.initialize();
    return agent;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  async destroyAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.destroy();
      this.agents.delete(id);
    }
  }
}

export class Agent {
  private contextId: string;
  private channels: Map<string, Channel> = new Map();

  constructor(
    private config: AgentConfig,
    private llmProvider: LLMProvider
  ) {
    this.contextId = `agent:${config.id}`;
    contextManager.createContext(config.id, 'default');
  }

  async initialize(): Promise<void> {
    for (const channelConfig of this.config.channels) {
      if (channelConfig.enabled) {
        const channel = await this.createChannel(channelConfig);
        this.channels.set(channelConfig.type, channel);
      }
    }
  }

  async processMessage(message: AgentMessage): Promise<AgentResponse> {
    contextManager.addMessage(this.contextId, message);

    const history = contextManager.getMessages(this.contextId);
    const response = await this.llmProvider.generate(history);

    contextManager.addMessage(this.contextId, {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
    });

    return response;
  }

  async executeTool(toolCall: ToolCall): Promise<unknown> {
    return await toolsRegistry.callTool(toolCall.name, toolCall.arguments);
  }

  async destroy(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.disconnect();
    }
    this.channels.clear();
  }

  private async createChannel(config: ChannelConfig): Promise<Channel> {
    const channelFactory = channelFactories.get(config.type);
    if (!channelFactory) {
      throw new Error(`Unknown channel type: ${config.type}`);
    }
    return await channelFactory(config);
  }
}

export interface LLMProvider {
  generate(messages: AgentMessage[]): Promise<AgentResponse>;
}

export interface Channel {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: AgentMessage): Promise<void>;
  onMessage(callback: (message: AgentMessage) => void): void;
}

const channelFactories = new Map<string, (config: ChannelConfig) => Promise<Channel>>();

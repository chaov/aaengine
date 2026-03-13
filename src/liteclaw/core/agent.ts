import { EventEmitter } from 'eventemitter3';
import type {
  AgentConfig,
  Message,
  Tool,
  LLMProvider,
  ContextManager,
  ToolsRegistry,
  ChannelManager,
  SkillRegistry,
  StreamHandler,
  AgentEvent
} from '../types/index.js';

export class Agent {
  private config: AgentConfig;
  private llm: LLMProvider;
  private contextManager: ContextManager;
  private toolsRegistry: ToolsRegistry;
  private channelManager: ChannelManager;
  private skillRegistry: SkillRegistry;
  private eventEmitter: EventEmitter;
  private running: boolean;

  constructor(
    config: AgentConfig,
    llm: LLMProvider,
    contextManager: ContextManager,
    toolsRegistry: ToolsRegistry,
    channelManager: ChannelManager,
    skillRegistry: SkillRegistry
  ) {
    this.config = config;
    this.llm = llm;
    this.contextManager = contextManager;
    this.toolsRegistry = toolsRegistry;
    this.channelManager = channelManager;
    this.skillRegistry = skillRegistry;
    this.eventEmitter = new EventEmitter();
    this.running = false;
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Agent is already running');
    }

    await this.channelManager.connect();
    this.running = true;
    this.emit('started', { timestamp: Date.now() });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.channelManager.disconnect();
    this.running = false;
    this.emit('stopped', { timestamp: Date.now() });
  }

  async processMessage(
    message: Message,
    streamHandler?: StreamHandler
  ): Promise<Message> {
    if (!this.running) {
      throw new Error('Agent is not running');
    }

    this.emit('message', {
      type: 'message',
      data: message,
      timestamp: Date.now()
    } as AgentEvent);

    const context = await this.contextManager.getContext(message.metadata?.sessionId || 'default');
    await context.addMessage(message);

    const history = await context.getHistory(this.config.maxTokens || 4000);
    const tools = await this.toolsRegistry.listTools();

    let response: Message;

    if (this.config.model.includes('stream') || streamHandler) {
      response = await this.processWithStreaming(history, tools, streamHandler);
    } else {
      response = await this.processWithoutStreaming(history, tools);
    }

    await context.addMessage(response);
    return response;
  }

  private async processWithStreaming(
    messages: Message[],
    tools: Tool[],
    streamHandler?: StreamHandler
  ): Promise<Message> {
    streamHandler?.onStart();

    let content = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    try {
      for await (const chunk of this.llm.generateStream(messages, { tools })) {
        if (chunk.type === 'content' && chunk.content) {
          content += chunk.content;
          streamHandler?.onChunk(chunk.content);
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          streamHandler?.onToolCall(chunk.toolCall);
        } else if (chunk.type === 'done') {
          break;
        }
      }

      for (const toolCall of toolCalls) {
        const result = await this.toolsRegistry.callTool(toolCall.name, toolCall.arguments);
        streamHandler?.onToolResult(result);
      }

      streamHandler?.onComplete();

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        toolCalls,
        toolResults: toolCalls.map(call => ({
          id: call.id,
          output: 'Tool executed'
        }))
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      streamHandler?.onError(err);
      throw err;
    }
  }

  private async processWithoutStreaming(
    messages: Message[],
    tools: Tool[]
  ): Promise<Message> {
    const response = await this.llm.generate(messages, { tools });

    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = [];

      for (const toolCall of response.toolCalls) {
        const result = await this.toolsRegistry.callTool(toolCall.name, toolCall.arguments);
        toolResults.push(result);
      }

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        toolCalls: response.toolCalls,
        toolResults
      };
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.content,
      timestamp: Date.now()
    };
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  private emit(event: string, data: unknown): void {
    this.eventEmitter.emit(event, data);
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.running;
  }
}

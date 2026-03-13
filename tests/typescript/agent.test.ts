import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../../src/liteclaw/core/agent.js';
import type { AgentConfig, Message, Tool } from '../../src/liteclaw/types/index.js';

describe('Agent', () => {
  let agent: Agent;
  let mockLLM: any;
  let mockContextManager: any;
  let mockToolsRegistry: any;
  let mockChannelManager: any;
  let mockSkillRegistry: any;

  beforeEach(() => {
    mockLLM = {
      generate: vi.fn().mockResolvedValue({
        content: 'Test response',
        toolCalls: []
      }),
      generateStream: vi.fn().mockImplementation(async function* () {
        yield { type: 'content', content: 'Test' };
        yield { type: 'content', content: ' response' };
        yield { type: 'done' };
      })
    };

    mockContextManager = {
      getContext: vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        addMessage: vi.fn().mockResolvedValue(undefined),
        getHistory: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue([]),
        compress: vi.fn().mockResolvedValue(undefined)
      })
    };

    mockToolsRegistry = {
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({
        id: crypto.randomUUID(),
        output: 'Tool result'
      })
    };

    mockChannelManager = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    mockSkillRegistry = {};

    const config: AgentConfig = {
      name: 'test-agent',
      model: 'gpt-4',
      maxTokens: 4000
    };

    agent = new Agent(
      config,
      mockLLM,
      mockContextManager,
      mockToolsRegistry,
      mockChannelManager,
      mockSkillRegistry
    );
  });

  it('should start the agent', async () => {
    await agent.start();
    expect(agent.isRunning()).toBe(true);
    expect(mockChannelManager.connect).toHaveBeenCalled();
  });

  it('should not start if already running', async () => {
    await agent.start();
    await expect(agent.start()).rejects.toThrow('Agent is already running');
  });

  it('should stop the agent', async () => {
    await agent.start();
    await agent.stop();
    expect(agent.isRunning()).toBe(false);
    expect(mockChannelManager.disconnect).toHaveBeenCalled();
  });

  it('should process message', async () => {
    await agent.start();

    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    const response = await agent.processMessage(message);
    expect(response).toBeDefined();
    expect(response.role).toBe('assistant');
    expect(mockContextManager.getContext).toHaveBeenCalled();
  });

  it('should fail to process message if not running', async () => {
    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    await expect(agent.processMessage(message)).rejects.toThrow('Agent is not running');
  });

  it('should handle streaming', async () => {
    await agent.start();

    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    const streamHandler = {
      onStart: vi.fn(),
      onChunk: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn()
    };

    const response = await agent.processMessage(message, streamHandler);
    expect(response).toBeDefined();
    expect(streamHandler.onStart).toHaveBeenCalled();
    expect(streamHandler.onComplete).toHaveBeenCalled();
  });

  it('should emit events', async () => {
    await agent.start();

    const eventHandler = vi.fn();
    agent.on('message', eventHandler);

    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    await agent.processMessage(message);
    expect(eventHandler).toHaveBeenCalled();
  });

  it('should get config', () => {
    const config = agent.getConfig();
    expect(config).toBeDefined();
    expect(config.name).toBe('test-agent');
    expect(config.model).toBe('gpt-4');
  });

  it('should handle tool calls', async () => {
    mockLLM.generate.mockResolvedValue({
      content: 'I will use a tool',
      toolCalls: [
        {
          id: 'call-1',
          name: 'test_tool',
          arguments: { param: 'value' }
        }
      ]
    });

    await agent.start();

    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Use a tool',
      timestamp: Date.now()
    };

    const response = await agent.processMessage(message);
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls?.length).toBe(1);
    expect(mockToolsRegistry.callTool).toHaveBeenCalled();
  });
});

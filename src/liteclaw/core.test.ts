import { describe, it, expect, beforeEach } from 'vitest';
import { ToolsRegistry, createBuiltinTools } from '../tools/index.js';
import { SkillRegistry, createBuiltinSkills } from '../skills/index.js';
import { ContextManager } from '../context/index.js';

describe('LiteClaw Core', () => {
  describe('ToolsRegistry', () => {
    let registry: ToolsRegistry;

    beforeEach(() => {
      registry = new ToolsRegistry();
    });

    it('should register and retrieve tools', () => {
      const tool = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: [],
        handler: async () => ({
          id: 'test',
          output: 'success'
        })
      };

      registry.registerTool(tool);
      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.getTool('test_tool')).toEqual(tool);
    });

    it('should call tool and return result', async () => {
      const tool = {
        name: 'echo',
        description: 'Echo tool',
        parameters: [
          {
            name: 'text',
            type: 'string',
            description: 'Text to echo',
            required: true
          }
        ],
        handler: async (params) => ({
          id: 'test',
          output: params.text as string
        })
      };

      registry.registerTool(tool);
      const result = await registry.callTool('echo', { text: 'hello' });

      expect(result.output).toBe('hello');
    });

    it('should list all tools', async () => {
      const builtinTools = createBuiltinTools();
      for (const tool of builtinTools) {
        registry.registerTool(tool);
      }

      const tools = await registry.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === 'get_current_time')).toBe(true);
    });
  });

  describe('SkillRegistry', () => {
    let registry: SkillRegistry;

    beforeEach(() => {
      registry = new SkillRegistry();
    });

    it('should register and retrieve skills', () => {
      const skill = {
        name: 'test_skill',
        version: '1.0.0',
        description: 'Test skill',
        execute: async () => ({
          success: true,
          output: 'success'
        })
      };

      registry.registerSkill(skill);
      expect(registry.hasSkill('test_skill')).toBe(true);
      expect(registry.getSkill('test_skill')).toEqual(skill);
    });

    it('should execute skill and return result', async () => {
      const skill = {
        name: 'greeting',
        version: '1.0.0',
        description: 'Greeting skill',
        execute: async () => ({
          success: true,
          output: 'Hello!'
        })
      };

      registry.registerSkill(skill);
      const result = await registry.executeSkill('greeting', {} as any);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello!');
    });
  });

  describe('ContextManager', () => {
    let contextManager: ContextManager;

    beforeEach(() => {
      contextManager = new ContextManager({
        maxHistory: 10,
        maxTokens: 4000,
        enableRAG: false,
        compressionThreshold: 5
      });
    });

    it('should create and retrieve context', async () => {
      const context = await contextManager.getContext('session-1');
      expect(context.sessionId).toBe('session-1');
    });

    it('should add and retrieve messages', async () => {
      const context = await contextManager.getContext('session-1');

      await context.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now()
      });

      const history = await context.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].content).toBe('Hello');
    });

    it('should search messages by query', async () => {
      const context = await contextManager.getContext('session-1');

      await context.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'What is the weather today?',
        timestamp: Date.now()
      });

      await context.addMessage({
        id: 'msg-2',
        role: 'assistant',
        content: 'The weather is sunny.',
        timestamp: Date.now()
      });

      const results = await context.search('weather');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

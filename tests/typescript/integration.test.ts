import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../src/liteclaw/context/context-manager.js';

describe('Integration Tests', () => {
  describe('Agent Workflow', () => {
    it('should handle complete message processing workflow', async () => {
      const contextManager = new ContextManager({
        maxHistory: 100,
        maxTokens: 4000,
        compressionThreshold: 10
      });

      const context = await contextManager.getContext('session-1');

      await context.addMessage({
        id: 'msg-1',
        role: 'system',
        content: 'You are a helpful assistant',
        timestamp: Date.now()
      });

      await context.addMessage({
        id: 'msg-2',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: Date.now()
      });

      const history = await context.getHistory();
      expect(history).toHaveLength(2);

      const searchResults = await context.search('hello');
      expect(searchResults.length).toBeGreaterThan(0);

      await contextManager.deleteContext('session-1');
      const contexts = await contextManager.listContexts();
      expect(contexts).not.toContain('session-1');
    });

    it('should handle context compression', async () => {
      const contextManager = new ContextManager({
        maxHistory: 10,
        maxTokens: 4000,
        compressionThreshold: 5
      });

      const context = await contextManager.getContext('session-1');

      for (let i = 0; i < 20; i++) {
        await context.addMessage({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      await context.compress();
      const history = await context.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should handle multiple sessions', async () => {
      const contextManager = new ContextManager({
        maxHistory: 100,
        maxTokens: 4000,
        compressionThreshold: 10
      });

      const sessionIds = ['session-1', 'session-2', 'session-3'];

      for (const sessionId of sessionIds) {
        const context = await contextManager.getContext(sessionId);
        await context.addMessage({
          id: `msg-${sessionId}`,
          role: 'user',
          content: `Message for ${sessionId}`,
          timestamp: Date.now()
        });
      }

      const contexts = await contextManager.listContexts();
      expect(contexts).toHaveLength(3);

      for (const sessionId of sessionIds) {
        const context = await contextManager.getContext(sessionId);
        const history = await context.getHistory();
        expect(history).toHaveLength(1);
      }
    });
  });

  describe('Tools Integration', () => {
    it('should register and call multiple tools', async () => {
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');
      const registry = new ToolsRegistry();

      const tools = [
        {
          name: 'tool1',
          description: 'Tool 1',
          parameters: [],
          handler: async () => ({ id: crypto.randomUUID(), output: 'result1' })
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          parameters: [],
          handler: async () => ({ id: crypto.randomUUID(), output: 'result2' })
        },
        {
          name: 'tool3',
          description: 'Tool 3',
          parameters: [],
          handler: async () => ({ id: crypto.randomUUID(), output: 'result3' })
        }
      ];

      for (const tool of tools) {
        registry.registerTool(tool);
      }

      const allTools = await registry.listTools();
      expect(allTools).toHaveLength(3);

      for (const tool of tools) {
        const result = await registry.callTool(tool.name, {});
        expect(result.error).toBeUndefined();
        expect(result.output).toContain('result');
      }
    });

    it('should handle tool with parameters', async () => {
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');
      const registry = new ToolsRegistry();

      const tool = {
        name: 'add',
        description: 'Add two numbers',
        parameters: [
          { name: 'a', type: 'number', description: 'First number', required: true },
          { name: 'b', type: 'number', description: 'Second number', required: true }
        ],
        handler: async (params: Record<string, unknown>) => ({
          id: crypto.randomUUID(),
          output: String((params.a as number) + (params.b as number))
        })
      };

      registry.registerTool(tool);
      const result = await registry.callTool('add', { a: 5, b: 3 });
      expect(result.output).toBe('8');
    });
  });

  describe('Error Handling', () => {
    it('should handle context errors gracefully', async () => {
      const contextManager = new ContextManager({
        maxHistory: 100,
        maxTokens: 4000,
        compressionThreshold: 10
      });

      const context = await contextManager.getContext('session-1');

      await context.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now()
      });

      await contextManager.deleteContext('session-1');

      const contexts = await contextManager.listContexts();
      expect(contexts).not.toContain('session-1');
    });

    it('should handle tool errors', async () => {
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');
      const registry = new ToolsRegistry();

      const tool = {
        name: 'failing_tool',
        description: 'A tool that fails',
        parameters: [],
        handler: async () => {
          throw new Error('Tool execution failed');
        }
      };

      registry.registerTool(tool);
      const result = await registry.callTool('failing_tool', {});
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Tool execution failed');
    });
  });
});

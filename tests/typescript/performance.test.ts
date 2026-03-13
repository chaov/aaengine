import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  describe('MemoryManager Performance', () => {
    it('should allocate and deallocate 10000 times efficiently', async () => {
      const { MemoryManager } = await import('../../src/liteclaw/performance/memory-manager.js');
      const manager = new MemoryManager();

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        const ptr = manager.allocate(1024, 'heap');
        manager.deallocate(ptr);
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(1000);
      console.log(`10000 allocations/deallocations: ${duration.toFixed(2)}ms`);
    });

    it('should handle large allocations efficiently', async () => {
      const { MemoryManager } = await import('../../src/liteclaw/performance/memory-manager.js');
      const manager = new MemoryManager();

      const start = performance.now();

      const allocations: Buffer[] = [];
      for (let i = 0; i < 100; i++) {
        allocations.push(manager.allocate(1024 * 1024, 'heap'));
      }

      for (const ptr of allocations) {
        manager.deallocate(ptr);
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(500);
      console.log(`100MB allocation/deallocation: ${duration.toFixed(2)}ms`);
    });
  });

  describe('ContextManager Performance', () => {
    it('should add 1000 messages efficiently', async () => {
      const { ContextManager } = await import('../../src/liteclaw/context/context-manager.js');
      const contextManager = new ContextManager({
        maxHistory: 1000,
        maxTokens: 4000,
        compressionThreshold: 100
      });

      const context = await contextManager.getContext('perf-test');

      const start = performance.now();

      for for (let i = 0; i < 1000; i++) {
        await context.addMessage({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i} with some content`,
          timestamp: Date.now()
        });
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100);
      console.log(`1000 message additions: ${duration.toFixed(2)}ms`);
    });

    it('should search 1000 messages efficiently', async () => {
      const { ContextManager } = await import('../../src/liteclaw/context/context-manager.js');
      const contextManager = new ContextManager({
        maxHistory: 1000,
        maxTokens: 4000,
        compressionThreshold: 100
      });

      const context = await contextManager.getContext('perf-test');

      for (let i = 0; i < 1000; i++) {
        await context.addMessage({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i} with search keyword test`,
          timestamp: Date.now()
        });
      }

      const start = performance.now();

      const results = await context.search('test');

      const end = performance.now();
      const duration = end - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50);
      console.log(`Search in 1000 messages: ${duration.toFixed(2)}ms`);
    });
  });

  describe('ToolsRegistry Performance', () => {
    it('should register 100 tools efficiently', async () => {
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');
      const registry = new ToolsRegistry();

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        registry.registerTool({
          name: `tool-${i}`,
          description: `Tool ${i}`,
          parameters: [],
          handler: async () => ({ id: crypto.randomUUID(), output: `result-${i}` })
        });
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(10);
      console.log(`100 tool registrations: ${duration.toFixed(2)}ms`);
    });

    it('should call tool 1000 times efficiently', async () => {
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');
      const registry = new ToolsRegistry();

      registry.registerTool({
        name: 'fast_tool',
        description: 'Fast tool',
        parameters: [],
        handler: async () => ({ id: crypto.randomUUID(), output: 'result' })
      });

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        await registry.callTool('fast_tool', {});
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100);
      console.log(`1000 tool calls: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Startup Time', () => {
    it('should initialize agent quickly', async () => {
      const start = performance.now();

      const { Agent } = await import('../../src/liteclaw/core/agent.js');
      const { ContextManager } = await import('../../src/liteclaw/context/context-manager.js');
      const { ToolsRegistry } = await import('../../src/liteclaw/tools/tools-registry.js');

      const contextManager = new ContextManager({
        maxHistory: 100,
        maxTokens: 4000,
        compressionThreshold: 10
      });

      const toolsRegistry = new ToolsRegistry();

      const mockLLM = {
        generate: async () => ({ content: 'response', toolCalls: [] }),
        generateStream: async function* () {
          yield { type: 'content', content: 'response' };
          yield { type: 'done' };
        }
      };

      const mockChannelManager = {
        connect: async () => {},
        disconnect: async () => {}
      };

      const agent = new Agent(
        { name: 'test', model: 'gpt-4', maxTokens: 4000 },
        mockLLM,
        contextManager,
        toolsRegistry,
        mockChannelManager,
        {}
      );

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(50);
      console.log(`Agent initialization: ${duration.toFixed(2)}ms`);
    });
  });
});

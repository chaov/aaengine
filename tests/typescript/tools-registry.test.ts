import { describe, it, expect, beforeEach } from 'vitest';
import { ToolsRegistry, createBuiltinTools } from '../../src/liteclaw/tools/tools-registry.js';

describe('ToolsRegistry', () => {
  let registry: ToolsRegistry;

  beforeEach(() => {
    registry = new ToolsRegistry();
  });

  it('should register a tool', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: [],
      handler: async () => ({
        id: crypto.randomUUID(),
        output: 'success'
      })
    };

    registry.registerTool(tool);
    expect(registry.hasTool('test_tool')).toBe(true);
  });

  it('should get a registered tool', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: [],
      handler: async () => ({
        id: crypto.randomUUID(),
        output: 'success'
      })
    };

    registry.registerTool(tool);
    const retrieved = registry.getTool('test_tool');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test_tool');
  });

  it('should call a tool', async () => {
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
      handler: async (params: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        output: params.text as string
      })
    };

    registry.registerTool(tool);
    const result = await registry.callTool('echo', { text: 'hello' });
    
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('hello');
  });

  it('should return error for non-existent tool', async () => {
    const result = await registry.callTool('nonexistent', {});
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Tool not found');
  });

  it('should handle tool errors', async () => {
    const tool = {
      name: 'failing_tool',
      description: 'Failing tool',
      parameters: [],
      handler: async () => {
        throw new Error('Tool failed');
      }
    };

    registry.registerTool(tool);
    const result = await registry.callTool('failing_tool', {});
    
    expect(result.error).toBeDefined();
    expect(result.error).toBe('Tool failed');
  });

  it('should list all tools', async () => {
    const tool1 = {
      name: 'tool1',
      description: 'Tool 1',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    };

    const tool2 = {
      name: 'tool2',
      description: 'Tool 2',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    };

    registry.registerTool(tool1);
    registry.registerTool(tool2);

    const tools = await registry.listTools();
    expect(tools).toHaveLength(2);
  });

  it('should unregister a tool', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    };

    registry.registerTool(tool);
    expect(registry.hasTool('test_tool')).toBe(true);

    const removed = registry.unregisterTool('test_tool');
    expect(removed).toBe(true);
    expect(registry.hasTool('test_tool')).toBe(false);
  });

  it('should clear all tools', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test tool',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    };

    registry.registerTool(tool);
    registry.clear();
    expect(registry.hasTool('test_tool')).toBe(false);
  });
});

describe('Builtin Tools', () => {
  it('should create builtin tools', () => {
    const tools = createBuiltinTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should have get_current_time tool', () => {
    const tools = createBuiltinTools();
    const timeTool = tools.find(t => t.name === 'get_current_time');
    expect(timeTool).toBeDefined();
  });

  it('should have calculate tool', () => {
    const tools = createBuiltinTools();
    const calcTool = tools.find(t => t.name === 'calculate');
    expect(calcTool).toBeDefined();
  });

  it('should have echo tool', () => {
    const tools = createBuiltinTools();
    const echoTool = tools.find(t => t.name === 'echo');
    expect(echoTool).toBeDefined();
  });

  it('should execute get_current_time tool', async () => {
    const tools = createBuiltinTools();
    const timeTool = tools.find(t => t.name === 'get_current_time');
    
    if (timeTool) {
      const result = await timeTool.handler({});
      expect(result.output).toBeDefined();
      expect(typeof result.output).toBe('string');
    }
  });

  it('should execute echo tool', async () => {
    const tools = createBuiltinTools();
    const echoTool = tools.find(t => t.name === 'echo');
    
    if (echoTool) {
      const result = await echoTool.handler({ text: 'test' });
      expect(result.output).toBe('test');
    }
  });

  it('should execute calculate tool', async () => {
    const tools = createBuiltinTools();
    const calcTool = tools.find(t => t.name === 'calculate');
    
    if (calcTool) {
      const result = await calcTool.handler({ expression: '2 + 2' });
      expect(result.output).toBe('4');
    }
  });
});

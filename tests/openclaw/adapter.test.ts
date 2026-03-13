import { describe, it, expect, beforeEach } from 'bun:test';
import { createOpenClawAdapter } from '../src/openclaw/index.js';
import { createBuiltinTools } from '../src/openclaw/tools/builtin-tools.js';
import { createBuiltinSkills } from '../src/openclaw/skills/builtin-skills.js';

describe('OpenClaw Adapter', () => {
  let adapter: any;

  beforeEach(async () => {
    adapter = await createOpenClawAdapter({
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      },
      agent: {
        id: 'test-agent',
        name: 'Test Agent',
        model: 'gpt-4',
        channels: [],
      },
    });

    const toolsRegistry = adapter.getToolsRegistry();
    const builtinTools = createBuiltinTools();
    for (const tool of builtinTools) {
      toolsRegistry.registerTool(tool);
    }

    const skillRegistry = adapter.getSkillRegistry();
    const builtinSkills = createBuiltinSkills();
    for (const skill of builtinSkills) {
      skillRegistry.registerSkill(skill);
    }
  });

  describe('Agent Runtime', () => {
    it('should create an agent', async () => {
      const runtime = adapter.getRuntime();
      const agent = runtime.getAgent('test-agent');
      expect(agent).toBeDefined();
    });

    it('should process a message', async () => {
      const runtime = adapter.getRuntime();
      const agent = runtime.getAgent('test-agent');
      
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello!',
        timestamp: Date.now(),
      };

      const response = await agent.processMessage(message);
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('Tools Registry', () => {
    it('should register and call tools', async () => {
      const toolsRegistry = adapter.getToolsRegistry();
      
      const result = await toolsRegistry.callTool('get_time', {});
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle tool errors', async () => {
      const toolsRegistry = adapter.getToolsRegistry();
      
      const result = await toolsRegistry.callTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Skills Registry', () => {
    it('should register and execute skills', async () => {
      const skillRegistry = adapter.getSkillRegistry();
      const skill = skillRegistry.getSkill('greeting');
      expect(skill).toBeDefined();

      const context = {
        input: 'hello',
        tools: {},
        llm: {
          generate: async () => 'Test response',
        },
        metadata: {},
      };

      const result = await skillRegistry.executeSkill('greeting', context);
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should find skills by trigger', async () => {
      const skillRegistry = adapter.getSkillRegistry();
      const skills = skillRegistry.findSkillsByTrigger('hello');
      expect(skills.length).toBeGreaterThan(0);
      expect(skills[0].name).toBe('greeting');
    });
  });

  describe('Context Manager', () => {
    it('should create and manage contexts', () => {
      const { contextManager } = require('../src/openclaw/context/context-manager.js');
      
      const context = contextManager.createContext('agent-1', 'session-1');
      expect(context).toBeDefined();
      expect(context.id).toBe('agent-1:session-1');
    });

    it('should add and retrieve messages', () => {
      const { contextManager } = require('../src/openclaw/context/context-manager.js');
      
      const contextId = 'agent-1:session-1';
      contextManager.createContext('agent-1', 'session-1');
      
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Test message',
        timestamp: Date.now(),
      };

      contextManager.addMessage(contextId, message);
      const messages = contextManager.getMessages(contextId);
      
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Test message');
    });
  });
});

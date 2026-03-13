export * from './core/index.js';
export * from './channels/index.js';
export * from './llm/index.js';
export * from './skills/index.js';
export * from './context/index.js';
export * from './tools/index.js';
export * from './mcp/index.js';
export * from './streaming/index.js';
export * from './types/index.js';
export * from './utils/index.js';

import { AgentRuntime } from './core/index.js';
import { createLLMProvider } from './llm/index.js';
import { createBuiltinTools } from './tools/index.js';
import { createBuiltinSkills } from './skills/index.js';

export class LiteClaw {
  private runtime: AgentRuntime;

  constructor() {
    this.runtime = new AgentRuntime();
  }

  async initialize(config: {
    agentId: string;
    agentName: string;
    llm: {
      provider: 'openai' | 'anthropic' | 'ollama';
      apiKey?: string;
      baseUrl?: string;
      model: string;
    };
    channels?: Array<{
      type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'http' | 'websocket';
      enabled: boolean;
      config: Record<string, unknown>;
    }>;
  }): Promise<void> {
    const llm = createLLMProvider(config.llm);

    const agent = await this.runtime.createAgent(
      {
        id: config.agentId,
        name: config.agentName,
        model: config.llm.model,
        channels: config.channels || []
      },
      llm
    );

    const toolsRegistry = agent['toolsRegistry'] as any;
    const builtinTools = createBuiltinTools();
    for (const tool of builtinTools) {
      toolsRegistry.registerTool(tool);
    }

    const skillRegistry = agent['skillRegistry'] as any;
    const builtinSkills = createBuiltinSkills();
    for (const skill of builtinSkills) {
      skillRegistry.registerSkill(skill);
    }

    await agent.start();
  }

  getRuntime(): AgentRuntime {
    return this.runtime;
  }
}

export async function createLiteClaw(config: {
  agentId: string;
  agentName: string;
  llm: {
    provider: 'openai' | 'anthropic' | 'ollama';
    apiKey?: string;
    baseUrl?: string;
    model: string;
  };
  channels?: Array<{
    type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'http' | 'websocket';
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
}): Promise<LiteClaw> {
  const liteClaw = new LiteClaw();
  await liteClaw.initialize(config);
  return liteClaw;
}

export default LiteClaw;

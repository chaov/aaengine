import type { AgentMessage, AgentResponse, ToolCall } from './agent-runtime.js';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAIProvider {
  constructor(private config: LLMConfig) {}

  async generate(messages: AgentMessage[]): Promise<AgentResponse> {
    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      id: `resp-${Date.now()}`,
      content: choice.message.content,
      timestamp: Date.now(),
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }
}

export class AnthropicProvider {
  constructor(private config: LLMConfig) {}

  async generate(messages: AgentMessage[]): Promise<AgentResponse> {
    const response = await fetch(`${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content,
        })),
        system: messages.find(m => m.role === 'system')?.content,
        max_tokens: this.config.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0];

    return {
      id: `resp-${Date.now()}`,
      content: content.text,
      timestamp: Date.now(),
      toolCalls: data.content
        .filter((c: any) => c.type === 'tool_use')
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          arguments: c.input,
        })),
    };
  }
}

export class OllamaProvider {
  constructor(private config: LLMConfig) {}

  async generate(messages: AgentMessage[]): Promise<AgentResponse> {
    const response = await fetch(`${this.config.baseUrl || 'http://localhost:11434'}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        options: {
          num_predict: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: `resp-${Date.now()}`,
      content: data.message.content,
      timestamp: Date.now(),
    };
  }
}

export function createLLMProvider(config: LLMConfig): import('./agent-runtime.js').LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config) as any;
    case 'anthropic':
      return new AnthropicProvider(config) as any;
    case 'ollama':
      return new OllamaProvider(config) as any;
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

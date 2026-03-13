import type { LLMProvider, Message, LLMResponse, LLMStreamChunk, GenerateOptions } from '../types/index.js';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: { apiKey: string; baseUrl?: string; model: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model;
  }

  async generate(messages: Message[], options?: GenerateOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2048,
        tools: options?.tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: {
              type: 'object',
              properties: t.parameters.reduce((acc, p) => {
                acc[p.name] = {
                  type: p.type,
                  description: p.description
                };
                return acc;
              }, {} as Record<string, unknown>),
              required: t.parameters.filter(p => p.required).map(p => p.name)
            }
          }
        })),
        tool_choice: options?.toolChoice || 'auto'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const choice = data.choices[0];
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    }));

    return {
      content: choice.message.content || '',
      toolCalls,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  async *generateStream(messages: Message[], options?: GenerateOptions): AsyncIterable<LLMStreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2048,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{
                delta: {
                  content?: string;
                };
                finish_reason?: string;
              }>;
            };

            const choice = parsed.choices[0];
            if (choice.delta.content) {
              yield {
                type: 'content',
                content: choice.delta.content
              };
            }

            if (choice.finish_reason) {
              yield { type: 'done', done: true };
              return;
            }
          } catch (e) {
          }
        }
      }
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: { apiKey: string; baseUrl?: string; model: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model;
  }

  async generate(messages: Message[], options?: GenerateOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
        system: messages.find(m => m.role === 'system')?.content,
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      content: Array<{
        type: string;
        text?: string;
      }>;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    };

    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return {
      content: text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }

  async *generateStream(messages: Message[], options?: GenerateOptions): AsyncIterable<LLMStreamChunk> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
        system: messages.find(m => m.role === 'system')?.content,
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (constari line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data) as {
              type: string;
              delta?: {
                text?: string;
              };
              stop_reason?: string;
            };

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield {
                type: 'content',
                content: parsed.delta.text
              };
            }

            if (parsed.stop_reason) {
              yield { type: 'done', done: true };
              return;
            }
          } catch (e) {
          }
        }
      }
    }
  }
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: { baseUrl?: string; model: string }) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
  }

  async generate(messages: Message[], options?: GenerateOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.maxTokens || 2048
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      message: {
        content: string;
      };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message.content,
      usage: data.prompt_eval_count && data.eval_count ? {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens: data.prompt_eval_count + data.eval_count
      } : undefined
    };
  }

  async *generateStream(messages: Message[], options?: GenerateOptions): AsyncIterable<LLMStreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: true,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.maxTokens || 2048
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line) as {
            message?: {
              content: string;
            };
            done?: boolean;
          };

          if (data.message?.content) {
            yield {
              type: 'content',
              content: data.message.content
            };
          }

          if (data.done) {
            yield { type: 'done', done: true };
            return;
          }
        } catch (e) {
        }
      }
    }
  }
}

export function createLLMProvider(config: {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}): LLMProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI provider requires apiKey');
      }
      return new OpenAIProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model
      });
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('Anthropic provider requires apiKey');
      }
      return new AnthropicProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model
      });
    case 'ollama':
      return new OllamaProvider({
        baseUrl: config.baseUrl,
        model: config.model
      });
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

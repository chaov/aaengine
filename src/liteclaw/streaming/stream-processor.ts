import type { StreamHandler, LLMStreamChunk, ToolCall, ToolResult } from '../types/index.js';

export class StreamProcessor {
  private handlers: Map<string, StreamHandler>;

  constructor() {
    this.handlers = new Map();
  }

  registerHandler(id: string, handler: StreamHandler): void {
    this.handlers.set(id, handler);
  }

  unregisterHandler(id: string): void {
    this.handlers.delete(id);
  }

  async processStream(
    id: string,
    stream: AsyncIterable<LLMStreamChunk>
  ): Promise<void> {
    const handler = this.handlers.get(id);
    if (!handler) {
      throw new Error(`Stream handler not found: ${id}`);
    }

    handler.onStart();

    try {
      for await (const chunk of stream) {
        if (chunk.type === 'content' && chunk.content) {
          handler.onChunk(chunk.content);
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          handler.onToolCall(chunk.toolCall);
        } else if (chunk.type === 'done') {
          break;
        }
      }

      handler.onComplete();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      handler.onError(err(err));
      throw err;
    }
  }

  createDefaultHandler(): StreamHandler {
    let fullContent = '';

    return {
      onStart: () => {
        console.log('[Stream] Started');
      },
      onChunk: (chunk: string) => {
        process.stdout.write(chunk);
        fullContent += chunk;
      },
      onToolCall: (call: ToolCall) => {
        console.log(`\n[Stream] Tool call: ${call.name}`);
      },
      onToolResult: (result: ToolResult) => {
        console.log(`\n[Stream] Tool result: ${result.output}`);
      },
      onComplete: () => {
        console.log('\n[Stream] Completed');
      },
      onError: (error: Error) => {
        console.error(`[Stream] Error: ${error.message}`);
      }
    };
  }
}

export class StreamBuffer {
  private chunks: string[] = [];
  private toolCalls: ToolCall[] = [];
  private toolResults: ToolResult[] = [];
  private complete: boolean = false;
  private error: Error | null = null;

  addChunk(chunk: string): void {
    this.chunks.push(chunk);
  }

  addToolCall(call: ToolCall): void {
    this.toolCalls.push(call);
  }

  addToolResult(result: ToolResult): void {
    this.toolResults.push(result);
  }

  markComplete(): void {
    this.complete = true;
  }

  setError(error: Error): void {
    this.error = error;
  }

  getContent(): string {
    return this.chunks.join('');
  }

  getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  getToolResults(): ToolResult[] {
    return [...this.toolResults];
  }

  isComplete(): boolean {
    return this.complete;
  }

  hasError(): boolean {
    return this.error !== null;
  }

  getError(): Error | null {
    return this.error;
  }

  reset(): void {
    this.chunks = [];
    this.toolCalls = [];
    this.toolResults = [];
    this.complete = false;
    this.error = null;
  }
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Context {
  id: string;
  agentId: string;
  sessionId: string;
  messages: Message[];
  metadata: Record<string, unknown>;
}

export class ContextManager {
  private contexts: Map<string, Context> = new Map();

  createContext(agentId: string, sessionId: string): Context {
    const contextId = `${agentId}:${sessionId}`;
    const context: Context = {
      id: contextId,
      agentId,
      sessionId,
      messages: [],
      metadata: {},
    };

    this.contexts.set(contextId, context);
    return context;
  }

  getContext(contextId: string): Context | undefined {
    return this.contexts.get(contextId);
  }

  addMessage(contextId: string, message: Message): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.messages.push(message);
    }
  }

  getMessages(contextId: string, limit?: number): Message[] {
    const context = this.contexts.get(contextId);
    if (!context) {
      return [];
    }

    const messages = context.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  clearContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.messages = [];
    }
  }

  deleteContext(contextId: string): void {
    this.contexts.delete(contextId);
  }

  searchMessages(contextId: string, query: string): Message[] {
    const context = this.contexts.get(contextId);
    if (!context) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    return context.messages.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  compressContext(contextId: string, maxTokens: number): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      return;
    }

    let currentTokens = 0;
    const compressedMessages: Message[] = [];

    for (let i = context.messages.length - 1; i >= 0; i--) {
      const msg = context.messages[i];
      const msgTokens = msg.content.length / 4;

      if (currentTokens + msgTokens <= maxTokens) {
        compressedMessages.unshift(msg);
        currentTokens += msgTokens;
      }
    }

    context.messages = compressedMessages;
  }
}

export const contextManager = new ContextManager();

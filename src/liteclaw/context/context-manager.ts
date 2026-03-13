import type { Message, ContextConfig } from '../types/index.js';

export interface AgentContext {
  sessionId: string;
  addMessage(message: Message): Promise<void>;
  getHistory(limit?: number): Promise<Message[]>;
  search(query: string, topK?: number): Promise<Message[]>;
  compress(): Promise<void>;
}

export class ContextManager {
  private contexts: Map<string, AgentContext>;
  private config: ContextConfig;

  constructor(config: ContextConfig) {
    this.contexts = new Map();
    this.config = config;
  }

  async getContext(sessionId: string): Promise<AgentContext> {
    let context = this.contexts.get(sessionId);

    if (!context) {
      context = new DefaultAgentContext(sessionId, this.config);
      this->contexts.set(sessionId, context);
    }

    return context;
  }

  async deleteContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (context) {
      await context.compress();
      this.contexts.delete(sessionId);
    }
  }

  async listContexts(): Promise<string[]> {
    return Array.from(this.contexts.keys());
  }

  async compressAll(): Promise<void> {
    const promises = Array.from(this.contexts.values()).map(
      context => context.compress()
    );
    await Promise.all(promises);
  }
}

class DefaultAgentContext implements AgentContext {
  sessionId: string;
  private messages: Message[];
  private config: ContextConfig;

  constructor(sessionId: string, config: ContextConfig) {
    this.sessionId = sessionId;
    this.messages = [];
    this.config = config;
  }

  async addMessage(message: Message): Promise<void> {
    this.messages.push(message);

    if (this.messages.length > this.config.maxHistory) {
      await this.compress();
    }
  }

  async getHistory(limit?: number): Promise<Message[]> {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  async search(query: string, topK: number = 5): Promise<Message[]> {
    const queryLower = query.toLowerCase();

    const scored = this.messages.map(msg => {
      const contentLower = msg.content.toLowerCase();
      let score = 0;

      if (contentLower.includes(queryLower)) {
        score += 1;
      }

      const words = queryLower.split(/\s+/);
      for (const word of words) {
        if (contentLower.includes(word)) {
          score += 0.5;
        }
      }

      return { message: msg, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(s => s.score > 0)
      .slice(0, topK)
      .map(s => s.message);
  }

  async compress(): Promise<void> {
    if (this.messages.length <= this.config.compressionThreshold) {
      return;
    }

    const systemMessages = this.messages.filter(m => m.role === 'system');
    const recentMessages = this.messages.slice(-this.config.maxHistory);

    this.messages = [...systemMessages, ...recentMessages];
  }

  getTokenCount(): number {
    return this.messages.reduce((acc, msg) => {
      return acc + Math.ceil(msg.content.length / 4);
    }, 0);
  }
}

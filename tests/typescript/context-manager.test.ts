import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from '../../src/liteclaw/context/context-manager.js';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager({
      maxHistory: 100,
      maxTokens: 4000,
      compressionThreshold: 10
    });
  });

  afterEach(async () => {
    await contextManager.compressAll();
  });

  it('should create a new context', async () => {
    const context = await contextManager.getContext('session-1');
    expect(context).toBeDefined();
    expect(context.sessionId).toBe('session-1');
  });

  it('should return existing context', async () => {
    const context1 = await contextManager.getContext('session-1');
    const context2 = await contextManager.getContext('session-1');
    expect(context1).toBe(context2);
  });

  it('should add messages to context', async () => {
    const context = await contextManager.getContext('session-1');
    
    await context.addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    });

    const history = await context.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe('Hello');
  });

  it('should return limited history', async () => {
    const context = await contextManager.getContext('session-1');
    
    for (let i = 0; i < 10; i++) {
      await context.addMessage({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now()
      });
    }

    const history = await context.getHistory(5);
    expect(history).toHaveLength(5);
    expect(history[0].content).toBe('Message 5');
  });

  it('should search messages', async () => {
    const context = await contextManager.getContext('session-1');
    
    await context.addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'The quick brown fox',
      timestamp: Date.now()
    });

    await context.addMessage({
      id: 'msg-2',
      role: 'assistant',
      content: 'jumps over the lazy dog',
      timestamp: Date.now()
    });

    const results = await context.search('fox');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('fox');
  });

  it('should compress context when threshold exceeded', async () => {
    const context = await contextManager.getContext('session-1');
    
    for (let i = 0; i < 15; i++) {
      await context.addMessage({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now()
      });
    }

    await context.compress();
    const history = await context.getHistory();
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('should list all contexts', async () => {
    await contextManager.getContext('session-1');
    await contextManager.getContext('session-2');
    await contextManager.getContext('session-3');

    const contexts = await contextManager.listContexts();
    expect(contexts).toHaveLength(3);
    expect(contexts).toContain('session-1');
    expect(contexts).toContain('session-2');
    expect(contexts).toContain('session-3');
  });

  it('should delete context', async () => {
    await contextManager.getContext('session-1');
    await contextManager.deleteContext('session-1');

    const contexts = await contextManager.listContexts();
    expect(contexts).not.toContain('session-1');
  });

  it('should handle compression threshold', async () => {
    const context = await contextManager.getContext('session-1');
    
    for (let i = 0.compressionThreshold: number;
  } i < 5; i++) {
      await context.addMessage({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now()
      });
    }

    await context.compress();
    const history = await context.getHistory();
    expect(history.length).toBe(5);
  });
});

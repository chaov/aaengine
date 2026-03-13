#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';
import { join } from 'path';

const results = {
  timestamp: new Date().toISOString(),
  tests: [] as any[]
};

async function benchmark(name: string, fn: () => Promise<void> | void, iterations = 100) {
  const warmup = 10;
  
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p50 = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  const result = {
    name,
    iterations,
    avg: avg.toFixed(4),
    min: min.toFixed(4),
    max: max.toFixed(4),
    p50: p50.toFixed(4),
    p95: p95.toFixed(4),
    p99: p99.toFixed(4)
  };

  results.tests.push(result);
  console.log(`${name}:`);
  console.log(`  Average: ${avg.toFixed(4)}ms`);
  console.log(`  Min: ${min.toFixed(4)}ms`);
  console.log(`  Max: ${max.toFixed(4)}ms`);
  console.log(`  P50: ${p50.toFixed(4)}ms`);
  console.log(`  P95: ${p95.toFixed(4)}ms`);
  console.log(`  P99: ${p99.toFixed(4)}ms`);
  console.log();
}

async function runBenchmarks() {
  console.log('AAEngine Performance Benchmarks');
  console.log('===============================\n');

  await benchmark('Context Creation', async () => {
    const { ContextManager } = await import('../src/liteclaw/context/context-manager.js');
    const cm = new ContextManager({ maxHistory: 100, maxTokens: 4000, compressionThreshold: 10 });
    await cm.getContext('test');
  });

  await benchmark('Message Addition', async () => {
    const { ContextManager } = await import('../src/liteclaw/context/context-manager.js');
    const cm = new ContextManager({ maxHistory: 100, maxTokens: 4000, compressionThreshold: 10 });
    const ctx = await cm.getContext('test');
    await ctx.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Test message',
      timestamp: Date.now()
    });
  });

  await benchmark('Tool Registration', async () => {
    const { ToolsRegistry } = await import('../src/liteclaw/tools/tools-registry.js');
    const registry = new ToolsRegistry();
    registry.registerTool({
      name: 'test',
      description: 'Test',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    });
  });

  await benchmark('Tool Call', async () => {
    const { ToolsRegistry } = await import('../src/liteclaw/tools/tools-registry.js');
    const registry = new ToolsRegistry();
    registry.registerTool({
      name: 'test',
      description: 'Test',
      parameters: [],
      handler: async () => ({ id: crypto.randomUUID(), output: 'ok' })
    });
    await registry.callTool('test', {});
  });

  await benchmark('Context Search', async () => {
    const { ContextManager } = await import('../src/liteclaw/context/context-manager.js');
    const cm = new ContextManager({ maxHistory: 100, maxTokens: 4000, compressionThreshold: 10 });
    const ctx = await cm.getContext('test');
    await ctx.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Search test message',
      timestamp: Date.now()
    });
    await ctx.search('search');
  });

  const outputPath = join(__dirname, '../tests/reports/benchmark-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outputPath}`);
}

runBenchmarks().catch(console.error);

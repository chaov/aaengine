import { createLiteClaw } from './index.js';

async function main() {
  console.log('Starting LiteClaw Agent...\n');

  const agent = await createLiteClaw({
    agentId: 'demo-agent',
    agentName: 'Demo Assistant',
    llm: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
      model: 'gpt-4'
    },
    channels: [
      {
        type: 'http',
        enabled: true,
        config: { port: 3000 }
      }
    ]
  });

  console.log('Agent initialized successfully!\n');

  const runtime = agent.getRuntime();
  const myAgent = runtime.getAgent('demo-agent');

  if (!myAgent) {
    console.error('Agent not found!');
    return;
  }

  console.log('Processing message...\n');

  const response = await myAgent.processMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: 'Hello! Can you tell me the current time?',
    timestamp: Date.now()
  });

  console.log('\nResponse:', response.content);
  console.log('\nAgent is running:', myAgent.isRunning());

  await myAgent.stop();
  console.log('\nAgent stopped.');
}

main().catch(console.error);

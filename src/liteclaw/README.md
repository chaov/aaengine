# LiteClaw

Lightweight AI Agent implementation for AAEngine, inspired by OpenClaw.

## Features

- **Multi-Channel Support**: WhatsApp, Telegram, Discord, Slack, HTTP, WebSocket
- **LLM Integration**: OpenAI, Anthropic, Ollama (local models)
- **Tool System**: Extensible tool registry with built-in tools
- **Skill System**: Custom skills for agent capabilities
- **MCP Protocol**: Model Context Protocol support
- **Streaming**: Real-time streaming responses
- **Context Management**: Conversation history/memory
- **TypeScript**: Full type safety

## Installation

```bash
npm install liteclaw
```

## Quick Start

```typescript
import { createLiteClaw } from 'liteclaw';

const agent = await createLiteClaw({
  agentId: 'my-agent',
  agentName: 'My Assistant',
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
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

const runtime = agent.getRuntime();
const myAgent = runtime.getAgent('my-agent');

if (myAgent) {
  const response = await myAgent.processMessage({
    id: 'msg-1',
    role: 'user',
    content: 'Hello, how are you?',
    timestamp: Date.now()
  });

  console.log(response.content);
}
```

## Architecture

```
LiteClaw
├── Core (Agent, AgentRuntime)
├── Channels (WhatsApp, Telegram, Discord, etc.)
├── LLM (OpenAI, Anthropic, Ollama)
├── Skills (SkillRegistry)
├── Context (ContextManager)
├── Tools (ToolsRegistry)
├── MCP (MCPManager)
└── Streaming (StreamProcessor)
```

## License

MIT

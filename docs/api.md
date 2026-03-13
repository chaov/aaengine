# AAEngine API 文档

## 概述

AAEngine是一个轻量化的AI Agent执行引擎，专为移动端设备设计。它提供了高性能的JavaScript/TypeScript运行时环境，同时支持Agent框架的扩展。

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/chaov/aaengine.git
cd aaengine

# 构建AAEngine
zig build

# 运行AAEngine
./zig-out/bin/aaengine
```

### 第一个Agent

```javascript
import { createAgent } from './src/liteclaw/index.js';

const agent = await createAgent({
  agentId: 'my-agent',
  agentName: 'My Assistant',
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
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

// 处理消息
const response = await agent.processMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world!',
  timestamp: Date.now()
});

console.log(response.content);
```

---

## 核心 API

### Agent Runtime API

#### createAgent(config)

创建一个新的Agent实例。

**参数**：
- `agentId` (string) - Agent的唯一标识符
- `agentName` (string) - Agent的显示名称
- `llm` (object) - LLM配置
  - `provider` (string) - 'openai' | 'anthropic' | 'ollama'
  - `apiKey` (string) - API密钥
  - `model` (string) - 模型名称
  - `baseUrl` (string, optional) - 自定义API端点
- `channels` (array) - 通信渠道配置
  - `type` (string) - 'http' | 'websocket' | 'telegram' | 'discord'
  - `enabled` (boolean) - 是否启用
  - `config` (object) - 渠道特定配置
- `skills` (array, optional) - 技能列表
- `tools` (array, optional) - 工具列表
- `context` (object, optional) - 上下文配置
  - `maxHistory` (number) - 最大历史消息数
  - `maxTokens` (number) - 最大token数

**返回值**：
- `runtime` - AgentRuntime实例
- `getAgent(agentId)` - 获取指定Agent实例

#### AgentRuntime

Agent运行时实例，提供消息处理和工具调用能力。

**方法**：
- `processMessage(message)` - 处理用户消息
- `registerTool(tool)` - 注册自定义工具
- `registerSkill(skill)` - 注册技能
- `getContext()` - 获取当前上下文
- `clearContext()` - 清除上下文

**事件**：
- `on('message', callback)` - 消息事件
- `on('tool-call', callback)` - 工具调用事件
- `on('error', callback)` - 错误事件

---

## 通信渠道 API

### HTTP 渠道

```javascript
{
  type: 'http',
  enabled: true,
  config: {
    port: 3000,
    host: '0.0.0.0',
    cors: true
  }
}
```

### WebSocket 渠道

```javascript
{
  type: 'websocket',
  enabled: true,
  config: {
    url: 'ws://localhost:8080',
    reconnectInterval: 5000
  }
}
```

### Telegram 渠道

```javascript
{
  type: 'telegram',
  enabled: true,
  config: {
    botToken: process.env.TELEGRAM_BOT_TOKEN
  }
}
```

### Discord 渠道

```javascript
{
  type: 'discord',
  enabled: true,
  config: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID
  }
}
```

---

## 工具 API

### 注册工具

```javascript
agent.registerTool({
  name: 'calculator',
  description: '执行数学计算',
  parameters: {
    expression: {
      type: 'string',
      description: '要计算的数学表达式'
    }
  },
  handler: async (params) => {
    const result = eval(params.expression);
    return { result };
  }
});
```

### 内置工具

AAEngine提供以下内置工具：

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `time` | 获取当前时间 | 无 |
| `calculate` | 数学计算 | `expression` (string) |
| `echo` | 回显消息 | `message` (string) |
| `get_weather` | 获取天气 | `location` (string) |
| `search` | 网络搜索 | `query` (string) |

---

## 技能 API

### 注册技能

```javascript
agent.registerSkill({
  name: 'greeting',
  description: '友好问候',
  trigger: ['hello', 'hi', 'hey'],
  handler: async (context) => {
    return `Hello! I'm ${context.agentName}. How can I help you today?`;
  }
});
```

### 内置技能

| 技能名 | 描述 | 触发词 |
|--------|------|--------|
| `greeting` | 问候 | hello, hi, hey |
| `summarize` | 总结文本 | summarize, summary |
| `translate` | 翻译 | translate, 翻译 |
| `code_helper` | 代码辅助 | code, help |

---

## LLM 集成

### OpenAI

```javascript
llm: {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  baseUrl: 'https://api.openai.com/v1'
}
```

### Anthropic

```javascript
llm: {
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229'
}
```

### Ollama (本地模型)

```javascript
llm: {
  provider: 'ollama',
  model: 'llama2',
  baseUrl: 'http://localhost:11434'
}
```

---

## 上下文管理

### 获取上下文

```javascript
const context = agent.getContext();
console.log(context.history);  // 消息历史
console.log(context.metadata);  // 元数据
```

### 设置上下文

```javascript
agent.setContext({
  maxHistory: 50,
  maxTokens: 4000,
  metadata: {
    userId: 'user-123',
    sessionId: 'session-abc'
  }
});
```

---

## 错误处理

### 错误事件

```javascript
agent.on('error', (error) => {
  console.error('Error:', error);
  console.error('Code:', error.code);
  console.error('Message:', error.message);
});
```

### 错误类型

| 错误码 | 描述 |
|--------|------|
| `AGENT_NOT_FOUND` | Agent不存在 |
| `TOOL_CALL_FAILED` | 工具调用失败 |
| `LLM_ERROR` | LLM调用错误 |
| `CHANNEL_ERROR` | 通信渠道错误 |
| `CONTEXT_FULL` | 上下文已满 |

---

## 性能监控

### 获取性能指标

```javascript
const metrics = agent.getMetrics();
console.log('Memory:', metrics.memory);
console.log('CPU:', metrics.cpu);
console.log('Messages:', metrics.messageCount);
```

### 性能配置

```javascript
agent.setConfig({
  performance: {
    enableProfiling: true,
    logInterval: 60000,  // 每分钟
    maxMemory: 50 * 1024 * 1024  // 50MB
  }
});
```

---

## 高级用法

### 多Agent管理

```javascript
const agent1 = await createAgent({ agentId: 'agent-1', ... });
const agent2 = await createAgent({ agentId: 'agent-2', ... });

// Agent间通信
agent1.on('message', async (msg) => {
  if (msg.to === 'agent-2') {
    await agent2.processMessage(msg);
  }
});
```

### 流式响应

```javascript
const response = await agent.processMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Tell me a story',
  stream: true  // 启用流式响应
});

response.on('data', (chunk) => {
  console.log('Received chunk:', chunk);
});

response.on('end', () => {
  console.log('Response complete');
});
```

### 工具链

```javascript
agent.registerTool({
  name: 'search',
  description: '搜索网络',
  handler: async (params) => {
    const results = await searchWeb(params.query);
    
    // 将结果传递给另一个工具
    return await agent.callTool('summarize', {
      text: results.join('\n')
    });
  }
});
```

---

## 配置选项

### 完整配置示例

```javascript
import { createAgent } from './src/liteclaw/index.js';

const agent = await createAgent({
  // Agent标识
  agentId: 'my-agent',
  agentName: 'My Assistant',
  
  // LLM配置
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  },
  
  // 通信渠道
  channels: [
    {
      type: 'http',
      enabled: true,
      config: {
        port: 3000,
        host: '0.0.0.0',
        cors: true
      }
    },
    {
      type: 'websocket',
      enabled: true,
      config: {
        url: 'ws://localhost:8080',
        reconnectInterval: 5000
      }
    }
  ],
  
  // 技能
  skills: ['greeting', 'summarize', 'translate'],
  
  // 工具
  tools: [
    {
      name: 'calculator',
      description: '数学计算',
      parameters: {
        expression: {
          type: 'string',
          description: '数学表达式'
        }
      },
      handler: async (params) => {
        return { result: eval(params.expression) };
      }
    }
  ],
  
  // 上下文配置
  context: {
    maxHistory: 50,
    maxTokens: 4000
  },
  
  // 性能配置
  performance: {
    enableProfiling: true,
    logInterval: 60000,
    maxMemory: 50 * 1024 * 1024
  }
});

// 获取运行时
const runtime = agent.getRuntime();

// 处理消息
const response = await agent.processMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello!',
  timestamp: Date.now()
});

console.log(response.content);
```

---

## 最佳实践

### 1. 错误处理

始终处理可能的错误：

```javascript
try {
  const response = await agent.processMessage(message);
} catch (error) {
  console.error('Error processing message:', error);
  // 适当的错误恢复逻辑
}
```

### 2. 资源管理

及时释放不再需要的资源：

```javascript
// 使用完成后关闭Agent
await agent.shutdown();

// 或者使用自动清理
agent.setConfig({
  autoCleanup: true,
  cleanupInterval: 300000  // 5分钟
});
```

### 3. 安全性

验证所有用户输入：

```javascript
agent.registerTool({
  name: 'safe_eval',
  description: '安全的表达式计算',
  parameters: {
    expression: {
      type: 'string',
      description: '要计算的表达式'
    }
  },
  handler: async (params) => {
    // 输入验证
    if (!/^[0-9+\s\*\(\)\s*0-9+\s]*$/.test(params.expression)) {
      throw new Error('Invalid expression');
    }
    
    // 限制执行时间
    const result = await timeoutPromise(
      eval(params.expression),
      5000  // 5秒超时
    );
    
    return { result };
  }
});
```

### 4. 性能优化

使用批处理和流式响应：

```javascript
// 批处理消息
const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'user', content: 'How are you?' },
  { role: 'user', content: 'Tell me a joke' }
];

const responses = await Promise.all(
  messages.map(msg => agent.processMessage(msg))
);

// 使用流式响应
const response = await agent.processMessage({
  role: 'user',
  content: 'Write a long article',
  stream: true
});
```

---

## 故障排查

### 常见问题

**问题**: Agent不响应

**检查**:
```bash
# 检查AAEngine进程
ps aux | grep aaengine

# 检查日志
tail -f logs/aaengine.log

# 检查端口
netstat -tlnp | grep 3000
```

**问题**: 内存占用过高

**检查**:
```bash
# 查看内存使用
ps aux | grep aaengine | awk '{print $6/1024"KB}'

# 使用AAEngine内置的内存监控
const metrics = agent.getMetrics();
console.log('Memory usage:', metrics.memory);
```

**问题**: 工具调用失败

**检查**:
```javascript
agent.on('tool-call', (call) => {
  console.log('Tool called:', call.tool);
  console.log('Parameters:', call.params);
});

agent.on('error', (error) => {
  if (error.code === 'TOOL_CALL_FAILED') {
    console.error('Tool call failed:', error);
  }
});
```

---

## 更新日志

### 版本 0.1.0

- 初始版本发布
- 核心功能完成
- LiteClaw集成完成
- 安全修复完成
- 性能优化完成

### 版本 0.2.0 (计划)

- 增强的工具系统
- 改进的上下文管理
- 更好的错误处理
- 性能监控和诊断工具

---

## 支持与贡献

### 获取帮助

```bash
# 查看帮助信息
./zig-out/bin/aaengine --help

# 查看版本
./zig-out/bin/aaengine --version
```

### 报告问题

如果遇到问题，请：

1. 查看文档：`docs/api.md`
2. 查看示例：`examples/`
3. 提交Issue：https://github.com/chaov/aaengine/issues
4. 联系社区：https://discord.gg/aaengine

---

## 许可证

MIT License - 详见 LICENSE 文件

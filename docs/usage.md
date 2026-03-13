# AAEngine 使用指南

## 快速开始

### 环境要求

- **操作系统**：Linux、macOS、Windows
- **Zig版本**：0.11.0或更高
- **Node.js版本**：18.0.0或更高（用于LiteClaw）
- **内存**：建议至少512MB可用内存
- **磁盘空间**：至少1GB可用空间

### 安装AAEngine

```bash
# 1. 克隆仓库
git clone https://github.com/chaov/aaengine.git
cd aaengine

# 2. 构建AAEngine
zig build

# 3. 运行AAEngine
./zig-out/bin/aaengine
```

### 验证安装

```bash
# 检查版本
./zig-out/bin/aaengine --version

# 运行测试
./zig-out/bin/aaengine test

# 查看帮助
./zig-out/bin/aaengine --help
```

---

## 基础用法

### 运行简单的Agent

创建一个名为`my-agent`的Agent，配置OpenAI的GPT-4模型：

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
      config: { 
        port: 3000,
        host: '0.0.0.0',
        cors: true
      }
    }
  ]
});

const runtime = agent.getRuntime();
const myAgent = runtime.getAgent('my-agent');

// 处理用户消息
const response = await myAgent.processMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world!',
  timestamp: Date.now()
});

console.log('Response:', response.content);
```

### 运行HTTP服务器

`启动一个HTTP服务器监听3000端口：`

```javascript
import { createAgent } from './src/liteclaw/index.js';

const agent = await createAgent({
  agentId: 'http-server',
  agentName: 'HTTP Server Agent',
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  },
  channels: [
    {
      type: 'http',
      enabled: true,
      config: { 
        port: 3000,
        host: '0.0.0.0',
        cors: true
      }
    }
  ]
});

console.log('HTTP server running on port 3000');
```

访问：`http://localhost:3000`

---

## 高级用法

### 自定义工具

注册一个自定义工具来执行特定任务：

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
    try {
      const result = eval(params.expression);
      return { result };
    } catch (error) {
      throw new Error(`计算错误: ${error.message}`);
    }
  }
});
```

### 技能系统

注册一个技能来扩展Agent能力：

```javascript
agent.registerSkill({
  name: 'translator',
  description: '翻译文本',
  trigger: ['translate', '翻译', 'translate to'],
  handler: async (context) => {
    const text = context.lastMessage.content;
    const targetLanguage = context.parameters?.language || 'English';
    
    // 调用LLM进行翻译
    const response = await context.llm.chat([
      { role: 'system', content: `Translate the following to ${targetLanguage}:` },
      { role: 'user', content: text }
    ]);
    
    return response;
  }
});
```

### 多Agent协作

创建多个Agent进行协作：

```javascript
const agent1 = await createAgent({ agentId: 'agent-1', ... });
const agent2 = await createAgent({ agentId: 'agent-2', ... });

// Agent间通信
agent1.on('message', async (msg) => {
  if (msg.to === 'agent-2') {
    await agent2.processMessage(msg);
  }
});

agent2.on('message', async (msg) => {
  if (msg.to === 'agent-1') {
    await agent1.processMessage(msg);
  }
});
```

### 流式响应

启用流式响应以获得更好的用户体验：

```javascript
const response = await myAgent.processMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Tell me a long story',
  stream: true  // 启用流式响应
});

response.on('data', (chunk) => {
  console.log('Received chunk:', chunk);
  // 实时显示响应内容
});

response.on('end', () => {
  console.log('Response complete');
});
```

### 上下文管理

设置和管理Agent的上下文：

```javascript
// 设置上下文
agent.setContext({
  maxHistory: 50,
  maxTokens: 4000,
  metadata: {
    userId: 'user-123',
    sessionId: 'session-abc'
  }
});

// 获取上下文
const context = agent.getContext();
console.log('History:', context.history);
console.log('Metadata:', context.metadata);

// 清除上下文
agent.clearContext();
```

### 错误处理

监听和处理错误：

```javascript
agent.on('error', (error) => {
  console.error('Error:', error);
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  
  // 根据错误类型进行不同处理
  switch if (error.code) {
    case 'AGENT_NOT_FOUND':
      console.error('Agent不存在');
      break;
    case 'TOOL_CALL_FAILED':
      console.error('工具调用失败');
      break;
    case 'LLM_ERROR':
      console.error('LLM调用错误');
      break;
    default:
      console.error('未知错误');
  }
});
```

### 性能监控

获取和监控性能指标：

```javascript
const metrics = agent.getMetrics();
console.log('Memory:', metrics.memory);
console.log('CPU:', metrics.cpu);
console.log('Messages:', metrics.messageCount);
```

---

## 配置

### 环境变量

```bash
# OpenAI API密钥
export OPENAI_API_KEY='your-api-key-here'

# Anthropic API密钥
export ANTHROPIC_API_KEY='your-api-key-here'

# 日志级别
export AAENGINE_LOG_LEVEL='debug'  # debug | info | warn | error

# 最大内存限制（MB）
export AAENGINE_MAX_MEMORY=50

# 启用性能分析
export AAENGINE_ENABLE_PROFILING=true
```

### 配置文件

创建`aaengine.config.json`配置文件：

```json
{
  "agent": {
    "defaultModel": "gpt-4",
    "maxHistory": 50,
    "maxTokens": 4000

  },
  "channels": {
    "http": {
      "port": 3000,
      "host": "0.0.0.0",
      "cors": true
    }
  },
  "performance": {
    "enableProfiling": true,
    "logInterval": 60000,
    "maxMemory": 52428800
  },
  "logging": {
    "level": "info",
    "file": "aaengine.log"
  }
}
```

---

## 部署

### 生产环境部署

```bash
# 1. 构建优化版本
zig build -Doptimize=ReleaseFast

# 2. 测试构建
./zig-out/bin/aaengine test

# 3. 创建systemd服务（Linux）
sudo cp ./zig-out/bin/aaengine /usr/local/bin/aaengine
sudo chmod +x /usr/local/bin/aaengine

# 4. 创建systemd服务文件
sudo tee /etc/systemd/system/aaengine.service <<'EOF'
[Unit]
Description=AAEngine AI Agent Runtime
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/aaengine
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 5. 启用服务
sudo systemctl daemon-reload
sudo systemctl enable aaengine
sudo systemctl start aaengine

# 6. 检查状态
sudo systemctl status aaengine
```

### Docker部署

创建`Dockerfile`：

```dockerfile
FROM alpine:latest

# 安装依赖
RUN apk add --no-cache nodejs npm

# 复制AAEngine
COPY . /app
WORKDIR /app

# 构建AAEngine
RUN zig build -Doptimize=ReleaseFast

# 暴露端口
EXPOSE 3000

# 启动AAEngine
CMD ["./zig-out/bin/aaengine"]
```

构建和运行：

```bash
# 构建Docker镜像
docker build -t aaengine .

# 运行容器
docker run -p 3000:3000 aaengine
```

---

## 开发

### 添加新工具

1. 在`src/liteclaw/tools/`目录创建新工具文件
2. 实现工具的handler函数
3. 在Agent初始化时注册工具

示例：`src/liteclaw/tools/custom-tool.ts`

### 添加新技能

1. 在`src/liteclaw/skills/`目录创建新技能文件
2. 实现技能的handler函数
3. 在Agent初始化时注册技能

示例：`src/liteclaw/skills/custom-skill.ts`

### 添加新通信渠道

1. 在`src/liteclaw/channels/`目录创建新渠道适配器
2. 实现渠道的连接和消息处理
3. 在Agent配置中启用渠道

示例：`src/liteclaw/channels/custom-channel.ts`

### 修改核心引擎

1. 在`src/core/`目录修改Zig代码
2. 运行`zig build`重新构建
3. 测试修改后的功能

---

## 测试

### 运行测试

```bash
# 运行所有测试
./zig-out/bin/aaengine test

# 运行特定测试
./zig-out/bin/aaengine test memory_manager

# 运行TypeScript测试
cd src/liteclaw && npm test
```

### 性能测试

```bash
# 运行benchmark
node tests/benchmark/benchmark.ts

# 查看性能报告
cat tests/reports/benchmark-report.md
```

---

## 故障排查

### 常见问题

**问题**: Agent不响应

**检查**:
```bash
# 检查AAEngine进程
ps aux | grep aaengine

# 查看日志
tail -f logs/aaengine.log

# 检查端口占用
netstat -tlnp | grep 3000
```

**问题**: 内存占用过高

**检查**:
```bash
# 查看内存使用
ps aux | grep aaengineer | awk '{print $6/1024"KB}'

# 使用AAEngine内置的内存监控
./zig-out/bin/aaengine --metrics
```

**问题**: 工具调用失败

**检查**:
```bash
# 查看工具注册日志
grep -i "tool" logs/aaengine.log

# 检查工具定义
ls src/liteclaw/tools/
```

---

## 最佳实践

### 1. 安全性

- 始终验证用户输入
- 使用安全的工具调用方式（避免eval）
- 限制Agent的资源使用
- 实施适当的权限控制

### 2. 性能优化

- 使用批处理减少系统调用
- 实现消息队列优化吞吐量
- 使用对象池减少内存分配
- 启用流式响应提升用户体验

### 3. 错误处理

- 实现完善的错误处理机制
- 提供有意义的错误消息
- 实现自动恢复和重试逻辑
- 记录详细的错误日志

### 4. 监控和日志

- 实现性能监控和日志记录
- 定期检查系统健康状态
- 提供性能指标查询接口
- 实现日志轮转和清理

### 5. 测试

- 编写全面的单元测试
- 实现集成测试
- 使用benchmark进行性能测试
- 确保代码覆盖率

---

## 示例项目

### 示例1：简单聊天机器人

完整的示例项目，展示如何使用AAEngine创建一个简单的聊天机器人。

位置：`examples/chat-bot/`

### 示例2：多Agent协作

展示多个Agent之间如何协作完成任务。

位置：`examples/multi-agent/`

### 示例3：自定义工具

展示如何创建和使用自定义工具。

位置：`examples/custom-tools/`

### 示例4：流式响应

展示如何使用流式响应。

位置：`examples/streaming/`

---

## 更新日志

### 版本 0.3.0

- 添加使用指南
- 完善API文档
- 添加更多示例
- 改进错误处理

### 版本 0.4.0 (计划)

- 增强的工具系统
- 改进的上下文管理
- 更好的性能优化
- 添加更多通信渠道支持

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

1. 查看文档：`docs/api.md` 和 `docs/usage.md`
2. 查看示例：`examples/`
3. 提交Issue：https://github.com/chaov/aaengine/issues
4. 联系社区：https://discord.gg/aaengine

---

## 许可证

MIT License - 详见 LICENSE 文件

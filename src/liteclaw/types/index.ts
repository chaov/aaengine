export interface AgentConfig {
  id: string;
  name: string;
  personality?: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  channels: ChannelConfig[];
  skills?: string[];
  mcpServers?: MCPServerConfig[];
}

export interface ChannelConfig {
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'http' | 'websocket';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface MessageMetadata {
  channelId?: string;
  userId?: string;
  sessionId?: string;
  tokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  output: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface ContextConfig {
  maxHistory: number;
  maxTokens: number;
  enableRAG: boolean;
  compressionThreshold: number;
}

export interface Skill {
  name: string;
  version: string;
  description: string;
  execute: (context: SkillContext) => Promise<SkillResult>;
}

export interface SkillContext {
  message: Message;
  tools: Tool[];
  llm: LLMProvider;
}

export interface SkillResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface LLMProvider {
  generate(messages: Message[], options?: GenerateOptions): Promise<LLMResponse>;
  generateStream(messages: Message[], options?: GenerateOptions): AsyncIterable<LLMStreamChunk>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens:与其他;
  };
}

export interface LLMStreamChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: ToolCall;
  done?: boolean;
}

export interface MCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export interface StreamHandler {
  onStart(): void;
  onChunk(chunk: string): void;
  onToolCall(call: ToolCall): void;
  onToolResult(result: ToolResult): void;
  onComplete(): void;
  onError(error: Error): void;
}

export interface AgentEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'error' | 'stream';
  data: unknown;
  timestamp: number;
}

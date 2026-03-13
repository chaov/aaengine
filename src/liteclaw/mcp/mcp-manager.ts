import type { MCPClient, Tool, ToolResult } from '../types/index.js';

export class MCPManager {
  private clients: Map<string, MCPClient>;

  constructor() {
    this.clients = new Map();
  }

  async connectClient(name: string, command: string, args: string[]): Promise<void> {
    const client = new DefaultMCPClient(command, args);
    await client.connect();
    this.clients.set(name, client);
  }

  async disconnectClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  async listTools(name?: string): Promise<Tool[]> {
    if (name) {
      const client = this.clients.get(name);
      if (!client) {
        throw new Error(`MCP client not found: ${name}`);
      }
      return await client.listTools();
    }

    const allTools: Tool[] = [];
    for (const client of this.clients.values()) {
      const tools = await client.listTools();
      allTools.push(...tools);
    }
    return allTools;
  }

  async callTool(name: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`MCP client not found: ${name}`);
    }
    return await client.callTool(toolName, args);
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.entries()).map(
      async ([name]) => this.disconnectClient(name)
    );
    await Promise.all(promises);
  }
}

class DefaultMCPClient implements MCPClient {
  private command: string;
  private args: string[];
  private connected: boolean = false;
  private process?: import('child_process').ChildProcess;

  constructor(command: string, args: string[]) {
    this.command = command;
    this.args = args;
  }

  async connect(): Promise<void> {
    const { spawn } = await import('child_process');

    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.connected = false;
  }

  async listTools(): Promise<Tool[]> {
    if (!this.process || !this.connected) {
      throw new Error('MCP client not connected');
    }

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    this.process.stdin?.write(JSON.stringify(request) + '\n');

    return new Promise((resolve, reject) => {
      if (!this.process?.stdout) {
        reject(new Error('No stdout available'));
        return;
      }

      let buffer = '';

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line) as {
              result?: {
                tools?: Array<{
                  name: string;
                  description: string;
                  inputSchema: {
                    type: string;
                    properties: Record<string, unknown>;
                    required: string[];
                  };
                }>;
              };
            };

            if (response.result?.tools) {
              this.process?.stdout?.off('data', onData);
              resolve(
                response.result.tools.map(t => ({
                  name: t.name,
                  description: t.description,
                  parameters: Object.entries(t.inputSchema.properties).map(([name, prop]) => ({
                    name,
                    type: (prop as { type: string }).type,
                    description: '',
                    required: t.inputSchema.required.includes(name)
                  })),
                  handler: async () => ({
                    id: crypto.randomUUID(),
                    output: 'Tool executed via MCP'
                  })
                }))
              );
            }
          } catch (e) {
          }
        }
      };

      this.process.stdout.on('data', onData);
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.process || !this.connected) {
      throw new Error('MCP client not connected');
    }

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    this.process.stdin?.write(JSON.stringify(request) + '\n');

    return new Promise((resolve, reject) => {
      if (!this.process?.stdout) {
        reject(new Error('No stdout available'));
        return;
      }

      let buffer = '';

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line) as {
              result?: {
                content?: Array<{
                  type: string;
                  text?: string;
                }>;
              };
            };

            if (response.result?.content) {
              this.process?.stdout?.off('data', onData);
              const text = response.result.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');

              resolve({
                id: crypto.randomUUID(),
                output: text
              });
            }
          } catch (e) {
          }
        }
      };

      this.process.stdout.on('data', onData);
    });
  }
}

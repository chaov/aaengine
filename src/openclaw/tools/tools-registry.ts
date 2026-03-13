export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ToolsRegistry {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${name} not found`,
      };
    }

    try {
      return await tool.handler(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  validateToolCall(name: string, params: Record<string, unknown>): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    for (const [key, schema] of Object.entries(tool.parameters)) {
      if (schema.required && !(key in params)) {
        return false;
      }
    }

    return true;
  }
}

export const toolsRegistry = new ToolsRegistry();

import type { Tool, ToolResult } from '../types/index.js';

export class ToolsRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        id: crypto.randomUUID(),
        output: '',
        error: `Tool not found: ${name}`
      };
    }

    try {
      return await tool.handler(params);
    } catch (error) {
      return {
        id: crypto.randomUUID(),
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async listTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
  }
}

function safeEvaluateMath(expression: string): number {
  const sanitized = expression.trim();
  
  if (sanitized.length === 0) {
    throw new Error('Empty expression');
  }
  
  if (sanitized.length > 1000) {
    throw new Error('Expression too long');
  }
  
  const allowedChars = /^[0-9+\-*/().\s%]+$/;
  if (!allowedChars.test(sanitized)) {
    throw new Error('Invalid characters in expression');
  }
  
  if (/[a-zA-Z_]/.test(sanitized)) {
    throw new Error('Alphabetic characters not allowed');
  }
  
  const tokens = sanitized.match(/(\d+\.?\d*|\.\d+|[+\-*/()%])/g);
  if (!tokens || tokens.join('') !== sanitized.replace(/\s/g, '')) {
    throw new Error('Invalid expression format');
  }
  
  const numbers = sanitized.match(/\d+\.?\d+|\.\d+/g) || [];
  for (const num of numbers) {
    const value = parseFloat(num);
    if (isNaN(value) || !isFinite(value)) {
      throw new Error('Invalid number');
    }
    if (Math.abs(value) > 1e10) {
      throw new Error('Number out of range');
    }
  }
  
  try {
    const result = Function('"use strict"; return (' + sanitized + ')')();
    
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Invalid result');
    }
    
    if (Math.abs(result) > 1e10) {
      throw new Error('Result out of range');
    }
    
    return result;
  } catch (error) {
    throw new Error('Invalid mathematical expression');
  }
}

export function createBuiltinTools(): Tool[] {
  return [
    {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: [],
      handler: async () => ({
        id: crypto.randomUUID(),
        output: new Date().toISOString()
      })
    },
    {
      name: 'calculate',
      description: 'Perform a mathematical calculation',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2")',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const result = safeEvaluateMath(params.expression as string);
          return {
            id: crypto.randomUUID(),
            output: String(result)
          };
        } catch (error) {
          return {
            id: crypto.randomUUID(),
            output: '',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    },
    {
      name: 'echo',
      description: 'Echo back the input text',
      parameters: [
        {
          name: 'text',
          type: 'string',
          description: 'Text to echo back',
          required: true
        }
      ],
      handler: async (params) => ({
        id: crypto.randomUUID(),
        output: params.text as string
      })
    }
  ];
}

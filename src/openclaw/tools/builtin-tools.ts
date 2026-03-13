import type { Tool, ToolResult } from './tools-registry.js';

export const builtinTools: Tool[] = [
  {
    name: 'get_time',
    description: 'Get the current time',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const now = new Date();
      return {
        success: true,
        data: {
          iso: now.toISOString(),
          unix: Math.floor(now.getTime() / 1000),
          locale: now.toLocaleString(),
        },
      };
    },
  },
  {
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate',
        },
      },
      required: ['expression'],
    },
    handler: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        const expression = params.expression as string;
        const result = eval (expression);
        return {
          success: true,
          data: { expression, result },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  {
    name: 'echo',
    description: 'Echo the input back',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to echo',
        },
      },
      required: ['message'],
    },
    handler: async (params: Record<string, unknown>): Promise<ToolResult> => {
      return {
        success: true,
        data: { echoed: params.message },
      };
    },
  },
];

export function createBuiltinTools(): Tool[] {
  return [...builtinTools];
}

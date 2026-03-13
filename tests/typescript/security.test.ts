import { describe, it, expect, vi } from 'vitest';
import { createBuiltinTools } from '../../src/liteclaw/tools/tools-registry.js';

describe('Security Tests', () => {
  describe('Code Injection Prevention', () => {
    it('should prevent code injection via eval', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      expect(calculateTool).toBeDefined();
      
      const maliciousInputs = [
        'process.exit(1)',
        'require("fs").readFileSync("/etc/passwd")',
        'global.process = null',
        'constructor.constructor("return process")()',
        'Function("return process")()',
        'this.constructor.constructor("return process")()',
        '[][].constructor',
        'Math.constructor',
        '1+1;process.exit(1)',
        '(function(){process.exit(1)})()',
        '__proto__',
        'constructor',
        'prototype',
      ];
      
      for (const input of maliciousInputs) {
        const result = await calculateTool!.handler({ expression: input });
        expect(result.error).toBeDefined();
        expect(result.error).not.toBe('');
        expect(result.output).toBe('');
      }
    });
    
    it('should allow safe mathematical expressions', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      const safeExpressions = [
        { input: '2 + 2', expected: '4' },
        { input: '10 * 5', expected: '50' },
        { input: '100 / 4', expected: '25' },
        { input: '20 - 5', expected: '15' },
        { input: '(2 + 3) * 4', expected: '20' },
        { input: '10 % 3', expected: '1' },
        { input: '1.5 + 2.5', expected: '4' },
      ];
      
      for (const { input, expected } of safeExpressions) {
        const result = await calculateTool!.handler({ expression: input });
        expect(result.error).toBeUndefined();
        expect(result.output).toBe(expected);
      }
    });
    
    it('should reject expressions with alphabetic characters', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      const invalidInputs = [
        'x + y',
        'Math.sin(1)',
        'console.log("test")',
        'abc123',
        'var x = 1',
      ];
      
      for (const input of invalidInputs) {
        const result = await calculateTool!.handler({ expression: input });
        expect(result.error).toBeDefined();
      }
    });
    
    it('should reject empty or too long expressions', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      const emptyResult = await calculateTool!.handler({ expression: '' });
      expect(emptyResult.error).toBeDefined();
      
      const longExpression = '1' + '+1'.repeat(1000);
      const longResult = await calculateTool!.handler({ expression: longExpression });
      expect(longResult.error).toBeDefined();
    });
    
    it('should reject numbers out of range', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      const result = await calculateTool!.handler({ expression: '99999999999 * 99999999999' });
      expect(result.error).toBeDefined();
    });
  });
  
  describe('Input Validation', () => {
    it('should validate tool parameters', async () => {
      const tools = createBuiltinTools();
      const echoTool = tools.find(t => t.name === 'echo');
      
      const result1 = await echoTool!.handler({ text: 'Hello' });
      expect(result1.output).toBe('Hello');
      
      const result2 = await echoTool!.handler({ text: '' });
      expect(result2.output).toBe('');
      
      const result3 = await echoTool!.handler({ text: null as any });
      expect(result3.output).toBe(null);
    });
  });
  
  describe('Type Safety', () => {
    it('should handle type conversions safely', async () => {
      const tools = createBuiltinTools();
      const calculateTool = tools.find(t => t.name === 'calculate');
      
      const result = await calculateTool!.handler({ expression: '2 + 2' });
      expect(typeof result.output).toBe('string');
      expect(result.id).toBeDefined();
    });
  });
});
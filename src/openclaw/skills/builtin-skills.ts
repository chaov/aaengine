import type { Skill, SkillContext, SkillResult } from './skill-registry.js';

export const builtinSkills: Skill[] = [
  {
    name: 'greeting',
    description: 'Greets the user',
    version: '1.0.0',
    trigger: ['hello', 'hi', 'hey'],
    handler: async (context: SkillContext): Promise<SkillResult> => {
      const greetings = [
        'Hello! How can I help you today?',
        'Hi there! What can I do for you?',
        'Hey! How can I assist you?',
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      return {
        success: true,
        output: greeting,
      };
    },
  },
  {
    name: 'summarize',
    description: 'Summarizes the given text',
    version: '1.0.0',
    trigger: ['summarize', 'summary'],
    handler: async (context: SkillContext): Promise<SkillResult> => {
      const summary = await context.llm.generate(
        `Please summarize the following text:\n\n${context.input}`
      );
      return {
        success: true,
        output: summary,
      };
    },
  },
  {
    name: 'time',
    description: 'Gets the current time',
    version: '1.0.0',
    trigger: ['time', 'current time'],
    handler: async (context: SkillContext): Promise<SkillResult> => {
      const now = new Date();
      return {
        success: true,
        output: `The current time is ${now.toLocaleString()}`,
      };
    },
  },
];

export function createBuiltinSkills(): Skill[] {
  return [...builtinSkills];
}

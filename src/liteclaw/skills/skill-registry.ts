import type { Skill, SkillContext, SkillResult } from '../types/index.js';

export class SkillRegistry {
  private skills: Map<string, Skill>;

  constructor() {
    this.skills = new Map();
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  unregisterSkill(name: string): boolean {
    return this.skills.delete(name);
  }

  async executeSkill(name: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(name);

    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${name}`
      };
    }

    try {
      return await skill.execute(context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async listSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values());
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  clear(): void {
    this.skills.clear();
  }
}

export function createBuiltinSkills(): Skill[] {
  return [
    {
      name: 'greeting',
      version: '1.0.0',
      description: 'Greets the user',
      execute: async (context: SkillContext) => {
        const message = context.message.content.toLowerCase();
        if (message.includes('hello') || message.includes('hi')) {
          return {
            success: true,
            output: 'Hello! How can I help you today?'
          };
        }
        return {
          success: false,
          error: 'No greeting detected'
        };
      }
    },
    {
      name: 'summarize',
      version: '1.0.0',
      description: 'Summarizes the conversation',
      execute: async (context: SkillContext) => {
        return {
          success: true,
          output: 'Conversation summary functionality'
        };
      }
    }
  ];
}

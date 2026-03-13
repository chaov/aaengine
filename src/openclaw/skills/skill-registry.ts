export interface Skill {
  name: string;
  description: string;
  version: string;
  trigger: string[];
  handler: (context: SkillContext) => Promise<SkillResult>;
}

export interface SkillContext {
  input: string;
  tools: Record<string, unknown>;
  llm: {
    generate: (prompt: string) => Promise<string>;
  };
  metadata: Record<string, unknown>;
}

export interface SkillResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private triggers: Map<string, string[]> = new Map();

  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
    
    for (const trigger of skill.trigger) {
      if (!this.triggers.has(trigger)) {
        this.triggers.set(trigger, []);
      }
      this.triggers.get(trigger)!.push(skill.name);
    }
  }

  unregisterSkill(name: string): void {
    const skill = this.skills.get(name);
    if (skill) {
      for (const trigger of skill.trigger) {
        const skills = this.triggers.get(trigger);
        if (skills) {
          const index = skills.indexOf(name);
          if (index > -1) {
            skills.splice(index, 1);
          }
        }
      }
      this.skills.delete(name);
    }
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  findSkillsByTrigger(trigger: string): Skill[] {
    const skillNames = this.triggers.get(trigger) || [];
    return skillNames.map(name => this.skills.get(name)!).filter(Boolean);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  async executeSkill(name: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found`);
    }

    return await skill.handler(context);
  }
}

export const skillRegistry = new SkillRegistry();

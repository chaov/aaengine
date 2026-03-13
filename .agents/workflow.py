#!/usr/bin/env python3
"""
AAEngine Agent 工作流管理器
"""

import json
import os
import subprocess
from pathlib import Path

class AgentWorkflow:
    def __init__(self, config_path=".agents/config.json"):
        self.config_path = Path(config_path)
        self.repo_url = "https://github.com/chaov/aaengine.git"
        self.load_config()
    
    def load_config(self):
        """加载agent配置"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        self.agents = {agent['id']: agent for agent in self.config['agents']}
    
    def get_agent(self, agent_id):
        """获取agent信息"""
        return self.agents.get(agent_id)
    
    def run_stage(self, stage_name):
        """运行指定阶段"""
        stages = self.config['workflow']['stages']
        for stage in stages:
            if stage['name'] == stage_name:
                return self.execute_stage(stage)
        return None
    
    def execute_stage(self, stage):
        """执行一个阶段"""
        print(f"\n{'='*50}")
        print(f"执行阶段: {stage['name']}")
        print(f"{'='*50}")
        
        agent_ids = stage['agents']
        parallel = stage.get('parallel', False)
        
        if parallel:
            print(f"并行执行agents: {', '.join(agent_ids)}")
            results = self.run_agents_parallel(agent_ids, stage)
        else:
            print(f"顺序执行agents: {', '.join(agent_ids)}")
            results = self.run_agents_sequential(agent_ids, stage)
        
        print(f"\n阶段 {stage['name']} 完成")
        print(f"输出: {stage.get('output', 'N/A')}")
        
        return results
    
    def run_agents_sequential(self, agent_ids, stage):
        """顺序执行agents"""
        results = {}
        for agent_id in agent_ids:
            agent = self.get_agent(agent_id)
            if agent is None:
                print(f"错误: 未找到agent {agent_id}")
                continue
            
            print(f"\n--- 执行 {agent['name']} ---")
            print(f"角色: {agent['role']}")
            print(f"描述: {agent['description']}")
            
            # 这里应该调用实际的agent执行逻辑
            # 目前只是模拟
            results[agent_id] = {
                'status': 'completed',
                'agent': agent['name']
            }
        
        return results
    
    def run_agents_parallel(self, agent_ids, stage):
        """并行执行agents"""
        results = {}
        print(f"\n--- 并行执行 {len(agent_ids)} 个agents ---")
        
        for agent_id in agent_ids:
            agent = self.get_agent(agent_id)
            if agent is None:
                print(f"错误: 未找到agent {agent_id}")
                continue
            
            print(f"\n--- 执行 {agent['name']} ---")
            print(f"角色: {agent['role']}")
            print(f"描述: {agent['description']}")
            
            # 模拟并行执行
            results[agent_id] = {
                'status': 'completed',
                'agent': agent['name']
            }
        
        return results
    
    def commit_to_github(self, message="Update code"):
        """提交代码到GitHub"""
        print(f"\n{'='*50}")
        print("提交代码到GitHub")
        print(f"{'='*50}")
        
        try:
            # 添加所有更改
            subprocess.run(['git', 'add', '.'], check=True)
            
            # 提交
            subprocess.run(['git', 'commit', '-m', message], check=True)
            
            # 推送
            subprocess.run(['git', 'push', 'origin', 'main'], check=True)
            
            print("✓ 代码已成功提交到GitHub")
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ 提交失败: {e}")
            return False
    
    def run_full_workflow(self):
        """运行完整工作流"""
        print("\n" + "="*50)
        print("开始执行 AAEngine Agent 工作流")
        print("="*50)
        
        all_results = {}
        
        for stage in self.config['workflow']['stages']:
            results = self.execute_stage(stage)
            all_results[stage['name']] = results
        
        print("\n" + "="*50)
        print("所有阶段执行完成")
        print("="*50)
        
        return all_results

def main():
    """主函数"""
    workflow = AgentWorkflow()
    
    print("\n可用的操作:")
    print("1. 运行完整工作流")
    print("2. 运行单个阶段")
    print("3. 提交代码到GitHub")
    print("4. 查看agent配置")
    
    choice = input("\n请选择操作 (1-4): ").strip()
    
    if choice == "1":
        workflow.run_full_workflow()
    elif choice == "2":
        print("\n可用阶段:")
        for i, stage in enumerate(workflow.config['workflow']['stages'], 1):
            print(f"{i}. {stage['name']}")
        
        stage_choice = input("\n请选择阶段: ").strip()
        if stage_choice.isdigit():
            idx = int(stage_choice) - 1
            if 0 <= idx < len(workflow.config['workflow']['stages']):
                stage = workflow.config['workflow']['stages'][idx]
                workflow.execute_stage(stage)
    elif choice == "3":
        message = input("请输入提交信息: ").strip() or "Update code"
        workflow.commit_to_github(message)
    elif choice == "4":
        print("\n" + "="*50)
        print("Agent 配置")
        print("="*50)
        for agent in workflow.config['agents']:
            print(f"\nID: {agent['id']}")
            print(f"名称: {agent['name']}")
            print(f"角色: {agent['role']}")
            print(f"描述: {agent['description']}")
            print(f"能力: {', '.join(agent['capabilities'])}")

if __name__ == "__main__":
    main()

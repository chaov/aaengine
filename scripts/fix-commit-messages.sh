#!/bin/bash

# 批量修改commit message，去掉工程师名字信息

echo "开始修改commit message..."

# 需要修改的commit（按时间倒序，最新的先修改）
commits=(
    "dd34412:Complete core engine and LiteClaw implementation"
    "703a103:Complete test suite, code review and benchmark system"
    "6422e27:Complete system architecture design documentation"
    "d6e0a22:Complete technical research report and product planning documentation"
)

for commit_info in "${commits[@]}"; do
    IFS=':' read -r commit_hash message <<< "$commit_info"
    
    echo "修改commit: $commit_hash"
    echo "新message: $message"
    
    # 使用git commit --amend来修改message
    if git commit --amend -m "$message" 2>&1; then
        echo "✓ 成功修改: $commit_hash"
    else
        echo "✗ 修改失败: $commit_hash"
    fi
    
    echo ""
done

echo "所有commit message修改完成！"
git log --oneline -5

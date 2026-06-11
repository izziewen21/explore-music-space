#!/bin/bash
# Deploy Explore Your Music Space to GitHub Pages
# Run in Terminal: bash deploy.sh

set -e
cd "$(dirname "$0")"

REPO_NAME="explore-music-space"

if ! command -v gh &>/dev/null; then
  echo "请先安装 GitHub CLI: https://cli.github.com/"
  echo "macOS 安装: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "请先登录 GitHub: gh auth login"
  exit 1
fi

if ! git rev-parse --git-dir &>/dev/null; then
  git init -b main
  git add .
  git commit -m "Add Explore Your Music Space H5"
fi

if git remote get-url origin &>/dev/null; then
  echo "推送到已有仓库..."
  git push -u origin main
else
  echo "创建 GitHub 仓库并推送..."
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

USER=$(gh api user -q .login)
echo ""
echo "=========================================="
echo "  部署完成！"
echo "  访问地址: https://${USER}.github.io/${REPO_NAME}/"
echo "=========================================="
echo ""
echo "首次部署需等待 1-3 分钟，Actions 完成后即可访问。"
echo "查看进度: https://github.com/${USER}/${REPO_NAME}/actions"

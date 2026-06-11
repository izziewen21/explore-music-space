#!/bin/bash
# Deploy Explore Your Music Space to GitHub Pages
# Run in Terminal: bash deploy.sh

set -e
cd "$(dirname "$0")"

REPO_NAME="explore-music-space"

if ! command -v gh &>/dev/null; then
  echo "未检测到 GitHub CLI (gh)。可选方案："
  echo ""
  echo "【方案 1】安装 gh 后重新运行本脚本"
  echo "  brew install gh"
  echo "  gh auth login"
  echo "  bash deploy.sh"
  echo ""
  echo "【方案 2】手动部署"
  echo "  1. 打开 https://github.com/new 创建公开仓库 explore-music-space"
  echo "  2. 不要勾选 Add a README"
  echo "  3. 在终端执行（把 YOUR_USERNAME 换成你的 GitHub 用户名）："
  echo "     cd $(pwd)"
  echo "     git remote add origin https://github.com/YOUR_USERNAME/explore-music-space.git"
  echo "     git push -u origin main"
  echo "  4. 仓库 Settings → Pages → Source 选 Deploy from a branch"
  echo "     Branch: main  /  Folder: / (root)  → Save"
  echo "  5. 等待 1-2 分钟，访问 https://YOUR_USERNAME.github.io/explore-music-space/"
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

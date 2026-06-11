#!/bin/bash
# 修复 GitHub 403 并完成推送 + Pages 部署
# 用法: bash push-github.sh

set -e
cd "$(dirname "$0")"

REPO="izziewen21/explore-music-space"
REMOTE="https://github.com/${REPO}.git"

echo "=========================================="
echo " GitHub 推送助手"
echo " 仓库: ${REPO}"
echo "=========================================="
echo ""

# 确保 remote 正确
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi
echo "✓ remote 已设为: $REMOTE"
echo ""

# 优先尝试 gh 登录
if command -v gh &>/dev/null; then
  if ! gh auth status &>/dev/null; then
    echo "请先完成 GitHub 登录（会打开浏览器）："
    gh auth login -h github.com -p https -w
  fi
  gh auth setup-git
  echo "✓ 使用 gh 凭证，正在推送..."
  git push -u origin main
else
  echo "【重要】GitHub 已不支持用「账号密码」推送！"
  echo ""
  echo "请按以下步骤操作："
  echo ""
  echo "1) 创建 Personal Access Token (PAT)"
  echo "   打开: https://github.com/settings/tokens/new"
  echo "   Note 填: explore-music-space"
  echo "   Expiration: 90 days（或自定义）"
  echo "   勾选权限: repo（全部 repo 权限）"
  echo "   点 Generate token，复制 token（只显示一次！）"
  echo ""
  echo "2) 清除 Mac 里旧的错误 GitHub 密码（可选但推荐）"
  echo "   打开「钥匙串访问」→ 搜索 github → 删除 git 相关条目"
  echo ""
  echo "3) 下面执行 push，按提示输入："
  echo "   Username: izziewen21"
  echo "   Password: 粘贴刚才的 token（不是登录密码）"
  echo ""
  read -p "准备好后按 Enter 开始推送..."
  git push -u origin main
fi

echo ""
echo "=========================================="
echo " 推送成功！"
echo ""
echo " 最后一步 — 开启 GitHub Pages："
echo " 1. 打开 https://github.com/${REPO}/settings/pages"
echo " 2. Build and deployment → Source 选「Deploy from a branch」"
echo " 3. Branch 选 main，Folder 选 / (root)，点 Save"
echo " 4. 等待 1-2 分钟"
echo ""
echo " 访问地址:"
echo " https://izziewen21.github.io/explore-music-space/"
echo "=========================================="

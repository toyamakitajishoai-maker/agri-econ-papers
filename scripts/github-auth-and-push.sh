#!/bin/sh
set -e

cd "$(dirname "$0")/.."

echo "=== GitHub 認証・push ヘルパー ==="
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) が未インストールです。次を実行してください:"
  echo "  brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub にログインしていません。"
  echo "これからブラウザが開きます。GitHub で「Authorize」を押してください。"
  echo ""
  gh auth login -h github.com -p https -w -s repo,workflow
  gh auth setup-git
  echo ""
  echo "ログイン完了"
else
  echo "GitHub ログイン済みです"
  gh auth setup-git 2>/dev/null || true
fi

echo ""
echo "push を実行します..."
git push -u origin main

echo ""
echo "完了しました: https://github.com/toyamakitajishoai-maker/agri-econ-papers"

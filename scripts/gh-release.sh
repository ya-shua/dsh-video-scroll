#!/usr/bin/env bash
# 一键发 GitHub Release（前置：gh auth login + 已建远程并 git remote add origin <url>）
set -e
cd "$(dirname "$0")/.."
gh release create "v1.4.1" "../releases/dsh-video-scroll-v1.4.1.tar.gz" \
  --title "dsh-video-scroll v1.4.1" \
  --notes-file "RELEASE-v1.4.1.md"
echo "done（记得先 git push origin main --tags）"

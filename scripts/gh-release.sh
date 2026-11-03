#!/usr/bin/env bash
# 一键发 GitHub Release（前置：gh auth login + 已建远程并 git remote add origin <url>）
set -e
cd "$(dirname "$0")/.."
gh release create "v0.3.0" "releases/snow-video-kit-v0.3.0.tar.gz" \
  --title "snow-video-kit v0.3.0" \
  --notes-file "RELEASE-v0.3.0.md"
echo "done（记得先 git push origin main --tags）"

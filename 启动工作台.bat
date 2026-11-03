@echo off
chcp 65001 >nul
title 刷视频工作台 (snow-video-kit)
cd /d "%~dp0"
set NODE_EXE=D:\AI\QQ大肥鱼\SnowLuma\node.exe
if not exist "%NODE_EXE%" set NODE_EXE=node
"%NODE_EXE%" src\index.js
pause

@echo off
chcp 65001 >nul
title 刷视频工具包 · 安装
set BASE=%~dp0
set NODE_EXE=D:\AI\QQ大肥鱼\SnowLuma\node.exe
if not exist "%NODE_EXE%" set NODE_EXE=node

echo ============================================
echo   刷视频工具包 · 安装（snow-video-kit v0.3.0）
echo ============================================
echo.

rem 1) 自检
cd /d "%BASE%"
"%NODE_EXE%" src\check.js
if errorlevel 1 (
  echo.
  echo 自检未通过：请先解决上面标 ✗ 的项目再安装。
  pause
  exit /b 1
)

rem 2) 桌面快捷方式（一键启动 VBS 已在桌面则复用，否则生成）
if exist "%USERPROFILE%\Desktop" copy /y "%BASE%刷视频面板一键启动.vbs" "%USERPROFILE%\Desktop\" >nul 2>&1
if exist "D:\我的电脑\桌面" copy /y "%BASE%刷视频面板一键启动.vbs" "D:\我的电脑\桌面\" >nul 2>&1

rem 3) 开机自启（后台无窗口）
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
if not exist "%STARTUP%" mkdir "%STARTUP%" 2>nul
copy /y "%BASE%自启.vbs" "%STARTUP%\刷视频工具包自启.vbs" >nul 2>&1 && echo 已注册开机自启（后台无窗口）|| echo 开机自启注册失败（不影响手动启动）

rem 4) 立即后台启动一次
if exist "%BASE%state\console-token" (
  wscript "%BASE%后台启动.vbs" 2>nul || wscript.exe "%BASE%后台启动.vbs"
  echo 服务已在后台启动：http://127.0.0.1:8412
)

echo.
echo 安装完成。桌面「刷视频面板一键启动.vbs」双击即用。
pause

@echo off
chcp 65001 >nul
echo 正在停止服务并移除自启…
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8412 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\刷视频工具包自启.vbs" >nul 2>&1
del "%USERPROFILE%\Desktop\刷视频面板一键启动.vbs" >nul 2>&1
del "D:\我的电脑\桌面\刷视频面板一键启动.vbs" >nul 2>&1
echo 已卸载（数据目录 state\ 与 config.json 保留）。
pause

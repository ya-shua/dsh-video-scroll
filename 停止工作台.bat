@echo off
chcp 65001 >nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8412 ^| findstr LISTENING') do taskkill /F /PID %%p
echo 已停止（若提示找不到进程说明本来就没跑）
pause

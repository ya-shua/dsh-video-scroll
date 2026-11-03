' 开机自启入口：无窗口后台启动（由 install.bat 复制到 Startup 文件夹）
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
sh.Run "cmd /c ""D:\AI\QQ大肥鱼\SnowLuma\node.exe"" src\index.js > state\startup.log 2>&1", 0, False

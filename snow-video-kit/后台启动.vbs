' 无窗口后台启动 snow-video-kit 工作台（日志在 state\web.log）
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
sh.Run "cmd /c ""D:\AI\QQ大肥鱼\SnowLuma\node.exe"" src\index.js > state\web.log 2>&1", 0, False
